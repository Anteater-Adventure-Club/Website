import csv
import hashlib
import io
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import func, select
from ..auth import member, officer
from ..db import get_db
from ..domain import audit, default_quarter, ensure_member, fail, operational_event, page, require, utcnow
from ..models import AttendanceAction, Audit, Card, Event, Member, Signup, Vehicle
from ..projections import event_projection, signup_projection, signups_projection
from ..schemas import (
    AttendanceLogRow,
    QuestionAnswers,
    Page,
    SignupOwn,
    SignupPrivate,
    CheckInView,
    AssignmentWrite,
    CardsWrite,
    CardVoid,
    ExtensionWrite,
    OfficerSignup,
    Revision,
    SignupWrite,
    WalkInWrite,
)
from ..services.participation import (
    arrive,
    assign,
    cancel_signup,
    extension_chips,
    fill_remaining,
    next_card,
    save_signup,
    undo,
)

router = APIRouter(prefix="/api")


@router.put("/events/{eid}/signup", response_model=SignupOwn)
def self_signup(eid: int, value: SignupWrite, user=Depends(member), db=Depends(get_db, scope="function")):
    e = operational_event(db, eid)
    s = save_signup(db, e, user, value)
    audit(db, user, "signup.save", s.id)
    return signup_projection(db, s, True)


@router.delete("/events/{eid}/signup")
def self_cancel(eid: int, user=Depends(member), db=Depends(get_db, scope="function")):
    e = operational_event(db, eid)
    s = db.scalar(select(Signup).where(Signup.event_id == eid, Signup.member_id == user.id))
    if s:
        cancel_signup(db, s, e, user, True)
    return {"ok": True}


@router.get("/me/signups", response_model=Page[SignupOwn])
def own_signups(
    quarter_id: int | None = None,
    event_id: int | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user=Depends(member),
    db=Depends(get_db, scope="function"),
):
    query = select(Signup).join(Event).where(Signup.member_id == user.id)
    if event_id is not None:
        query = query.where(Signup.event_id == event_id)
    if quarter_id:
        default_quarter(db, quarter_id)
        query = query.where(Event.quarter_id == quarter_id)
    result = page(db, query.order_by(Event.starts_at.desc()), limit, offset)
    result["items"] = signups_projection(db, result["items"], True)
    return result


@router.get("/admin/events/{eid}/signups", response_model=Page[SignupPrivate])
def roster(
    eid: int,
    search: str = "",
    role: str | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user=Depends(officer),
    db=Depends(get_db, scope="function"),
):
    e = require(db, Event, eid)
    if not e.signups_enabled:
        fail(409, "signups_disabled", "This event does not use signups.")
    query = select(Signup).join(Member).where(Signup.event_id == eid)
    if search:
        query = query.where(Member.name.ilike("%" + search[:100] + "%"))
    if role:
        query = query.where(Signup.role == role)
    result = page(db, query.order_by(Signup.joined_at, Signup.id), limit, offset)
    result["items"] = signups_projection(db, result["items"])
    return result


@router.post("/admin/events/{eid}/signups", response_model=SignupPrivate)
def add_signup(eid: int, value: OfficerSignup, user=Depends(officer), db=Depends(get_db, scope="function")):
    e = operational_event(db, eid)
    target = require(db, Member, value.member_id)
    s = save_signup(db, e, target, value, True, "officer")
    audit(db, user, "signup.add", s.id)
    return signup_projection(db, s)


@router.delete("/admin/signups/{sid}")
def remove_signup(sid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    s = require(db, Signup, sid)
    e = operational_event(db, s.event_id)
    db.refresh(s)
    cancel_signup(db, s, e, user)
    return {"ok": True}


@router.get("/admin/events/{eid}/check-in", response_model=CheckInView)
def check_in_state(eid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    e = require(db, Event, eid)
    if not e.signups_enabled:
        fail(409, "signups_disabled", "This event does not use attendance.")
    rows = list(
        db.scalars(
            select(Signup)
            .where(Signup.event_id == eid, Signup.cancelled.is_(False))
            .order_by(Signup.joined_at, Signup.id)
        )
    )
    cards = list(db.scalars(select(Card).where(Card.event_id == eid).order_by(Card.number)))
    return {
        "event": event_projection(db, e, True),
        "revision": e.revision,
        "server_time": utcnow(),
        "signups": signups_projection(db, rows, include_event=False),
        "counts": {
            role: {
                "registered": sum(s.role == role for s in rows),
                "arrived": sum(s.role == role and bool(s.checked_in_at) for s in rows),
            }
            for role in ("ride", "driver", "own")
        },
        "next_cards": {category: next_card(db, e, category) for category in ("paid", "general")},
        "inventory": {"paid": e.paid_cards, "general": e.general_cards},
        "cards": [
            {"category": c.category, "number": c.number, "signup_id": c.signup_id, "voided": c.voided}
            for c in cards
        ],
        "extension_chips": extension_chips(e),
    }


@router.post("/admin/signups/{sid}/check-in", response_model=SignupPrivate)
def check_in(sid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    s = require(db, Signup, sid)
    e = operational_event(db, s.event_id)
    db.refresh(s)
    return signup_projection(db, arrive(db, e, s, user))


@router.delete("/admin/signups/{sid}/check-in")
def undo_check_in(sid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    s = require(db, Signup, sid)
    e = operational_event(db, s.event_id)
    db.refresh(s)
    undo(db, e, s, user)
    return {"ok": True}


@router.post("/admin/signups/{sid}/extension", response_model=SignupPrivate)
def extend(sid: int, value: ExtensionWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    s = require(db, Signup, sid)
    e = operational_event(db, s.event_id)
    db.refresh(s)
    if s.role != "ride" or s.cancelled or s.checked_in_at:
        fail(409, "extension_unavailable", "Only an absent active rider can receive an extension.")
    if value.until not in extension_chips(e) or not value.reason.strip():
        fail(422, "extension_chip", "Choose a current future time chip and enter a reason.")
    s.extended_until, s.extension_reason = value.until, value.reason.strip()
    s.revision += 1
    e.revision += 1
    audit(db, user, "attendance.extension", s.id, {"until": value.until.isoformat(), "reason": value.reason})
    return signup_projection(db, s)


@router.put("/admin/events/{eid}/cards")
def inventory(eid: int, value: CardsWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    e = operational_event(db, eid, value.expected_revision)
    for role, count in (("general", value.general_cards), ("paid", value.paid_cards)):
        maximum = (
            db.scalar(select(func.max(Card.number)).where(Card.event_id == eid, Card.category == role)) or 0
        )
        if count < maximum:
            fail(409, "cards_used", "Inventory cannot shrink below issued or voided numbers.")
    e.general_cards, e.paid_cards = value.general_cards, value.paid_cards
    e.revision += 1
    audit(db, user, "cards.inventory", eid)
    return {"ok": True}


@router.post("/admin/events/{eid}/cards/void")
def void_card(eid: int, value: CardVoid, user=Depends(officer), db=Depends(get_db, scope="function")):
    e = operational_event(db, eid, value.expected_revision)
    maximum = e.paid_cards if value.category == "paid" else e.general_cards
    if value.number > maximum:
        fail(422, "card_range", "The card is outside this inventory.")
    existing = db.scalar(
        select(Card).where(Card.event_id == eid, Card.category == value.category, Card.number == value.number)
    )
    if existing and existing.signup_id:
        fail(409, "card_issued", "Issued cards may only be voided by undoing check-in.")
    if existing is None:
        db.add(Card(event_id=eid, category=value.category, number=value.number, voided=True))
        e.revision += 1
        audit(db, user, "cards.void", eid, {"category": value.category, "number": value.number})
    return {"ok": True}


@router.put("/admin/events/{eid}/carpools/{rider_id}")
def seat_rider(eid: int, rider_id: int, value: AssignmentWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    e = operational_event(db, eid, value.expected_revision)
    s = require(db, Signup, rider_id)
    driver = require(db, Signup, value.driver_signup_id) if value.driver_signup_id else None
    assign(db, e, s, driver)
    audit(db, user, "carpool.assign", s.id, {"driver_signup_id": value.driver_signup_id})
    return {"revision": e.revision, "signup": signup_projection(db, s)}


@router.post("/admin/events/{eid}/carpools/fill")
def fill(eid: int, value: Revision, user=Depends(officer), db=Depends(get_db, scope="function")):
    e = operational_event(db, eid, value.expected_revision)
    count = fill_remaining(db, e)
    audit(db, user, "carpool.fill", eid, {"new_assignments": count})
    return {"revision": e.revision, "filled": count}


@router.post("/admin/events/{eid}/walk-ins", response_model=SignupPrivate)
def walk_in(eid: int, value: WalkInWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    e = operational_event(db, eid)
    key = hashlib.sha256(f"{eid}:{user.id}:{value.request_id}".encode()).hexdigest()
    previous = db.scalar(select(Audit).where(Audit.action == "attendance.walk-in", Audit.entity == key))
    if previous:
        return signup_projection(db, require(db, Signup, previous.data["signup_id"]))
    target = (
        require(db, Member, value.member_id)
        if value.member_id
        else ensure_member(db, value.member)
        if value.member
        else None
    )
    if target is None:
        fail(422, "member_required", "Choose or enter a member.")
    if value.vehicle:
        vehicle = Vehicle(member_id=target.id, source="officer", **value.vehicle.model_dump())
        db.add(vehicle)
        db.flush()
        value.signup.vehicle_id = vehicle.id
    s = save_signup(db, e, target, value.signup, True, "walk-in")
    arrive(db, e, s, user)
    audit(db, user, "attendance.walk-in", key, {"signup_id": s.id})
    return signup_projection(db, s)


@router.get("/admin/events/{eid}/check-in-log", response_model=Page[AttendanceLogRow])
def attendance_log(
    eid: int,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user=Depends(officer),
    db=Depends(get_db, scope="function"),
):
    require(db, Event, eid)
    result = page(
        db,
        select(AttendanceAction).where(AttendanceAction.event_id == eid).order_by(AttendanceAction.at.desc()),
        limit,
        offset,
    )
    actions = result["items"]
    signups = {
        s.id: s for s in db.scalars(select(Signup).where(Signup.id.in_([a.signup_id for a in actions])))
    }
    people = {
        m.id: m
        for m in db.scalars(
            select(Member).where(
                Member.id.in_({a.actor_id for a in actions} | {s.member_id for s in signups.values()})
            )
        )
    }
    result["items"] = [
        {
            "id": a.id,
            "signup_id": a.signup_id,
            "actor": people[a.actor_id].name,
            "name": people[signups[a.signup_id].member_id].name,
            "action": a.action,
            "at": a.at,
        }
        for a in actions
    ]
    return result


@router.get("/admin/events/{eid}/questions", response_model=QuestionAnswers)
def answers(eid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    e = require(db, Event, eid)
    rows = list(
        db.execute(
            select(Signup, Member).join(Member).where(Signup.event_id == eid, Signup.cancelled.is_(False))
        )
    )
    return {
        "questions": e.questions,
        "items": [{"signup_id": s.id, "name": m.name, "answers": s.answers} for s, m in rows],
        "totals": {
            q["id"]: {
                answer: sum(s.answers.get(q["id"]) == answer for s, _ in rows)
                for answer in set(s.answers.get(q["id"], "") for s, _ in rows)
            }
            for q in e.questions
        },
    }


def safe_cell(value):
    value = str(value or "")
    return "'" + value if value.lstrip().startswith(("=", "+", "-", "@", "\t", "\r")) else value


@router.get("/admin/events/{eid}/signups.csv")
def export(eid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    e = require(db, Event, eid)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ["Name", "Email", "Phone", "Transport", "Seats", "Checked in", "Cancelled"]
        + [q["label"] for q in e.questions]
    )
    for s, m in db.execute(
        select(Signup, Member).join(Member).where(Signup.event_id == eid).order_by(Signup.id)
    ):
        writer.writerow(
            [
                safe_cell(v)
                for v in [m.name, m.email, m.phone, s.role, s.seats, s.checked_in_at, s.cancelled]
                + [s.answers.get(q["id"], "") for q in e.questions]
            ]
        )
    return Response(
        output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="event-{eid}-signups.csv"',
            "Cache-Control": "no-store",
        },
    )
