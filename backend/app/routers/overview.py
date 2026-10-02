from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from ..auth import officer
from ..db import get_db
from ..domain import default_quarter, utcnow
from ..models import Event, Member, Membership, Receipt, Recap, Signup
from ..projections import events_projection
from ..services.finance import report
from ..schemas import AdminOverview

router = APIRouter(prefix="/api/admin")


@router.get("/overview", response_model=AdminOverview)
def overview(quarter_id: int | None = None, user=Depends(officer), db=Depends(get_db, scope="function")):
    q = default_quarter(db, quarter_id)
    if q is None:
        return {"quarter_id": None, "statistics": {}, "events": [], "attention": []}
    events = list(
        db.scalars(
            select(Event).where(Event.quarter_id == q.id, Event.skipped.is_(False)).order_by(Event.starts_at)
        )
    )
    memberships = list(db.scalars(select(Membership).where(Membership.quarter_id == q.id)))
    collected = db.scalar(
        select(func.sum(Receipt.amount))
        .join(Membership)
        .where(Membership.quarter_id == q.id, Receipt.voided.is_(False))
    ) or Decimal(0)
    money = report(db, q)
    pending = sum(m.status == "pending" for m in memberships)
    published_recaps = set(db.scalars(select(Recap.event_id).where(Recap.published.is_not(None))))
    projections = events_projection(db, events, True)
    attention = []
    if pending:
        attention.append(
            {
                "kind": "dues",
                "count": pending,
                "title": "Dues waiting for approval",
                "url": f"/admin/members?quarter={q.id}&status=pending",
            }
        )
    draft_series = {}
    for e in projections:
        if e.state == "draft":
            if e.series_id and e.series_id in draft_series:
                draft_series[e.series_id]["count"] += 1
            else:
                item = {
                    "kind": "draft",
                    "count": 1,
                    "title": e.name + (" has draft dates" if e.series_id else " is a draft"),
                    "url": f"/admin/series/{e.series_id}" if e.series_id else f"/admin/events/{e.slug}/{e.id}/edit",
                }
                attention.append(item)
                if e.series_id:
                    draft_series[e.series_id] = item
        if e.state == "completed" and e.id not in published_recaps:
            attention.append(
                {
                    "kind": "recap",
                    "count": 1,
                    "title": e.name + " needs a recap",
                    "url": f"/admin/events/{e.slug}/{e.id}?tab=recap",
                }
            )
        if e.state == "published" and e.paid_riders > e.offered_seats:
            attention.append(
                {
                    "kind": "seats",
                    "count": e.paid_riders - e.offered_seats,
                    "title": e.name + " needs more seats",
                    "url": f"/admin/events/{e.slug}/{e.id}?tab=carpools",
                }
            )
    n = utcnow()
    upcoming = [e for e in projections if e.state == "published" and e.ends_at >= n][:8]
    return {
        "quarter_id": q.id,
        "reimbursement_data_available": q.reimbursement_data_available,
        "statistics": {
            "members": db.scalar(select(func.count()).select_from(Member)),
            # Any signup counts, including cancellations and unknown historical attendance.
            "quarter_members": db.scalar(
                select(func.count(func.distinct(Signup.member_id)))
                .join(Event, Event.id == Signup.event_id)
                .where(Event.quarter_id == q.id)
            ),
            "paid": sum(m.status == "approved" and m.source != "exception" for m in memberships),
            "exceptions": sum(m.status == "approved" and m.source == "exception" for m in memberships),
            "pending": pending,
            "dues_collected": str(collected),
            "budget": money["budget"],
            "allocated": money["totals"]["allocated"] if money["totals"] is not None else None,
            "event_count": len(events),
        },
        "events": upcoming,
        "attention": attention,
    }
