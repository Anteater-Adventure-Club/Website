"""Opt-in structured API logs. Browser signals are not reservation records."""
import json
import logging
import sys
from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy import event as sqlalchemy_event
from sqlalchemy.orm import Session

from ..auth import session_member_id
from ..db import get_db
from ..domain import utcnow
from ..models import Event, Member

logger = logging.getLogger("aac.event_activity")
if not logger.handlers:
    logger.addHandler(logging.StreamHandler(sys.stdout))
logger.setLevel(logging.INFO)
logger.propagate = False


def emit(action, **fields):
    logger.info(json.dumps({"type": "event_activity", "at": utcnow().isoformat(), "action": action, **fields}))


def identity(member):
    return {"member_id": member.id if member else None, "member_name": member.name if member else None}


def queue_signup_activity(db, event, signup, member, actor, action, **fields):
    if event.activity_logging:
        db.info.setdefault("event_activity_pending", []).append({
            "action": action, "event_id": event.id, "signup_id": signup.id,
            "request_id": db.info.get("request_id"), "attempt_id": db.info.get("activity_attempt_id"),
            **identity(member), "actor_id": actor.id if actor else None,
            "role": signup.role, "authoritative": True, **fields,
        })


@sqlalchemy_event.listens_for(Session, "after_commit")
def committed(db):
    for record in db.info.pop("event_activity_pending", []):
        emit(**record)


@sqlalchemy_event.listens_for(Session, "after_rollback")
def rolled_back(db):
    db.info.pop("event_activity_pending", None)


def track_signup_request(eid: int, request: Request, db=Depends(get_db, scope="function")):
    event = db.get(Event, eid)
    if event is None or not event.activity_logging:
        return
    mid = session_member_id(request)
    user = db.get(Member, mid) if isinstance(mid, int) else None
    try:
        attempt_id = str(UUID(request.headers.get("X-AAC-Attempt-ID", "")))
    except ValueError:
        attempt_id = None
    db.info["activity_attempt_id"] = attempt_id
    context = {"event_id": eid, "request_id": request.state.request_id, "attempt_id": attempt_id,
               "method": request.method, **identity(user)}
    request.state.event_activity = context
    emit("signup.request", **context, authoritative=False)
