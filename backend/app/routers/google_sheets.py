import hashlib
import secrets
from datetime import timedelta
from authlib.integrations.starlette_client import OAuth
from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from ..auth import limited, officer
from ..db import get_db
from ..domain import PACIFIC, advisory, audit, fail, require, slug, utcnow
from ..models import Event, EventSheet, Officer, SheetsConnection, SheetsOAuthFlow
from ..schemas import (
    EventSheetView, EventSheetWrite, Revision, SheetsConnectURL, SheetsConnectWrite, SheetsConnectionView,
)
from ..services.sheets_export import column_catalog, signup_rows

router = APIRouter(prefix="/api/admin")
DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"
CONNECTION_PATH = "/integrations/google-sheets"


def make_sheets_oauth(settings):
    oauth = OAuth()
    if settings.sheets_enabled:
        oauth.register(
            "sheets", client_id=settings.sheets_client_id, client_secret=settings.sheets_client_secret,
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": f"openid email {DRIVE_SCOPE}", "code_challenge_method": "S256"},
        )
    return oauth


def available(request):
    if not request.app.state.settings.sheets_enabled:
        fail(503, "sheets_unconfigured", "Google Sheets is not enabled. Ask an administrator to configure it.")


def connected(request, db):
    available(request)
    connection = db.get(SheetsConnection, 1)
    if not connection or not connection.refresh_token or connection.error:
        fail(409, "sheets_disconnected", "Connect the club Google account before syncing spreadsheets.")
    return connection


def lock_connection(db):
    advisory(db, 721)
    # The worker may create the singleton concurrently with the first OAuth callback.
    db.execute(insert(SheetsConnection).values(id=1).on_conflict_do_nothing(index_elements=[SheetsConnection.id]))
    return db.get(SheetsConnection, 1, with_for_update=True, populate_existing=True)


@router.get(CONNECTION_PATH, response_model=SheetsConnectionView)
def connection_status(request: Request, user=Depends(officer), db=Depends(get_db, scope="function")):
    connection = db.get(SheetsConnection, 1)
    pending = (EventSheet.enabled & (EventSheet.requested > EventSheet.completed)) | (
        EventSheet.access_requested > EventSheet.access_completed
    )
    count, oldest = db.execute(select(func.count(), func.min(EventSheet.pending_since)).where(pending)).one()
    seen = connection.worker_seen_at if connection else None
    return {
        "available": request.app.state.settings.sheets_enabled,
        "connected": bool(connection and connection.refresh_token and not connection.error),
        "email": connection.email if connection else None,
        "error": connection.error if connection else "", "worker_seen_at": seen,
        "worker_healthy": bool(seen and seen > utcnow() - timedelta(seconds=90)),
        "pending_count": count, "oldest_pending_at": oldest,
    }


@router.post(CONNECTION_PATH + "/connect", response_model=SheetsConnectURL)
async def connect(value: SheetsConnectWrite, request: Request, user=Depends(officer),
                  db=Depends(get_db, scope="function")):
    available(request)
    limited(request, db, "sheets.connect", 10)
    event = require(db, Event, value.event_id)
    state = secrets.token_urlsafe(32)
    db.execute(delete(SheetsOAuthFlow).where(
        (SheetsOAuthFlow.officer_id == user.id) | (SheetsOAuthFlow.created_at < utcnow() - timedelta(minutes=10))
    ))
    db.add(SheetsOAuthFlow(
        state_hash=hashlib.sha256(state.encode()).hexdigest(), officer_id=user.id,
        return_to=f"/admin/events/{slug(event.name)}/{event.id}?tab=google-sheets",
    ))
    google = request.app.state.sheets_oauth.create_client("sheets")
    try:
        response = await google.authorize_redirect(
            request, request.app.state.settings.app_url + "/api/admin" + CONNECTION_PATH + "/callback",
            state=state, access_type="offline", prompt="consent select_account",
        )
    except Exception:
        fail(502, "google_unavailable", "Could not start the Google connection. Please try again.")
    return {"url": response.headers["location"]}


@router.get(CONNECTION_PATH + "/callback")
async def callback(request: Request, user=Depends(officer), db=Depends(get_db, scope="function")):
    available(request)
    state = request.query_params.get("state", "")
    flow = db.scalar(select(SheetsOAuthFlow).where(
        SheetsOAuthFlow.state_hash == hashlib.sha256(state.encode()).hexdigest()
    ).with_for_update())
    if not flow or flow.officer_id != user.id or flow.created_at < utcnow() - timedelta(minutes=10):
        fail(400, "oauth_state", "This connection request expired. Start again from the event’s Google Sheets tab.")
    destination = flow.return_to
    previous = db.get(SheetsConnection, 1)
    generation = previous.generation if previous else 0
    db.delete(flow)
    db.commit()  # A callback is consumed once, including failed exchanges.

    def error(code):
        return RedirectResponse(destination + "&sheets_error=" + code, status_code=303)

    try:
        token = await request.app.state.sheets_oauth.create_client("sheets").authorize_access_token(request)
    except Exception:
        return error("connection_failed")
    info = token.get("userinfo", {})
    if not info.get("email_verified") or not info.get("sub") or not info.get("email"):
        return error("connection_failed")
    if DRIVE_SCOPE not in token.get("scope", "").split():
        return error("missing_scope")
    connection = lock_connection(db)
    if connection.generation != generation or not db.scalar(
        select(Officer.member_id).where(Officer.member_id == user.id)
    ):
        # A disconnect/reconnect or officer revocation during Google's exchange wins.
        return error("connection_failed")
    if connection and connection.subject and connection.subject != info["sub"]:
        return error("wrong_account")
    if not token.get("refresh_token"):
        return error("offline_access")
    connection.subject, connection.email = info["sub"], info["email"].strip().lower()
    connection.refresh_token = Fernet(request.app.state.settings.sheets_token_key.encode()).encrypt(
        token["refresh_token"].encode()
    ).decode()
    connection.generation += 1
    connection.error = ""
    for target in db.scalars(select(EventSheet).order_by(EventSheet.id).with_for_update()):
        target.requested += 1
        target.due_at = target.pending_since = utcnow()
        target.blocked = target.access_blocked = False
        target.error = target.access_error = ""
        target.attempts = target.access_attempts = 0
        target.access_requested += 1
        target.access_due_at = utcnow()
    audit(db, user, "sheets.connect", "club")
    return RedirectResponse(destination, status_code=303)


@router.delete(CONNECTION_PATH)
def disconnect(request: Request, user=Depends(officer), db=Depends(get_db, scope="function")):
    connection = lock_connection(db)
    connection.refresh_token = None
    connection.generation += 1
    connection.error = ""
    db.execute(delete(SheetsOAuthFlow))
    audit(db, user, "sheets.disconnect", "club")
    return {"ok": True}


def sheet_view(db, event, target):
    catalog = column_catalog(event)
    columns = target.columns if target else catalog
    status = "not_configured"
    if target:
        status = (
            "paused" if not target.enabled else "attention" if target.blocked else
            "retrying" if target.error else "provisioning" if not target.spreadsheet_id else
            "pending" if target.requested > target.completed else "synced"
        )
    return {
        "configured": bool(target), "enabled": target.enabled if target else False,
        "revision": target.revision if target else None, "columns": columns, "catalog": catalog,
        "spreadsheet_url": f"https://docs.google.com/spreadsheets/d/{target.spreadsheet_id}/edit"
        if target and target.spreadsheet_id else None,
        "status": status, "last_synced_at": target.last_synced_at if target else None,
        "pending_since": target.pending_since if target else None, "error": target.error if target else "",
        "sharing_pending": bool(target and target.access_requested > target.access_completed),
        "sharing_error": target.access_error if target else "",
        "preview": [row[1:] for row in signup_rows(db, event.id, catalog, limit=3)],
    }


@router.get("/events/{eid}/google-sheet", response_model=EventSheetView)
def event_sheet(eid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    event = require(db, Event, eid)
    return sheet_view(db, event, db.scalar(select(EventSheet).where(EventSheet.event_id == eid)))


@router.put("/events/{eid}/google-sheet", response_model=EventSheetView)
def configure(eid: int, value: EventSheetWrite, request: Request, user=Depends(officer),
              db=Depends(get_db, scope="function")):
    connected(request, db)
    event = require(db, Event, eid, True)
    if not event.signups_enabled:
        fail(409, "signups_disabled", "Enable event signups before configuring Google Sheets.")
    keys = {c["key"] for c in column_catalog(event)}
    if any(c.key not in keys for c in value.columns):
        fail(422, "sheet_column", "A selected column is no longer available. Reload the event.")
    target = db.scalar(select(EventSheet).where(EventSheet.event_id == eid).with_for_update())
    if target:
        if value.expected_revision != target.revision:
            fail(409, "stale_revision", "Google Sheets settings changed. Reload before saving.")
        target.revision += 1
        target.requested += 1
        target.due_at = utcnow()
        target.pending_since = target.pending_since or utcnow()
        target.error, target.blocked, target.attempts = "", False, 0
        target.access_requested += 1
        target.access_due_at = utcnow()
        target.access_error, target.access_blocked, target.access_attempts = "", False, 0
    else:
        target = EventSheet(
            event_id=eid,
            title=f"AAC — {event.name} — {event.starts_at.astimezone(PACIFIC).date()} — {event.id}",
        )
        db.add(target)
    target.columns = [c.model_dump() for c in value.columns]
    target.enabled = value.enabled
    db.flush()
    audit(db, user, "sheets.configure", eid, {"enabled": value.enabled, "columns": [c.key for c in value.columns]})
    return sheet_view(db, event, target)


@router.post("/events/{eid}/google-sheet/sync", response_model=EventSheetView)
def sync(eid: int, value: Revision, request: Request, user=Depends(officer),
         db=Depends(get_db, scope="function")):
    connected(request, db)
    event = require(db, Event, eid)
    target = db.scalar(select(EventSheet).where(EventSheet.event_id == eid).with_for_update())
    if not target:
        fail(409, "sheet_missing", "Configure a spreadsheet first.")
    if value.expected_revision != target.revision:
        fail(409, "stale_revision", "Google Sheets settings changed. Reload before syncing.")
    target.requested += 1
    target.access_requested += 1
    target.due_at = target.access_due_at = utcnow()
    target.pending_since = target.pending_since or utcnow()
    target.error = target.access_error = ""
    target.blocked = target.access_blocked = False
    target.attempts = target.access_attempts = 0
    audit(db, user, "sheets.sync", eid)
    db.flush()
    return sheet_view(db, event, target)
