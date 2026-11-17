"""Unknown copies have no custody row. Checked-out copies are held by their rental borrower."""

from sqlalchemy import or_, select
from ..auth import allowed
from ..domain import audit, fail, require, revision, utcnow
from ..models import GearCustodian, GearItem, GearLine, GearRental, GuestOfficerAccess, Member, Officer


def holders(db):
    officers = db.execute(
        select(GearCustodian.item_id, GearCustodian.copy_number, Member.id, Member.name)
        .join(Member, Member.id == GearCustodian.officer_id)
    )
    borrowers = db.execute(
        select(GearLine.item_id, GearLine.copy_number, Member.id, Member.name)
        .join(GearRental, GearRental.id == GearLine.rental_id)
        .join(Member, Member.id == GearRental.member_id)
        .where(GearLine.status == "picked_up")
    )
    return [
        dict(item_id=iid, copy_number=number, holder_id=mid, name=name, kind=kind)
        for kind, rows in (("officer", officers), ("borrower", borrowers))
        for iid, number, mid, name in rows
    ]


def officers(db):
    rows = db.execute(
        select(Member.id, Member.name, Officer.member_id, GuestOfficerAccess.permissions)
        .outerjoin(Officer, Officer.member_id == Member.id)
        .outerjoin(GuestOfficerAccess, GuestOfficerAccess.member_id == Member.id)
        .where(Member.approval_status == "approved",
               or_(Officer.member_id.is_not(None), GuestOfficerAccess.expires_at > utcnow()))
        .order_by(Member.name, Member.id)
    )
    return [dict(id=mid, name=name) for mid, name, full, perms in rows if full or "gear" in (perms or [])]


def check_officer(db, mid):
    if mid is not None and not allowed(db, db.get(Member, mid), "gear"):
        fail(422, "gear_custodian", "Choose a current officer, gear helper, or Unknown.")


def checked_out(item_id):
    return select(GearLine.copy_number).where(GearLine.item_id == item_id, GearLine.status == "picked_up")


def validate_copy(item, number):
    if not 1 <= number <= item.quantity:
        fail(409, "gear_copy", "That copy is outside the current inventory quantity.")


def transfer(db, actor, item, number, value):
    revision(item, value.expected_revision)
    validate_copy(item, number)
    if db.scalar(checked_out(item.id).where(GearLine.copy_number == number)):
        fail(409, "gear_checked_out", "Record this copy’s return before changing its custodian.")
    row = db.get(GearCustodian, (item.id, number))
    previous = row.officer_id if row else None
    if previous == value.officer_id:
        return
    check_officer(db, value.officer_id)
    if value.officer_id is None:
        db.delete(row)
    elif row:
        row.officer_id = value.officer_id
    else:
        db.add(GearCustodian(item_id=item.id, copy_number=number, officer_id=value.officer_id))
    item.revision += 1
    audit(db, actor, "gear.custody", item.id, {"copy": number, "from": previous, "to": value.officer_id})


def pickup(db, line, choice):
    item = require(db, GearItem, line.item_id)
    out = set(db.scalars(checked_out(item.id)))
    if choice:
        revision(item, choice.expected_revision)
        number = choice.copy_number
        validate_copy(item, number)
    else:
        # Older clients can hand off interchangeable unknown copies or the only available copy.
        if item.quantity - len(out) > 1 and db.scalar(
            select(GearCustodian.copy_number).where(GearCustodian.item_id == item.id).limit(1)
        ):
            fail(409, "gear_copy_required", "Select the numbered copy being handed out.")
        number = next((n for n in range(1, item.quantity + 1) if n not in out), None)
    if number is None or number in out:
        fail(409, "gear_checked_out", "That copy is already checked out.")
    row = db.get(GearCustodian, (item.id, number))
    if row:
        db.delete(row)
    line.copy_number = number
    item.revision += 1
    return {"copy": number, "from_officer": row.officer_id if row else None}


def receive(db, line, receiver):
    if receiver is not None:
        db.add(GearCustodian(item_id=line.item_id, copy_number=line.copy_number, officer_id=receiver))
    return {"copy": line.copy_number, "to_officer": receiver}


def check_reduction(db, item, quantity):
    if quantity >= item.quantity:
        return
    known = select(GearCustodian.copy_number).where(
        GearCustodian.item_id == item.id, GearCustodian.copy_number > quantity
    ).limit(1)
    if db.scalar(known) or db.scalar(checked_out(item.id).where(GearLine.copy_number > quantity).limit(1)):
        fail(409, "gear_copy_in_use",
             "This would remove a numbered copy with a holder. Resolve its custody before reducing quantity.")
