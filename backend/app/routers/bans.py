from fastapi import APIRouter, Depends
from sqlalchemy import select
from ..auth import member, officer
from ..db import get_db
from ..domain import audit, fail, require, utcnow
from ..models import Event, Member, MemberBan, Quarter
from ..schemas import BanLift, BanPreview, BanScope, BanView, BanWrite, Items, RestrictionView
from ..services.participation import cancel_signup, undo
from ..services.restrictions import active_bans, ban_view, impact, own_view, restriction_lock

router = APIRouter(prefix="/api")


def draft(db, mid, value, now):
    require(db, Member, mid)
    if value.expires_at and value.expires_at <= now:
        fail(422, "ban_expiry", "Choose an expiry in the future.")
    events = list(db.scalars(select(Event).where(Event.id.in_(value.event_ids)).order_by(Event.id)))
    if len(events) != len(value.event_ids) or any(e.state != "published" or e.skipped or e.starts_at < now for e in events):
        fail(422, "ban_events", "Choose published upcoming events. Refresh the event selection.")
    return MemberBan(member_id=mid, all_events=value.all_events, event_kinds=value.event_kinds,
                     events=[{"id": e.id, "name": e.name} for e in events], membership=value.membership,
                     created_at=now, expires_at=value.expires_at)


@router.get("/me/restrictions", response_model=Items[RestrictionView])
def own_restrictions(user=Depends(member), db=Depends(get_db, scope="function")):
    return {"items": [own_view(db, b) for b in active_bans(db, user.id)]}


@router.get("/admin/members/{mid}/bans", response_model=Items[BanView])
def history(mid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    require(db, Member, mid)
    return {"items": [ban_view(b) for b in db.scalars(
        select(MemberBan).where(MemberBan.member_id == mid).order_by(MemberBan.created_at.desc(), MemberBan.id.desc())
    )]}


@router.post("/admin/members/{mid}/bans/preview", response_model=BanPreview)
def preview(mid: int, value: BanScope, user=Depends(officer), db=Depends(get_db, scope="function")):
    now = utcnow()
    affected = impact(db, mid, draft(db, mid, value, now), now)
    return {"items": [{"signup_id": s.id, "event_id": e.id, "name": e.name, "starts_at": e.starts_at,
                       "checked_in": bool(s.checked_in_at)} for s, e in affected], "total": len(affected)}


@router.post("/admin/members/{mid}/bans", response_model=BanView, status_code=201)
def create(mid: int, value: BanWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    restriction_lock(db, exclusive=True)
    previous = db.scalar(select(MemberBan).where(MemberBan.request_id == value.request_id))
    if previous:
        if previous.member_id != mid or previous.created_by != user.id:
            fail(409, "ban_request", "Start a new ban request.")
        return ban_view(previous)
    now = utcnow()
    ban = draft(db, mid, value, now)
    ban.reason, ban.message = value.reason, value.message.strip()
    ban.created_by, ban.request_id = user.id, value.request_id
    affected = impact(db, mid, ban, now)
    # Keep the application's quarter -> event row-lock order, also across quarters.
    for qid in sorted({e.quarter_id for _, e in affected}):
        require(db, Quarter, qid, True)
    for eid in sorted({e.id for _, e in affected}):
        require(db, Event, eid, True)
    # Event edits/check-ins may have finished while locks were being acquired.
    affected = impact(db, mid, ban, now)
    cancelled = []
    for signup, event in affected:
        db.refresh(signup)
        if signup.checked_in_at:
            undo(db, event, signup, user)
        cancel_signup(db, signup, event, user)
        cancelled.append(signup.id)
    db.add(ban)
    db.flush()
    audit(db, user, "ban.create", ban.id, {**value.model_dump(mode="json"), "member_id": mid,
                                          "cancelled_signup_ids": cancelled})
    for sid in cancelled:
        audit(db, user, "signup.ban_cancel", sid, {"ban_id": ban.id, "member_id": mid})
    return ban_view(ban)


@router.post("/admin/members/{mid}/bans/{bid}/lift", response_model=BanView)
def lift(mid: int, bid: int, value: BanLift, user=Depends(officer), db=Depends(get_db, scope="function")):
    restriction_lock(db, exclusive=True)
    ban = require(db, MemberBan, bid, True)
    if ban.member_id != mid:
        fail(404, "not_found", "This ban could not be found.")
    if ban.lifted_at:
        return ban_view(ban)
    if ban.expires_at and ban.expires_at <= utcnow():
        fail(409, "ban_expired", "This ban has already expired.")
    ban.lifted_at, ban.lifted_by, ban.lift_reason = utcnow(), user.id, value.reason
    audit(db, user, "ban.lift", ban.id, {"member_id": mid, "reason": value.reason})
    return ban_view(ban)
