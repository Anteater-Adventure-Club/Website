from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy import select
from ..domain import CENT, allocate
from ..models import DriverRegistration, Event, Member, Membership, Payout, Trip


def rate(event, quarter):
    return (
        event.rate_override
        if event.rate_override is not None
        else (event.gas_price / quarter.mpg).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
    )


def trip_cost(trip, event, quarter):
    return (
        trip.cost_override
        if trip.cost_override is not None
        else (event.miles * rate(event, quarter)).quantize(CENT, rounding=ROUND_HALF_UP)
    )


def report(db, quarter):
    if not quarter.reimbursement_data_available:
        return {
            "quarter_id": quarter.id,
            "state": quarter.state,
            "reimbursement_data_available": False,
            "budget": None, "driver_cap": None, "coverage": None, "totals": None,
            "drivers": [], "events": [],
        }
    events = {e.id: e for e in db.scalars(select(Event).where(Event.quarter_id == quarter.id))}
    registrations = list(
        db.scalars(select(DriverRegistration).where(DriverRegistration.quarter_id == quarter.id))
    )
    trips = list(db.scalars(select(Trip).where(Trip.event_id.in_(events)))) if events else []
    member_ids = {r.member_id for r in registrations} | {t.member_id for t in trips}
    members = {m.id: m for m in db.scalars(select(Member).where(Member.id.in_(member_ids)))}
    memberships = {
        m.member_id: m
        for m in db.scalars(
            select(Membership).where(
                Membership.quarter_id == quarter.id, Membership.member_id.in_(member_ids)
            )
        )
    }
    overrides = {r.member_id: r for r in registrations}
    payouts = {p.member_id: p for p in db.scalars(select(Payout).where(Payout.quarter_id == quarter.id))}
    costs, details = {mid: Decimal(0) for mid in member_ids}, {mid: [] for mid in member_ids}
    for trip in trips:
        event = events[trip.event_id]
        cost = trip_cost(trip, event, quarter)
        costs[trip.member_id] += cost
        details[trip.member_id].append(
            {
                "id": trip.id,
                "event_id": event.id,
                "event_name": event.name,
                "starts_at": event.starts_at.isoformat(),
                "miles": str(event.miles),
                "rate": str(rate(event, quarter)),
                "cost": str(cost),
                "cost_override": str(trip.cost_override) if trip.cost_override is not None else None,
                "notes": trip.notes,
                "source": trip.source,
                "revision": trip.revision,
            }
        )
    eligible = {
        mid: (
            overrides[mid].eligible_override
            if mid in overrides and overrides[mid].eligible_override is not None
            else mid in memberships and memberships[mid].status == "approved"
        )
        for mid in member_ids
    }
    eligible_costs = {mid: costs[mid] if eligible[mid] else Decimal(0) for mid in member_ids}
    allocated = allocate(eligible_costs, quarter.budget, quarter.driver_cap)
    capped = {
        mid: min(c, quarter.driver_cap) if quarter.driver_cap else c for mid, c in eligible_costs.items()
    }
    denominator = sum(capped.values(), Decimal(0))
    coverage = min(Decimal(1), quarter.budget / denominator) if denominator else Decimal(1)
    rows = []
    for mid in sorted(member_ids, key=lambda mid: (members[mid].name.casefold(), mid)):
        payout = payouts.get(mid)
        frozen = payout.snapshot if payout else None
        m = members[mid]
        rows.append(
            {
                "member_id": mid,
                "name": m.name,
                "email": m.email,
                "payout_method": m.payout_method,
                "payout_destination": m.payout_destination,
                "payout_phone_suffix": m.payout_phone_suffix,
                "membership_approved": mid in memberships and memberships[mid].status == "approved",
                "eligible": frozen["eligible"] if frozen else eligible[mid],
                "eligible_override": overrides[mid].eligible_override if mid in overrides else None,
                "eligibility_reason": overrides[mid].reason if mid in overrides else "",
                "nominal": frozen["nominal"] if frozen else str(costs[mid]),
                "eligible_cost": frozen["eligible_cost"] if frozen else str(eligible_costs[mid]),
                "capped": frozen["capped"] if frozen else str(capped[mid]),
                "allocated": str(payout.amount) if payout else str(allocated[mid]),
                "payout_id": payout.id if payout else None,
                "paid_on": payout.paid_on.isoformat() if payout and payout.paid_on else None,
                "reference": payout.reference if payout else "",
                "trips": frozen["trips"] if frozen else details[mid],
            }
        )
    totals = {
        key: str(sum((Decimal(row[key]) for row in rows), Decimal(0)).quantize(CENT))
        for key in ("nominal", "eligible_cost", "capped", "allocated")
    }
    totals["paid"] = str(
        sum((Decimal(r["allocated"]) for r in rows if r["paid_on"]), Decimal(0)).quantize(CENT)
    )
    totals["pending"] = str(Decimal(totals["allocated"]) - Decimal(totals["paid"]))
    return {
        "quarter_id": quarter.id,
        "state": quarter.state,
        "reimbursement_data_available": True,
        "budget": str(quarter.budget),
        "driver_cap": str(quarter.driver_cap),
        "coverage": str(coverage.quantize(Decimal("0.0001"))),
        "totals": totals,
        "drivers": rows,
        "events": [
            {
                "id": e.id,
                "name": e.name,
                "starts_at": e.starts_at.isoformat(),
                "miles": str(e.miles),
                "rate": str(rate(e, quarter)),
                "trip_count": sum(t.event_id == e.id for t in trips),
                "cost": str(sum((trip_cost(t, e, quarter) for t in trips if t.event_id == e.id), Decimal(0))),
            }
            for e in sorted(events.values(), key=lambda e: e.starts_at)
            if e.signups_enabled
        ],
    }
