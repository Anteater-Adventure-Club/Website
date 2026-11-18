"""Reservation rules shared by catalog, member requests and officer operations."""

from collections import Counter, defaultdict
from datetime import date
from sqlalchemy import func, or_, select
from ..domain import advisory, audit, fail, paid, require, revision, today, utcnow
from ..models import GearItem, GearLine, GearRental, GearType, Membership, Quarter
from .approval import enforce_approval
from . import gear_custody as custody

ACTIVE = ("pending", "approved", "picked_up")
TRANSITIONS = {
    "approve": ({"pending"}, "approved"),
    "deny": ({"pending"}, "denied"),
    "cancel": ({"pending", "approved"}, "cancelled"),
    "pickup": ({"approved"}, "picked_up"),
    "return": ({"picked_up"}, "returned"),
}


def lock_gear(db, *, shared=False):
    # All gear writers take this transaction lock before reading stock or revisions.
    advisory(db, 759, shared=shared)


def member_access(db, mid):
    day = today()
    quarters = select(Quarter).where(Quarter.ends_on >= day).order_by(Quarter.starts_on).limit(1)
    paid_quarter = db.scalar(
        quarters.join(Membership).where(Membership.member_id == mid, Membership.status == "approved")
    )
    quarter = paid_quarter or db.scalar(quarters)
    return {
        "first_pickup": max(day, paid_quarter.starts_on) if paid_quarter else None,
        "quarter_id": quarter.id if quarter else None,
        "quarter_name": quarter.name if quarter else None,
    }


def eligibility(db, mid, start, lock=False):
    query = select(Quarter).where(Quarter.starts_on <= start, Quarter.ends_on >= start).order_by(Quarter.id)
    q = db.scalars(query.with_for_update() if lock else query).first()
    return q, bool(q and paid(db, mid, q.id))


def require_eligible(db, mid, start):
    enforce_approval(db, mid)
    if not eligibility(db, mid, start, lock=True)[1]:
        fail(403, "gear_membership", "Approved paid membership is required for the pickup quarter.")


def validate_dates(start, end, *, allow_past=False):
    if end < start or (not allow_past and start < today()):
        fail(422, "gear_dates", "Choose a pickup today or later and a return on or after pickup.")


def validate_duration(start, end, reason):
    if (end - start).days >= 7 and not reason:
        fail(422, "gear_duration", "For more than seven days, contact an officer for a duration exception.")


def holds(db, start, end, exclude=None, *, item_ids=None):
    query = (
        select(
            GearLine.item_id,
            GearLine.type_id,
            GearRental.member_id,
            GearRental.start,
            GearRental.end,
            GearLine.status,
        )
        .join(GearRental)
        .where(
            GearLine.status.in_(ACTIVE),
            GearRental.start <= end,
            or_(GearRental.end >= start, GearLine.status == "picked_up"),
        )
    )
    if item_ids is not None:
        query = query.where(GearLine.item_id.in_(item_ids))
    if exclude is not None:
        query = query.where(GearRental.id != exclude)
    return list(db.execute(query))


def effective_end(hold):
    return date.max if hold.status == "picked_up" and hold.end < today() else hold.end


def usage_changes(rows, start, end):
    changes = Counter()
    for row in rows:
        first, last = max(row.start, start), min(effective_end(row), end)
        if first <= last:
            changes[first.toordinal()] += 1
            changes[last.toordinal() + 1] -= 1
    return sorted(changes.items())


def peak(rows, start, end):
    used = maximum = 0
    for _, change in usage_changes(rows, start, end):
        used += change
        maximum = max(maximum, used)
    return maximum


def loan_covers(item, start, end):
    return item.ownership == "club" or item.loan_start <= start <= end <= item.loan_end


def stock(db, mid, start, end, exclude=None):
    by_item = defaultdict(list)
    member_types = set()
    for row in holds(db, start, end, exclude):
        if effective_end(row) < start:
            continue
        by_item[row.item_id].append(row)
        if row.member_id == mid:
            member_types.add(row.type_id)
    return by_item, member_types


def catalog(db, mid, start, end):
    validate_dates(start, end)
    quarter, eligible = eligibility(db, mid, start)
    result = dict(
        quarter_id=quarter.id if quarter else None,
        quarter_name=quarter.name if quarter else None,
        eligible=eligible,
        items=[],
    )
    if not eligible:
        return result
    by_item, member_types = stock(db, mid, start, end)
    for item, kind in db.execute(
        select(GearItem, GearType)
        .join(GearType)
        .where(
            GearItem.rentable,
            ~GearItem.archived,
            or_(GearItem.ownership == "club", (GearItem.loan_start <= start) & (GearItem.loan_end >= end)),
        )
        .order_by(GearType.name, GearItem.name, GearItem.id)
    ):
        remaining = item.quantity - peak(by_item[item.id], start, end)
        result["items"].append(
            dict(
                id=item.id,
                type_id=kind.id,
                type_name=kind.name,
                name=item.name,
                description=item.description,
                ownership=item.ownership,
                available=max(0, remaining),
                type_reserved=item.type_id in member_types,
            )
        )
    return result


def check_items(db, mid, start, end, items, *, exclude=None, new=False):
    by_item, member_types = stock(db, mid, start, end, exclude)
    for item in items:
        if item.type_id in member_types:
            fail(
                409, "gear_type_reserved", "You can borrow only one item of each type for overlapping dates."
            )
        member_types.add(item.type_id)
        if (
            item.archived
            or (new and not item.rentable)
            or not loan_covers(item, start, end)
            or peak(by_item[item.id], start, end) >= item.quantity
        ):
            fail(
                409,
                "gear_unavailable",
                f"{item.name} is unavailable for those dates. Choose another item or dates.",
            )


def create(db, actor, value, *, assigned=False):
    lock_gear(db)
    mid = value.member_id if assigned else actor.id
    validate_dates(value.start, value.end)
    reason = value.reason if assigned else ""
    validate_duration(value.start, value.end, reason)
    require_eligible(db, mid, value.start)
    items = [require(db, GearItem, i) for i in value.item_ids]
    check_items(db, mid, value.start, value.end, items, new=True)
    rental = GearRental(
        member_id=mid,
        created_by=actor.id,
        start=value.start,
        end=value.end,
        activity=value.activity,
        comments=value.comments,
    )
    db.add(rental)
    db.flush()
    for item in items:
        db.add(
            GearLine(
                rental_id=rental.id,
                item_id=item.id,
                type_id=item.type_id,
                name=item.name,
                type_name=require(db, GearType, item.type_id).name,
                ownership=item.ownership,
                status="approved" if assigned else "pending",
                reviewed_by=actor.id if assigned else None,
                reviewed_at=utcnow() if assigned else None,
            )
        )
    audit(
        db,
        actor,
        "gear.assign" if assigned else "gear.request",
        rental.id,
        {"item_ids": value.item_ids, "reason": reason, "member_id": mid},
    )
    db.flush()
    return rental


def rental_lines(db, rid):
    return list(db.scalars(select(GearLine).where(GearLine.rental_id == rid).order_by(GearLine.id)))


def rental_or_404(db, rid, mid=None):
    query = select(GearRental).where(GearRental.id == rid)
    if mid is not None:
        query = query.where(GearRental.member_id == mid)
    rental = db.scalar(query)
    if rental is None:
        fail(404, "not_found", "This rental could not be found.")
    return rental


def reserved_items(db, lines):
    items = []
    for line in lines:
        item = require(db, GearItem, line.item_id)
        if item.type_id != line.type_id:
            fail(409, "gear_type_changed",
                 f"The gear type for {line.name} has changed. Cancel this item and request or assign a replacement.")
        items.append(item)
    return items


def change(db, actor, rid, value, *, own=False):
    lock_gear(db)
    rental = rental_or_404(db, rid, actor.id if own else None)
    revision(rental, value.expected_revision)
    action = "cancel" if own else value.action
    sources, target = TRANSITIONS[action]
    selected = [line for line in rental_lines(db, rid) if line.id in value.line_ids]
    if len(selected) != len(value.line_ids) or any(line.status not in sources for line in selected):
        fail(409, "gear_transition", "Refresh the rental and select items eligible for this action.")
    if action in {"approve", "pickup"}:
        if today() > rental.end or (action == "pickup" and today() < rental.start):
            fail(
                409, "gear_handoff_date", "Check the rental dates before approving or handing out this item."
            )
        require_eligible(db, rental.member_id, rental.start)
        check_items(
            db,
            rental.member_id,
            max(today(), rental.start),
            rental.end,
            reserved_items(db, selected),
            exclude=rid,
        )
    message = "" if own else value.message
    handoffs = {}
    if action == "return":
        receiver = value.return_to if "return_to" in value.model_fields_set else actor.id
        custody.check_officer(db, receiver)
    if action == "pickup" and value.pickup_copies.keys() - set(value.line_ids):
        fail(422, "gear_copy", "Select copies only for the items being picked up.")
    for line in selected:
        if action in {"approve", "deny"}:
            line.reviewed_at, line.reviewed_by, line.message = utcnow(), actor.id, message
        elif action == "pickup":
            handoffs[line.id] = custody.pickup(db, line, value.pickup_copies.get(line.id))
            line.picked_up_at, line.picked_up_by = utcnow(), actor.id
        elif action == "return":
            handoffs[line.id] = custody.receive(db, line, receiver)
            line.returned_at, line.returned_by = utcnow(), actor.id
        elif message:
            line.message = message
        line.status = target
    rental.revision += 1
    audit(db, actor, f"gear.{action}", rid, {"line_ids": value.line_ids, "message": message, "handoffs": handoffs})
    db.flush()
    return rental


def reschedule(db, actor, rid, value):
    lock_gear(db)
    rental = require(db, GearRental, rid)
    revision(rental, value.expected_revision)
    lines = rental_lines(db, rid)
    active = [line for line in lines if line.status in ACTIVE]
    began = any(line.picked_up_at for line in lines)
    if not active or (began and value.start != rental.start) or value.end < today():
        fail(
            409,
            "gear_dates",
            "Keep the original pickup date after handoff and choose an active rental period.",
        )
    validate_dates(value.start, value.end, allow_past=value.start == rental.start)
    validate_duration(value.start, value.end, value.reason)
    require_eligible(db, rental.member_id, value.start)
    check_items(db, rental.member_id, value.start, value.end, reserved_items(db, active), exclude=rid)
    audit(
        db,
        actor,
        "gear.dates",
        rid,
        {
            "from": [str(rental.start), str(rental.end)],
            "to": [str(value.start), str(value.end)],
            "reason": value.reason,
        },
    )
    rental.start, rental.end = value.start, value.end
    rental.revision += 1
    db.flush()
    return rental


def write_type(db, actor, value, tid=None):
    lock_gear(db)
    query = select(GearType.id).where(func.lower(GearType.name) == value.name.lower())
    if tid:
        query = query.where(GearType.id != tid)
    if db.scalar(query):
        fail(409, "gear_type_name", "A gear type with this name already exists.")
    kind = require(db, GearType, tid) if tid else GearType()
    if tid:
        revision(kind, value.expected_revision)
        kind.revision += 1
    kind.name = value.name
    db.add(kind)
    db.flush()
    audit(db, actor, "gear.type", kind.id, {"name": kind.name})
    return kind


def write_item(db, actor, value, iid=None):
    lock_gear(db)
    require(db, GearType, value.type_id)
    item = require(db, GearItem, iid) if iid else GearItem()
    if iid:
        revision(item, value.expected_revision)
        custody.check_reduction(db, item, value.quantity)
        reservations = [row for row in holds(db, today(), date.max) if row.item_id == iid]
        if reservations and (
            value.archived
            or item.ownership != value.ownership
            or item.owner != value.owner
            or item.type_id != value.type_id
            or (value.quantity < item.quantity and value.quantity < peak(reservations, today(), date.max))
            or any(not loan_covers(value, row.start, row.end) for row in reservations)
        ):
            fail(
                409,
                "gear_committed",
                "This edit conflicts with existing rentals. Resolve those rentals first.",
            )
        item.revision += 1
    data = value.model_dump(exclude={"expected_revision"})
    for key, val in data.items():
        setattr(item, key, val)
    db.add(item)
    db.flush()
    audit(db, actor, "gear.inventory", item.id, value.model_dump(mode="json", exclude={"expected_revision"}))
    return item


def attention(db):
    results = []
    for label, status, condition, title in (
        ("pending", "pending", GearRental.end >= today(), "Gear rentals waiting for approval"),
        ("overdue", "picked_up", GearRental.end < today(), "Gear rentals with overdue items"),
    ):
        count = db.scalar(
            select(func.count(func.distinct(GearLine.rental_id)))
            .join(GearRental)
            .where(GearLine.status == status, condition)
        )
        if count:
            results.append(dict(kind="gear", count=count, title=title, url=f"/admin/gear?status={label}"))
    return results
