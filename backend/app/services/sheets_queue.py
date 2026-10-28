"""Collect export changes at flush, and enqueue using the caller's transaction."""
from datetime import timedelta
from sqlalchemy import event, func, inspect, select, update
from sqlalchemy.orm import Session
from ..domain import utcnow
from ..models import Event, EventForm, EventFormResponse, EventFormSheet, EventSheet, Member, Officer, Signup

_installed = False
MEMBER_FIELDS = ("name", "email", "phone")
SIGNUP_FIELDS = ("role", "answers", "notes", "joined_at", "registered_at", "cancelled", "member_id", "event_id")


def schedule_form_transitions(connection, event_ids):
    now = utcnow()
    for eid in event_ids:
        times = connection.execute(select(EventForm.opens_at, EventForm.closes_at).join(EventFormSheet).where(
            EventForm.event_id == eid, EventForm.state == "published", EventFormSheet.enabled.is_(True),
        )).all()
        upcoming = [t for pair in times for t in pair if t > now]
        connection.execute(update(EventSheet).where(EventSheet.event_id == eid).values(
            next_form_transition_at=min(upcoming) if upcoming else None,
        ))


def enqueue_data(connection, condition, immediate=False):
    now = utcnow()
    connection.execute(update(EventSheet).where(condition).values(
        requested=EventSheet.requested + 1,
        due_at=now if immediate else func.coalesce(EventSheet.due_at, now + timedelta(seconds=30)),
        pending_since=func.coalesce(EventSheet.pending_since, now),
    ))


def enqueue_access(connection, condition=True, *, source_changed=False):
    values = {"access_requested": EventSheet.access_requested + 1,
              "access_due_at": func.coalesce(EventSheet.access_due_at, utcnow())}
    if source_changed:
        values.update(access_due_at=utcnow(), access_blocked=False, access_error="", access_attempts=0)
    connection.execute(update(EventSheet).where(condition).values(
        **values,
    ))


def changed(obj, fields):
    state = inspect(obj)
    return any(state.attrs[key].history.has_changes() for key in fields)


def before_flush(db, context, instances):
    changes = db.info.setdefault("sheet_changes", {"events": set(), "members": set(), "questions": {},
                                                "deleted_targets": set(), "officers": False, "form_config": set()})
    for obj in db.new.union(db.dirty).union(db.deleted):
        new_or_deleted = obj in db.new or obj in db.deleted
        if isinstance(obj, EventForm):
            changes["events"].add(obj.event_id)
            changes["form_config"].add(obj.event_id)
        elif isinstance(obj, (EventFormResponse, EventFormSheet)):
            eid = db.connection().scalar(select(EventForm.event_id).where(EventForm.id == obj.form_id))
            if eid:
                changes["events"].add(eid)
                if isinstance(obj, EventFormSheet):
                    changes["form_config"].add(eid)
        elif isinstance(obj, Signup) and (new_or_deleted or changed(obj, SIGNUP_FIELDS)):
            if obj.event_id is not None:
                changes["events"].add(obj.event_id)
            changes["events"].update(inspect(obj).attrs.event_id.history.deleted)
        elif isinstance(obj, Member) and changed(obj, MEMBER_FIELDS) and obj.id is not None:
            changes["members"].add(obj.id)
            if changed(obj, ("email",)):
                changes["officers"] = True
        elif isinstance(obj, Officer) and new_or_deleted:
            changes["officers"] = True
        elif isinstance(obj, Event):
            if obj in db.deleted:
                changes["deleted_targets"].update(db.connection().scalars(
                    select(EventSheet.id).where(EventSheet.event_id == obj.id)
                ))
            elif changed(obj, ("questions",)) and obj.id is not None:
                changes["events"].add(obj.id)
                changes["questions"][obj.id] = {"question:" + q["id"] for q in obj.questions}


def after_flush(db, context):
    changes = db.info.pop("sheet_changes", None)
    if not changes:
        return
    conn = db.connection()
    if changes["members"]:
        changes["events"].update(conn.scalars(select(Signup.event_id).where(
            Signup.member_id.in_(changes["members"])
        )))
    if changes["events"]:
        enqueue_data(conn, EventSheet.event_id.in_(changes["events"]))
    if changes["form_config"]:
        conn.execute(update(EventSheet).where(EventSheet.event_id.in_(changes["form_config"])).values(
            revision=EventSheet.revision + 1,
        ))
        schedule_form_transitions(conn, changes["form_config"])
    for eid, valid_questions in changes["questions"].items():
        rows = conn.execute(select(EventSheet.id, EventSheet.columns).where(
            EventSheet.event_id == eid
        ).with_for_update()).all()
        for sid, columns in rows:
            remaining = [c for c in columns if not c["key"].startswith("question:") or c["key"] in valid_questions]
            if remaining != columns:
                conn.execute(update(EventSheet).where(EventSheet.id == sid).values(
                    columns=remaining, revision=EventSheet.revision + 1,
                ))
    if changes["officers"]:
        enqueue_access(conn, source_changed=True)
    if changes["deleted_targets"]:
        condition = EventSheet.id.in_(changes["deleted_targets"])
        conn.execute(update(EventSheet).where(condition).values(
            enabled=False, due_at=None, pending_since=None,
            access_blocked=False, access_error="", access_due_at=utcnow(),
        ))
        enqueue_access(conn, condition)


def install_hooks():
    global _installed
    if not _installed:
        event.listen(Session, "before_flush", before_flush)
        event.listen(Session, "after_flush_postexec", after_flush)
        event.listen(Session, "after_soft_rollback", lambda db, previous: db.info.pop("sheet_changes", None))
        _installed = True
