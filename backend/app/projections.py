from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from .services.finance import rate
from sqlalchemy import and_, func, select
from .domain import slug, utcnow
from .models import Assignment, Card, Event, Member, Membership, Receipt, Recap, Signup, Quarter
from .schemas import EventPrivate, EventPublic, MembershipView, ReceiptView


def membership_view(db, mid, qid):
    m = db.scalar(select(Membership).where(Membership.member_id == mid, Membership.quarter_id == qid))
    if m is None:
        return MembershipView(quarter_id=qid, status="general")
    receipts = db.scalars(
        select(Receipt).where(Receipt.membership_id == m.id).order_by(Receipt.created_at.desc())
    )
    return MembershipView(
        quarter_id=qid,
        status=m.status,
        source=m.source,
        student=m.student,
        method=m.method,
        submitted_at=m.submitted_at,
        reason=m.reason,
        receipts=[ReceiptView.model_validate(r) for r in receipts],
    )


def signup_window(e):
    n = utcnow()
    if not e.signups_enabled:
        return "disabled"
    if e.state != "published" or e.skipped:
        return e.state
    if e.opens_at and n < e.opens_at:
        return "not_open"
    if n >= (e.closes_at or e.starts_at):
        return "closed"
    return "open"


def attendance_status(signup, event):
    if signup.cancelled or event.state == "cancelled":
        return "cancelled"
    if signup.checked_in_at:
        return "attended" if event.state == "completed" else "checked_in"
    if event.state == "completed":
        return "missed" if event.completion is not None else "unknown"
    return "registered"


def events_projection(db, events, private=False):
    if not events:
        return []
    ids = [e.id for e in events]
    totals = {row.event_id: row for row in db.execute(
        select(
            Signup.event_id,
            func.count().label("signup_count"),
            func.coalesce(func.sum(Signup.seats).filter(Signup.role == "driver"), 0).label("offered_seats"),
        )
        .where(Signup.event_id.in_(ids), Signup.cancelled.is_(False))
        .group_by(Signup.event_id)
    )}
    paid_counts = dict(db.execute(
        select(Signup.event_id, func.count())
        .join(Event, Event.id == Signup.event_id)
        .join(Membership, and_(Membership.member_id == Signup.member_id, Membership.quarter_id == Event.quarter_id))
        .where(Signup.event_id.in_(ids), Signup.role == "ride", Signup.cancelled.is_(False), Membership.status == "approved")
        .group_by(Signup.event_id)
    ).all())
    recaps = {r.event_id: r.published for r in db.scalars(select(Recap).where(Recap.event_id.in_(ids)))}
    values = []
    for e in events:
        data = {k: getattr(e, k) for k in EventPublic.model_fields if hasattr(e, k)}
        paid_riders = paid_counts.get(e.id, 0)
        total = totals.get(e.id)
        offered_seats = total.offered_seats if total else 0
        data.update(
            slug=slug(e.name),
            signup_status=signup_window(e),
            signup_count=total.signup_count if total else 0,
            offered_seats=offered_seats,
            paid_riders=paid_riders,
            paid_ride_guaranteed=offered_seats >= paid_riders and paid_riders > 0,
            published_recap=recaps.get(e.id),
        )
        if private:
            data.update({k: getattr(e, k) for k in EventPrivate.model_fields if k not in data})
        values.append((EventPrivate if private else EventPublic)(**data))
    return values


def event_projection(db, e, private=False):
    return events_projection(db, [e], private)[0]


def signups_projection(db, signups, own=False, include_event=True):
    """Build rosters with grouped queries instead of a query per person."""
    if not signups:
        return []
    event_ids = {s.event_id for s in signups}
    events = {e.id: e for e in db.scalars(select(Event).where(Event.id.in_(event_ids)))}
    quarters = {
        q.id: q
        for q in db.scalars(select(Quarter).where(Quarter.id.in_({e.quarter_id for e in events.values()})))
    }
    selected_ids = {s.id for s in signups}
    driver_ids = {s.id for s in signups if s.role == "driver" and s.checked_in_at}
    own_assignments = list(db.scalars(select(Assignment).where(Assignment.rider_id.in_(selected_ids))))
    driver_ids.update(a.driver_id for a in own_assignments)
    assignments = {a.rider_id: a for a in own_assignments}
    if driver_ids:
        assignments.update({a.rider_id: a for a in db.scalars(select(Assignment).where(Assignment.driver_id.in_(driver_ids)))})
    related_ids = selected_ids | driver_ids | set(assignments)
    related = {s.id: s for s in signups}
    if related_ids - selected_ids:
        related.update({s.id: s for s in db.scalars(select(Signup).where(Signup.id.in_(related_ids - selected_ids)))})
    members = {
        m.id: m
        for m in db.scalars(select(Member).where(Member.id.in_({s.member_id for s in related.values()})))
    }
    cards = {
        c.signup_id: c
        for c in db.scalars(select(Card).where(Card.signup_id.in_(selected_ids), Card.voided.is_(False)))
    }
    approved = set(
        db.execute(
            select(Membership.member_id, Membership.quarter_id).where(
                Membership.member_id.in_({s.member_id for s in signups}),
                Membership.quarter_id.in_({e.quarter_id for e in events.values()}),
                Membership.status == "approved",
            )
        ).all()
    )
    public_events = (
        {e.id: e.model_dump(mode="json") for e in events_projection(db, list(events.values()))}
        if include_event
        else {}
    )
    n = utcnow()
    result = []
    for s in signups:
        e, m, card, assignment = (
            events[s.event_id],
            members[s.member_id],
            cards.get(s.id),
            assignments.get(s.id),
        )
        car = None
        driver = (
            related[assignment.driver_id]
            if assignment
            else s
            if s.role == "driver" and s.checked_in_at
            else None
        )
        if driver:
            car = {
                "driver_name": members[driver.member_id].name,
                "vehicle": driver.vehicle,
                "passengers": sorted(
                    [
                        {"signup_id": rider.id, "name": members[rider.member_id].name}
                        for a in assignments.values()
                        if a.driver_id == s.id
                        and (rider := related[a.rider_id]).event_id == s.event_id
                        and rider.role == "ride"
                        and rider.checked_in_at
                        and not rider.cancelled
                    ],
                    key=lambda passenger: (passenger["name"].casefold(), passenger["signup_id"]),
                ) if s.role == "driver" and s.id == driver.id and not s.cancelled else [],
                "co_riders": [
                    members[related[a.rider_id].member_id].name.split()[0]
                    for a in assignments.values()
                    if a.driver_id == driver.id and a.rider_id != s.id
                ],
            }
        released = (
            e.state == "published"
            and s.role == "ride"
            and not s.checked_in_at
            and e.departure_at
            and n >= (s.extended_until or e.departure_at - timedelta(minutes=10))
        )
        result.append(
            {
                "id": s.id,
                "member_id": s.member_id,
                "event_id": s.event_id,
                "name": m.name,
                **({} if own else {"email": m.email, "phone": m.phone}),
                "role": s.role,
                "vehicle_id": s.vehicle_id,
                "vehicle": s.vehicle,
                "seats": s.seats,
                "answers": s.answers,
                "notes": s.notes,
                "cancelled": s.cancelled,
                "checked_in_at": s.checked_in_at,
                "joined_at": s.joined_at,
                "attendance_status": attendance_status(s, e),
                "extended_until": s.extended_until,
                "released": bool(released),
                "paid": (m.id, e.quarter_id) in approved,
                "revision": s.revision,
                "card": {"category": card.category, "number": card.number} if card else None,
                "assigned_car": car,
                "estimated_trip": str(
                    (e.miles * rate(e, quarters[e.quarter_id])).quantize(
                        Decimal("0.01"), rounding=ROUND_HALF_UP
                    )
                )
                if s.role == "driver" and quarters[e.quarter_id].reimbursement_data_available
                else None,
                "driver_signup_id": assignment.driver_id if assignment else None,
                "editable": e.state == "published"
                and not s.checked_in_at
                and n < (e.closes_at or e.starts_at),
                "event": public_events.get(e.id),
            }
        )
    return result


def signup_projection(db, signup, own=False, include_event=True):
    return signups_projection(db, [signup], own, include_event)[0]
