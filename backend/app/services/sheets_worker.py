"""Durable, revision-aware Google Sheets jobs; no Google calls inside signup transactions."""
import random
import time
from datetime import timedelta
from uuid import uuid4
from sqlalchemy import and_, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from ..domain import utcnow
from ..models import EventForm, EventFormSheet, EventSheet, Member, Officer, SheetPermission, SheetsConnection
from .sheets_export import form_rows, signup_rows
from .sheets_queue import enqueue_data, schedule_form_transitions
from .sheets_google import GoogleFailure, GoogleSheetsClient


class Superseded(Exception):
    """Configuration, connection, or ownership changed while a job was running."""


class RateLimiter:
    """One elected worker shares a conservative budget across Sheets and Drive requests."""
    def __init__(self):
        self.next_at = 0

    def __call__(self):
        time.sleep(max(0, self.next_at - time.monotonic()))
        self.next_at = time.monotonic() + 1.5  # At most 40 requests/minute, below Sheets' user quota.


def heartbeat(sessions):
    with sessions.begin() as db:
        db.execute(insert(SheetsConnection).values(id=1, worker_seen_at=utcnow()).on_conflict_do_update(
            index_elements=[SheetsConnection.id], set_={"worker_seen_at": utcnow()},
        ))


def claim(sessions):
    now = utcnow()
    with sessions.begin() as db:
        connection = db.get(SheetsConnection, 1)
        if not connection or not connection.refresh_token or connection.error:
            return None
        transitions = list(db.scalars(select(EventSheet).where(
            EventSheet.enabled.is_(True), EventSheet.next_form_transition_at <= now,
        ).with_for_update(skip_locked=True)))
        if transitions:
            enqueue_data(db.connection(), EventSheet.id.in_([s.id for s in transitions]), immediate=True)
            schedule_form_transitions(db.connection(), [s.event_id for s in transitions if s.event_id])
            now = utcnow()
        target = db.scalar(select(EventSheet).where(
            or_(EventSheet.claimed_until.is_(None), EventSheet.claimed_until < now),
            or_(
                and_(EventSheet.enabled.is_(True), EventSheet.event_id.is_not(None),
                     EventSheet.blocked.is_(False), EventSheet.requested > EventSheet.completed,
                     EventSheet.due_at <= now),
                and_(EventSheet.access_blocked.is_(False), EventSheet.access_requested > EventSheet.access_completed,
                     EventSheet.access_due_at <= now),
            ),
        ).order_by(EventSheet.id).with_for_update(skip_locked=True).limit(1))
        if not target:
            return None
        target.claim_token = uuid4().hex
        target.claimed_until = now + timedelta(minutes=2)
        return target.id, target.claim_token


def finish(sessions, sid, token, version, *, access=False):
    with sessions.begin() as db:
        target = db.get(EventSheet, sid, with_for_update=True)
        if not target or target.claim_token != token:
            raise Superseded()
        if access:
            target.access_completed = version
            target.access_error, target.access_attempts, target.access_blocked = "", 0, False
            target.access_due_at = None if target.access_requested == version else utcnow()
        else:
            target.completed = version
            target.error, target.attempts, target.blocked = "", 0, False
            target.last_synced_at = utcnow()
            if target.requested == version:
                target.due_at = target.pending_since = None
            else:
                target.due_at = utcnow() + timedelta(seconds=30)


def failure(sessions, sid, token, generation, error, *, access=False):
    with sessions.begin() as db:
        # Match the connection-before-target order used by reconnect and the job guard.
        db.get(SheetsConnection, 1, with_for_update=True)
        target = db.get(EventSheet, sid, with_for_update=True)
        if not target or target.claim_token != token:
            return
        prefix = "access_" if access else ""
        attempts = getattr(target, prefix + "attempts") + 1
        setattr(target, prefix + "attempts", attempts)
        setattr(target, prefix + "error", str(error)[:500])
        setattr(target, prefix + "blocked", error.permanent or error.reconnect)
        setattr(target, prefix + "due_at", utcnow() + timedelta(seconds=min(2 ** min(attempts, 9), 300) + random.random()))
        if error.reconnect:
            db.execute(update(SheetsConnection).where(SheetsConnection.id == 1, SheetsConnection.generation == generation)
                       .values(error=str(error)[:500]))


def provision(sessions, target, client):
    file_id = target.spreadsheet_id
    if not file_id:
        file_id = client.find_file(target.provision_key)
        if not file_id:
            if target.provision_started_at:
                raise GoogleFailure(
                    "Spreadsheet creation could not be confirmed. Sync now searches for the original file; "
                    "ask an administrator for help if it is still missing.", permanent=True,
                )
            with sessions.begin() as db:
                db.execute(update(EventSheet).where(EventSheet.id == target.id).values(provision_started_at=utcnow()))
            try:
                file_id = client.create_file(target.title, target.provision_key)
            except GoogleFailure as error:
                if not error.uncertain:
                    with sessions.begin() as db:
                        db.execute(update(EventSheet).where(EventSheet.id == target.id).values(provision_started_at=None))
                raise
        with sessions.begin() as db:
            db.execute(update(EventSheet).where(EventSheet.id == target.id).values(spreadsheet_id=file_id))
        target.spreadsheet_id = file_id
    if target.sheet_id is None:
        sheet_id = int(target.provision_key[:8], 16) % 1_000_000_000 + 1
        client.ensure_tabs(file_id, sheet_id, client.owner_email)
        with sessions.begin() as db:
            db.execute(update(EventSheet).where(EventSheet.id == target.id).values(sheet_id=sheet_id))
        target.sheet_id = sheet_id


def reconcile_access(sessions, target, client):
    with sessions() as db:
        desired = set(db.scalars(select(Member.email).join(Officer, Officer.member_id == Member.id))) if target.event_id else set()
        desired.discard(client.owner_email)
        desired.discard(None)
        tracked = {p.email: p for p in db.scalars(select(SheetPermission).where(SheetPermission.sheet_id == target.id))}
    if not target.spreadsheet_id:
        return
    # Cleanup can complete even when an owner has already deleted the file.
    if target.event_id is None:
        for record in tracked.values():
            if record.permission_id:
                client.unshare(target.spreadsheet_id, record.permission_id)
            else:
                # An interrupted share may have completed before its ID was saved.
                permissions = client.permissions(target.spreadsheet_id, missing_ok=True)
                match = next((p for p in permissions if p.get("emailAddress", "").lower() == record.email), None)
                if match and match.get("role") != "owner":
                    client.unshare(target.spreadsheet_id, match["id"])
            with sessions.begin() as db:
                db.delete(db.get(SheetPermission, record.id))
        return
    actual = {p.get("emailAddress", "").lower(): p for p in client.permissions(target.spreadsheet_id)
              if p.get("type") == "user"}
    for email, record in tracked.items():
        if email not in desired:
            permission = actual.get(email)
            pid = record.permission_id or (permission["id"] if permission else None)
            if pid and (not permission or permission.get("role") != "owner"):
                client.unshare(target.spreadsheet_id, pid)
            with sessions.begin() as db:
                db.delete(db.get(SheetPermission, record.id))
    for email in sorted(desired):
        existing = actual.get(email)
        record = tracked.get(email)
        if existing and record is None:
            # A manual grant predates the integration; never claim ownership of it.
            if existing["role"] not in {"writer", "owner"}:
                raise GoogleFailure("An officer has a manual read-only grant. Give that officer edit access in Google Drive.",
                                    permanent=True)
            continue
        if record is None:
            with sessions.begin() as db:
                record = SheetPermission(sheet_id=target.id, email=email)
                db.add(record)
                db.flush()
        if existing and existing["role"] == "writer":
            pid = existing["id"]
        else:
            if existing and existing["role"] == "owner":
                continue
            if existing:
                client.set_writer(target.spreadsheet_id, existing["id"])
                pid = existing["id"]
            else:
                pid = client.share(target.spreadsheet_id, email)
        with sessions.begin() as db:
            db.execute(update(SheetPermission).where(SheetPermission.id == record.id).values(permission_id=pid))


def process_job(sessions, settings, job, *, client_factory=GoogleSheetsClient, throttle=None, leader_check=lambda: None):
    sid, token = job
    with sessions() as db:
        target = db.get(EventSheet, sid)
        connection = db.get(SheetsConnection, 1)
        generation = connection.generation
        encrypted_token, owner = connection.refresh_token, connection.email
    mode = "access"

    def guard():
        leader_check()
        with sessions.begin() as db:
            current = db.get(SheetsConnection, 1, with_for_update=True)
            row = db.get(EventSheet, sid, with_for_update=True)
            if (not current or not current.refresh_token or current.generation != generation or current.error
                    or not row or row.claim_token != token or row.revision != target.revision
                    or row.event_id != target.event_id or (mode == "data" and not row.enabled)):
                raise Superseded()
            row.claimed_until = utcnow() + timedelta(minutes=2)
            current.worker_seen_at = utcnow()

    client = None
    try:
        guard()
        client = client_factory(settings, encrypted_token, guard, throttle=throttle)
        client.owner_email = owner
        if target.event_id and target.enabled and (not target.spreadsheet_id or target.sheet_id is None):
            mode = "data"
            try:
                provision(sessions, target, client)
            except GoogleFailure as error:
                failure(sessions, sid, token, generation, error)
                # Provisioning is a prerequisite of both jobs. Keep access from hot-looping.
                failure(sessions, sid, token, generation, error, access=True)
                return
        mode = "access"
        if (target.access_requested > target.access_completed and not target.access_blocked
                and target.access_due_at and target.access_due_at <= utcnow()):
            try:
                reconcile_access(sessions, target, client)
                finish(sessions, sid, token, target.access_requested, access=True)
            except GoogleFailure as error:
                failure(sessions, sid, token, generation, error, access=True)
                if error.reconnect:
                    return
        mode = "data"
        if (target.enabled and target.event_id and target.requested > target.completed and not target.blocked
                and target.due_at and target.due_at <= utcnow()):
            guard()
            with sessions() as db:
                rows = list(signup_rows(db, target.event_id, target.columns))
                forms = [(form, config, list(form_rows(db, form, config.columns)))
                         for form, config in db.execute(select(EventForm, EventFormSheet).join(EventFormSheet).where(
                             EventForm.event_id == target.event_id, EventForm.state != "draft", EventFormSheet.enabled.is_(True),
                         ).order_by(EventForm.number))]
            try:
                client.write_snapshot(target.spreadsheet_id, target.sheet_id, target.columns, rows)
                for form, config, response_rows in forms:
                    guard()
                    client.ensure_form_tab(target.spreadsheet_id, config.sheet_id,
                                           f"Form {form.number} — {form.title}", client.owner_email)
                    client.write_snapshot(target.spreadsheet_id, config.sheet_id, config.columns, response_rows)
                guard()
                finish(sessions, sid, token, target.requested)
            except GoogleFailure as error:
                failure(sessions, sid, token, generation, error)
    except GoogleFailure as error:
        failure(sessions, sid, token, generation, error)
        failure(sessions, sid, token, generation, error, access=True)
    except Superseded:
        pass
    finally:
        if client:
            client.close()
        with sessions.begin() as db:
            db.execute(update(EventSheet).where(EventSheet.id == sid, EventSheet.claim_token == token).values(
                claim_token=None, claimed_until=None,
            ))
