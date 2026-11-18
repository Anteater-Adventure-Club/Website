"""Rental list filtering, paging and availability warnings."""

from bisect import bisect_right
from collections import defaultdict
from datetime import date
from sqlalchemy import func, or_, select
from ..domain import today
from ..models import GearItem, GearLine, GearRental, Member
from .gear import holds, usage_changes

WAITING = ("pending", "approved")


def overloaded_ranges(rows, current, quantity):
    """Disjoint inclusive ordinal ranges where reservations exceed stock."""
    intervals = []
    used = 0
    for day, change in usage_changes(rows, current, date.max):
        before = used
        used += change
        if before <= quantity < used:
            start = day
        elif used <= quantity < before:
            intervals.append((start, day - 1))
    return intervals


def at_risk(db, rental_ids, current):
    """Map affected line IDs to rental IDs, newest rental first for filtered pages."""
    waiting = db.execute(
        select(
            GearLine.id,
            GearLine.item_id,
            GearLine.type_id,
            GearItem.quantity,
            GearRental.member_id,
            GearRental.id.label("rental_id"),
            GearRental.start,
            GearRental.end,
        )
        .join_from(GearLine, GearRental)
        .join(GearItem)
        .where(GearRental.id.in_(rental_ids), GearLine.status.in_(WAITING), GearRental.end >= current)
        .order_by(GearRental.created_at.desc(), GearRental.id.desc())
    ).all()
    if not waiting:
        return {}
    quantities = {line.item_id: line.quantity for line in waiting}
    borrowers = {line.member_id for line in waiting}
    late = db.execute(
        select(GearLine.item_id, GearRental.member_id, GearLine.type_id)
        .join(GearRental)
        .where(
            GearLine.status == "picked_up",
            GearRental.end < current,
            or_(GearLine.item_id.in_(quantities), GearRental.member_id.in_(borrowers)),
        )
    ).all()
    if not late:
        return {}
    overdue_types = {(row.member_id, row.type_id) for row in late}
    overdue_items = quantities.keys() & {row.item_id for row in late}
    ranges = {}
    if overdue_items:
        by_item = defaultdict(list)
        for row in holds(db, current, max(line.end for line in waiting), item_ids=overdue_items):
            by_item[row.item_id].append(row)
        for iid, rows in by_item.items():
            ranges[iid] = overloaded_ranges(rows, current, quantities[iid])
    risky = {}
    for line in waiting:
        if (line.member_id, line.type_id) in overdue_types:
            risky[line.id] = line.rental_id
            continue
        intervals = ranges.get(line.item_id, ())
        # Last interval starting on or before the return date.
        index = bisect_right(intervals, (line.end.toordinal() + 1,)) - 1
        if index >= 0 and intervals[index][1] >= max(current, line.start).toordinal():
            risky[line.id] = line.rental_id
    return risky


def page(db, filters, member_id=None):
    current = today()
    query = select(GearRental.id).join(Member, Member.id == GearRental.member_id)
    if member_id is not None:
        query = query.where(GearRental.member_id == member_id)

    def has_line(condition):
        return select(GearLine.id).where(GearLine.rental_id == GearRental.id, condition).exists()

    if term := filters.search.strip():
        query = query.where(
            or_(
                Member.name.icontains(term, autoescape=True),
                GearRental.activity.icontains(term, autoescape=True),
                has_line(GearLine.name.icontains(term, autoescape=True)),
            )
        )
    if filters.status == "at_risk":
        risks = at_risk(db, query, current)
        ids = list(dict.fromkeys(risks.values()))
        end = None if filters.limit is None else filters.offset + filters.limit
        return {"total": len(ids), "items": views(db, ids[filters.offset : end], current, risks)}

    if filters.status in ("missed", "overdue"):
        state = GearLine.status.in_(WAITING) if filters.status == "missed" else GearLine.status == "picked_up"
        query = query.where(GearRental.end < current, has_line(state))
    elif filters.status != "all":
        query = query.where(has_line(GearLine.status == filters.status))
        if filters.status == "pending":
            query = query.where(GearRental.end >= current)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    ids = (
        query.order_by(GearRental.created_at.desc(), GearRental.id.desc())
        .limit(filters.limit)
        .offset(filters.offset)
    )
    return {"total": total, "items": views(db, ids, current)}


def views(db, rental_ids, current=None, risks=None):
    current = current or today()
    rows = db.execute(
        select(GearRental, Member.name, GearLine)
        .join(Member, Member.id == GearRental.member_id)
        .join(GearLine, GearLine.rental_id == GearRental.id)
        .where(GearRental.id.in_(rental_ids))
        .order_by(GearRental.created_at.desc(), GearRental.id.desc(), GearLine.id)
    ).all()
    if risks is None:
        waiting = {r.id for r, _, line in rows if line.status in WAITING and r.end >= current}
        risks = at_risk(db, waiting, current) if waiting else {}
    records = {}
    for rental, name, line in rows:
        if rental.id not in records:
            records[rental.id] = {
                key: getattr(rental, key)
                for key in (
                    "id",
                    "start",
                    "end",
                    "activity",
                    "comments",
                    "revision",
                    "member_id",
                    "created_at",
                )
            }
            records[rental.id].update(member_name=name, lines=[])
        payload = {
            key: getattr(line, key)
            for key in ("id", "item_id", "copy_number", "name", "type_name", "ownership", "message", "status")
        }
        payload.update(
            overdue=line.status == "picked_up" and rental.end < current,
            missed=line.status in WAITING and rental.end < current,
            at_risk=line.id in risks,
        )
        records[rental.id]["lines"].append(payload)
    for record in records.values():
        statuses = {line["status"] for line in record["lines"]}
        record["status"] = statuses.pop() if len(statuses) == 1 else "mixed"
    return list(records.values())
