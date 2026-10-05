from typing import Annotated
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from ..auth import limited, member, officer, uci_email
from ..db import get_db
from ..domain import (
    advisory,
    audit,
    default_quarter,
    ensure_member,
    ensure_membership,
    fail,
    open_quarter,
    page,
    require,
    today,
    utcnow,
)
from ..models import Audit, Event, Member, Membership, Officer, Receipt, Signup, Vehicle
from ..projections import event_projection, membership_view, signups_projection
from ..schemas import (
    Items,
    OfficerView,
    MemberList,
    MemberDetail,
    MyOverview,
    MemberInput,
    MemberPrivate,
    MembershipDecision,
    MembershipSubmit,
    MembershipView,
    OfficerGrant,
    Page,
    PayoutDetailsWrite,
    ProfileWrite,
    VehicleView,
    VehicleWrite,
)

router = APIRouter(prefix="/api")


@router.get("/me/profile", response_model=MemberPrivate)
def own_profile(user=Depends(member)):
    return user


@router.put("/me/profile", response_model=MemberPrivate)
def save_profile(value: ProfileWrite, user=Depends(member), db=Depends(get_db, scope="function")):
    for key, v in value.model_dump().items():
        setattr(user, key, v)
    audit(db, user, "profile.edit", user.id)
    return user


@router.put("/me/payout-details", response_model=MemberPrivate)
def payout_details(value: PayoutDetailsWrite, user=Depends(member), db=Depends(get_db, scope="function")):
    for key, v in value.model_dump().items():
        setattr(user, key, v)
    audit(db, user, "profile.payout", user.id)
    return user


@router.get("/me/vehicles", response_model=Page[VehicleView])
def own_vehicles(user=Depends(member), db=Depends(get_db, scope="function")):
    return page(
        db,
        select(Vehicle).where(Vehicle.member_id == user.id, Vehicle.removed.is_(False)).order_by(Vehicle.id),
        200,
        0,
    )


@router.post("/me/vehicles", response_model=VehicleView, status_code=201)
def add_vehicle(value: VehicleWrite, user=Depends(member), db=Depends(get_db, scope="function")):
    v = Vehicle(member_id=user.id, **value.model_dump())
    db.add(v)
    db.flush()
    return v


@router.put("/me/vehicles/{vid}", response_model=VehicleView)
def edit_vehicle(vid: int, value: VehicleWrite, user=Depends(member), db=Depends(get_db, scope="function")):
    v = require(db, Vehicle, vid, True)
    if v.member_id != user.id or v.removed:
        fail(404, "not_found", "This car could not be found.")
    for key, val in value.model_dump().items():
        setattr(v, key, val)
    return v


@router.delete("/me/vehicles/{vid}")
def remove_vehicle(vid: int, user=Depends(member), db=Depends(get_db, scope="function")):
    v = require(db, Vehicle, vid, True)
    if v.member_id != user.id:
        fail(404, "not_found", "This car could not be found.")
    v.removed = True
    return {"ok": True}


@router.get("/me/memberships/{qid}", response_model=MembershipView)
def own_membership(qid: int, user=Depends(member), db=Depends(get_db, scope="function")):
    from ..models import Quarter

    require(db, Quarter, qid)
    return membership_view(db, user.id, qid)


@router.post("/me/memberships/{qid}", response_model=MembershipView)
def submit_dues(qid: int, value: MembershipSubmit, user=Depends(member), db=Depends(get_db, scope="function")):
    open_quarter(db, qid)
    phone = value.phone if value.phone is not None else user.phone.strip()
    if not phone:
        fail(422, "phone_required", "Enter your contact phone number on the dues form.")
    m = ensure_membership(db, user.id, qid)
    if m.status == "approved":
        return membership_view(db, user.id, qid)
    if value.phone is not None and user.phone != phone:
        user.phone = phone
        audit(db, user, "profile.edit", user.id)
    if m.status != "pending":
        m.status, m.student, m.method, m.submitted_at = "pending", value.student, value.method, utcnow()
        audit(db, user, "membership.submit", m.id)
    db.flush()
    return membership_view(db, user.id, qid)


@router.post("/admin/members/{mid}/memberships/{qid}/decision", response_model=MembershipView)
def decide_dues(mid: int, qid: int, value: MembershipDecision, user=Depends(officer), db=Depends(get_db, scope="function")):
    open_quarter(db, qid)
    require(db, Member, mid)
    m = ensure_membership(db, mid, qid)
    existing = list(
        db.scalars(
            select(Receipt)
            .where(Receipt.membership_id == m.id, Receipt.voided.is_(False))
            .order_by(Receipt.id)
        )
    )
    if value.category == "payment" and value.paid_on > today():
        fail(422, "future_payment", "Dues cannot be dated in the future.")
    if existing:
        previous = existing[-1]
        if (
            value.category == "payment"
            and previous.amount == value.amount
            and previous.paid_on == value.paid_on
            and previous.method == value.method
            and previous.reference == value.reference
        ):
            return membership_view(db, mid, qid)
        if not value.reason.strip():
            fail(422, "correction_reason", "Explain the correction to preserve receipt history.")
        for receipt in existing:
            receipt.voided = True
    if value.category == "payment":
        db.add(
            Receipt(
                membership_id=m.id,
                amount=value.amount,
                paid_on=value.paid_on,
                method=value.method,
                reference=value.reference,
                actor_id=user.id,
                correction_of=existing[-1].id if existing else None,
                reason=value.reason,
            )
        )
        m.status, m.source = "approved", "payment"
        m.method = value.method
    elif value.category == "exception":
        m.status, m.source, m.method = "approved", "exception", ""
    else:
        m.status, m.source, m.method = "general", None, ""
    m.student, m.reason = value.student, value.reason
    audit(db, user, "membership.decision", m.id, {"category": value.category, "reason": value.reason})
    db.flush()
    return membership_view(db, mid, qid)


@router.post("/admin/members", response_model=MemberPrivate, status_code=201)
def add_member(value: MemberInput, user=Depends(officer), db=Depends(get_db, scope="function")):
    m = ensure_member(db, value)
    audit(db, user, "member.add", m.id)
    return m


@router.get("/admin/members", response_model=MemberList)
def member_list(
    quarter_id: int | None = None,
    search: str = "",
    status: str = "all",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user=Depends(officer),
    db=Depends(get_db, scope="function"),
):
    q = default_quarter(db, quarter_id)
    query = select(Member)
    if search:
        query = query.where(
            Member.name.ilike("%" + search[:100] + "%") | Member.email.ilike("%" + search[:100] + "%")
        )
    if q and status != "all":
        query = query.outerjoin(
            Membership, (Membership.member_id == Member.id) & (Membership.quarter_id == q.id)
        )
        if status == "general":
            query = query.where((Membership.id.is_(None)) | (Membership.status == "general"))
        elif status == "exception":
            query = query.where(Membership.source == "exception", Membership.status == "approved")
        elif status == "paid":
            query = query.where(Membership.status == "approved", Membership.source != "exception")
        else:
            query = query.where(Membership.status == status)
    result = page(db, query.order_by(Member.name, Member.id), limit, offset)
    result["items"] = [
        {
            "member": MemberPrivate.model_validate(m),
            "membership": membership_view(db, m.id, q.id) if q else None,
        }
        for m in result["items"]
    ]
    result["quarter_id"] = q.id if q else None
    return result


@router.get("/admin/members/{mid}", response_model=MemberDetail)
def member_detail(mid: int, quarter_id: int | None = None, user=Depends(officer), db=Depends(get_db, scope="function")):
    m = require(db, Member, mid)
    q = default_quarter(db, quarter_id)
    history = list(
        db.scalars(
            select(Signup)
            .join(Event)
            .where(Signup.member_id == mid)
            .order_by(Event.starts_at.desc())
            .limit(200)
        )
    )
    return {
        "member": MemberPrivate.model_validate(m),
        "membership": membership_view(db, mid, q.id) if q else None,
        "memberships": [
            membership_view(db, mid, qid)
            for qid in db.scalars(select(Membership.quarter_id).where(Membership.member_id == mid))
        ],
        "signups": signups_projection(db, history),
        "officer": db.get(Officer, mid) is not None,
    }


@router.get("/admin/members/{mid}/vehicles", response_model=Page[VehicleView])
def member_vehicles(mid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    require(db, Member, mid)
    return page(
        db,
        select(Vehicle).where(Vehicle.member_id == mid, Vehicle.removed.is_(False)).order_by(Vehicle.id),
        200,
        0,
    )


@router.post("/admin/members/{mid}/vehicles", response_model=VehicleView)
def officer_vehicle(mid: int, value: VehicleWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    require(db, Member, mid)
    v = Vehicle(member_id=mid, source="officer", **value.model_dump())
    db.add(v)
    db.flush()
    audit(db, user, "vehicle.create", v.id, {"member_id": mid})
    return v


def grant(db, mid, actor):
    advisory(db, 700)
    m = require(db, Member, mid)
    if not uci_email(m.email):
        fail(422, "uci_required", "Officer access requires a UCI email address.")
    if db.get(Officer, mid) is None:
        db.add(Officer(member_id=mid))
        audit(db, actor, "officer.grant", mid)
        db.flush()


def revoke(db, mid, actor):
    advisory(db, 700)
    record = db.get(Officer, mid)
    if record:
        if db.scalar(select(func.count()).select_from(Officer)) <= 1:
            fail(409, "last_officer", "Keep at least one officer with site access.")
        db.delete(record)
        audit(db, actor, "officer.revoke", mid)
        db.flush()


@router.get("/admin/officers", response_model=Items[OfficerView])
def officers(user=Depends(officer), db=Depends(get_db, scope="function")):
    return {
        "items": [
            {"member_id": m.id, "name": m.name, "email": m.email, "granted_at": o.granted_at}
            for o, m in db.execute(select(Officer, Member).join(Member))
        ]
    }


@router.post("/admin/officers")
def grant_officer(value: OfficerGrant, user=Depends(officer), db=Depends(get_db, scope="function")):
    grant(db, value.member_id, user)
    return {"ok": True}


@router.delete("/admin/officers/{mid}")
def revoke_officer(mid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    revoke(db, mid, user)
    return {"ok": True}


@router.get("/admin/audit/recent")
def audit_recent(user=Depends(officer), db=Depends(get_db, scope="function")):
    return {
        "items": [
            {
                "id": a.id,
                "actor_id": a.actor_id,
                "action": a.action,
                "entity": a.entity,
                "data": a.data,
                "at": a.at,
            }
            for a in db.scalars(select(Audit).order_by(Audit.at.desc(), Audit.id.desc()).limit(100))
        ]
    }


@router.get("/me/overview", response_model=MyOverview)
def overview(quarter_id: int | None = None, user=Depends(member), db=Depends(get_db, scope="function")):
    q = default_quarter(db, quarter_id)
    n = utcnow()
    events = list(
        db.scalars(
            select(Event)
            .where(Event.state == "published", Event.skipped.is_(False), Event.ends_at >= n)
            .order_by(Event.starts_at)
            .limit(200)
        )
    )
    open_events = [
        e
        for e in events
        if e.signups_enabled and (not e.opens_at or e.opens_at <= n) and (e.closes_at or e.starts_at) > n
    ]
    next_event = (open_events or events or [None])[0]
    signups = list(
        db.scalars(
            select(Signup)
            .join(Event)
            .where(Signup.member_id == user.id, Event.ends_at >= n, Signup.cancelled.is_(False))
            .order_by(Event.starts_at)
            .limit(10)
        )
    )
    return {
        "quarter_id": q.id if q else None,
        "membership": membership_view(db, user.id, q.id) if q else None,
        "next_event": event_projection(db, next_event) if next_event else None,
        "signups": signups_projection(db, signups, True),
    }


@router.get("/admin/directory")
async def directory(request: Request, email: str, user=Depends(officer), db=Depends(get_db, scope="function")):
    from ..services.directory import DirectoryUnavailable, lookup_name

    limited(request, db, "directory", 20)
    email = email.strip().lower()
    if not uci_email(email):
        fail(422, "uci_required", "Enter an exact UCI email address.")
    try:
        name = await lookup_name(email)
    except DirectoryUnavailable:
        return {"email": email, "name": None, "status": "unavailable"}
    return {"email": email, "name": name, "status": "found" if name else "no_exact_match"}
