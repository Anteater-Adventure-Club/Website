from decimal import Decimal
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from ..auth import member, officer
from ..db import get_db
from ..domain import (
    PACIFIC,
    advisory,
    audit,
    default_quarter,
    fail,
    open_quarter,
    page,
    require,
    revision,
    today,
)
from ..models import DriverRegistration, Event, Member, Payout, Quarter, Trip
from ..schemas import (
    Items,
    TripRow,
    QuarterReport,
    MyReimbursements,
    MembershipBenefitView,
    EligibilityWrite,
    MileageWrite,
    OfficerGrant,
    Page,
    PaymentWrite,
    QuarterPrivate,
    QuarterPublic,
    QuarterWrite,
    TripCreate,
    TripWrite,
)
from ..services.finance import report, trip_cost

router = APIRouter(prefix="/api")


@router.get("/quarters", response_model=Page[QuarterPublic])
def quarters(
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    db=Depends(get_db, scope="function"),
):
    return page(db, select(Quarter).order_by(Quarter.starts_on.desc()), limit, offset)


@router.get("/admin/quarters", response_model=Page[QuarterPrivate])
def admin_quarters(user=Depends(officer), db=Depends(get_db, scope="function")):
    return page(db, select(Quarter).order_by(Quarter.starts_on.desc()), 200, 0)


def validate_quarter(db, value, existing=None):
    advisory(db, 702)
    overlap = select(Quarter.id).where(Quarter.starts_on <= value.ends_on, Quarter.ends_on >= value.starts_on)
    if existing:
        overlap = overlap.where(Quarter.id != existing.id)
        for event in db.scalars(select(Event).where(Event.quarter_id == existing.id)):
            if (
                not value.starts_on
                <= event.starts_at.astimezone(PACIFIC).date()
                <= event.ends_at.astimezone(PACIFIC).date()
                <= value.ends_on
            ):
                fail(409, "event_outside_quarter", "These dates would exclude an existing event.")
    if db.scalar(overlap) is not None:
        fail(409, "quarter_overlap", "Quarter dates must not overlap.")


@router.post("/admin/quarters", response_model=QuarterPrivate, status_code=201)
def create_quarter(value: QuarterWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    validate_quarter(db, value)
    quarter = Quarter(**value.model_dump(exclude={"expected_revision"}))
    db.add(quarter)
    db.flush()
    audit(db, user, "quarter.create", quarter.id)
    return quarter


@router.put("/admin/quarters/{qid}", response_model=QuarterPrivate)
def edit_quarter(qid: int, value: QuarterWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    advisory(db, 702)
    q = open_quarter(db, qid)
    revision(q, value.expected_revision)
    validate_quarter(db, value, q)
    for key, val in value.model_dump(exclude={"expected_revision"}).items():
        setattr(q, key, val)
    q.revision += 1
    audit(db, user, "quarter.edit", qid)
    return q


@router.get("/membership-benefits", response_model=MembershipBenefitView)
def benefits(quarter_id: int | None = None, db=Depends(get_db, scope="function")):
    q = default_quarter(db, quarter_id)
    if not q:
        return {"quarter": None, "budget": "0.00", "coverage": "1.0000"}
    data = report(db, q)
    return {"quarter": QuarterPublic.model_validate(q), "budget": str(q.budget), "coverage": data["coverage"]}


@router.get("/admin/quarters/{qid}/reimbursements", response_model=QuarterReport)
def quarter_report(qid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    return report(db, require(db, Quarter, qid))


@router.get("/me/reimbursements", response_model=MyReimbursements)
def personal_report(quarter_id: int | None = None, user=Depends(member), db=Depends(get_db, scope="function")):
    q = default_quarter(db, quarter_id)
    if q is None:
        return {"quarter": None, "driver": None}
    data = report(db, q)
    row = next((r for r in data["drivers"] if r["member_id"] == user.id), None)
    return {
        "quarter": QuarterPublic.model_validate(q),
        "budget": data["budget"],
        "driver_cap": data["driver_cap"],
        "coverage": data["coverage"],
        "driver": row,
    }


@router.post("/admin/quarters/{qid}/drivers")
def register_driver(qid: int, value: OfficerGrant, user=Depends(officer), db=Depends(get_db, scope="function")):
    open_quarter(db, qid)
    require(db, Member, value.member_id)
    r = db.scalar(
        select(DriverRegistration).where(
            DriverRegistration.quarter_id == qid, DriverRegistration.member_id == value.member_id
        )
    )
    if r is None:
        r = DriverRegistration(quarter_id=qid, member_id=value.member_id)
        db.add(r)
        audit(db, user, "driver.register", value.member_id, {"quarter_id": qid})
    return {"member_id": value.member_id}


@router.put("/admin/quarters/{qid}/drivers/{mid}/eligibility")
def eligibility(qid: int, mid: int, value: EligibilityWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    register_driver(qid, OfficerGrant(member_id=mid), user, db)
    r = db.scalar(
        select(DriverRegistration).where(
            DriverRegistration.quarter_id == qid, DriverRegistration.member_id == mid
        )
    )
    r.eligible_override, r.reason = value.eligible_override, value.reason
    audit(
        db,
        user,
        "driver.eligibility",
        mid,
        {"quarter_id": qid, "eligible_override": value.eligible_override, "reason": value.reason},
    )
    return {"ok": True}


def financial_event(db, eid):
    e = require(db, Event, eid)
    q = open_quarter(db, e.quarter_id)
    e = require(db, Event, eid, True)
    if not e.signups_enabled:
        fail(409, "signups_disabled", "This event does not use trips.")
    return e, q


@router.put("/admin/events/{eid}/mileage")
def mileage(eid: int, value: MileageWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    e, q = financial_event(db, eid)
    revision(e, value.expected_revision)
    e.miles, e.gas_price, e.rate_override = value.miles, value.gas_price, value.rate_override
    e.revision += 1
    audit(db, user, "event.mileage", eid)
    return {"ok": True, "revision": e.revision}


@router.get("/admin/events/{eid}/trips", response_model=Items[TripRow])
def event_trips(eid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    e = require(db, Event, eid)
    if not e.signups_enabled:
        fail(409, "signups_disabled", "This event does not use trips.")
    q = require(db, Quarter, e.quarter_id)
    return {
        "items": [
            {
                "id": t.id,
                "member_id": m.id,
                "name": m.name,
                "cost": str(trip_cost(t, e, q)),
                "cost_override": str(t.cost_override) if t.cost_override is not None else None,
                "notes": t.notes,
                "source": t.source,
                "revision": t.revision,
            }
            for t, m in db.execute(select(Trip, Member).join(Member).where(Trip.event_id == eid))
        ]
    }


@router.post("/admin/events/{eid}/trips")
def add_trip(eid: int, value: TripCreate, user=Depends(officer), db=Depends(get_db, scope="function")):
    e, q = financial_event(db, eid)
    register_driver(q.id, OfficerGrant(member_id=value.member_id), user, db)
    t = db.scalar(select(Trip).where(Trip.event_id == eid, Trip.member_id == value.member_id))
    if t:
        fail(409, "trip_exists", "This member already has a trip for this event.")
    t = Trip(event_id=eid, member_id=value.member_id, cost_override=value.cost_override, notes=value.notes)
    db.add(t)
    db.flush()
    audit(db, user, "trip.create", t.id)
    return {"id": t.id, "revision": t.revision}


@router.put("/admin/trips/{tid}")
def edit_trip(tid: int, value: TripWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    t = require(db, Trip, tid)
    financial_event(db, t.event_id)
    t = require(db, Trip, tid, True)
    revision(t, value.expected_revision)
    t.cost_override, t.notes, t.edited = value.cost_override, value.notes, True
    t.revision += 1
    audit(db, user, "trip.edit", tid)
    return {"id": tid, "revision": t.revision}


@router.delete("/admin/trips/{tid}")
def remove_trip(tid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    t = require(db, Trip, tid)
    financial_event(db, t.event_id)
    db.delete(t)
    audit(db, user, "trip.remove", tid)
    return {"ok": True}


@router.post("/admin/quarters/{qid}/finalize", response_model=QuarterReport)
def finalize(qid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    q = require(db, Quarter, qid, True)
    if q.state != "open":
        return report(db, q)
    data = report(db, q)
    for row in data["drivers"]:
        snapshot = {k: row[k] for k in ("eligible", "nominal", "eligible_cost", "capped", "trips")}
        db.add(
            Payout(
                quarter_id=qid,
                member_id=row["member_id"],
                amount=Decimal(row["allocated"]),
                snapshot=snapshot,
            )
        )
    q.state = "finalized"
    q.revision += 1
    audit(db, user, "quarter.finalize", qid, {"allocated": data["totals"]["allocated"]})
    db.flush()
    return report(db, q)


@router.put("/admin/payouts/{pid}/payment")
def payment(pid: int, value: PaymentWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    p = require(db, Payout, pid)
    q = require(db, Quarter, p.quarter_id, True)
    p = require(db, Payout, pid, True)
    if q.state != "finalized" or p.amount <= 0:
        fail(409, "payment_unavailable", "Only positive finalized payouts can be marked paid.")
    if value.paid_on > today():
        fail(422, "future_payment", "A payment cannot be dated in the future.")
    if p.paid_on:
        if p.paid_on == value.paid_on and p.reference == value.reference:
            return {"ok": True}
        fail(409, "payment_recorded", "This payout already has a payment record.")
    p.paid_on, p.reference = value.paid_on, value.reference
    audit(db, user, "payout.payment", pid, {"paid_on": str(value.paid_on), "reference": value.reference})
    return {"ok": True}


@router.post("/admin/quarters/{qid}/archive")
def archive(qid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    q = require(db, Quarter, qid, True)
    if q.state == "archived":
        return {"ok": True}
    if q.state != "finalized":
        fail(409, "not_finalized", "Finalize this quarter before archiving.")
    if db.scalar(
        select(Payout.id)
        .where(Payout.quarter_id == qid, Payout.amount > 0, Payout.paid_on.is_(None))
        .limit(1)
    ):
        fail(409, "unpaid_payouts", "Record all positive payouts before archiving.")
    q.state = "archived"
    q.revision += 1
    audit(db, user, "quarter.archive", qid)
    return {"ok": True}
