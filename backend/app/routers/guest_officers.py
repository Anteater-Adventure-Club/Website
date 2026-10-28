from fastapi import APIRouter, Depends
from sqlalchemy import select
from ..auth import officer
from ..db import get_db
from ..domain import advisory, audit, fail, require, revision, utcnow
from ..models import GuestOfficerAccess, Member, Officer
from ..schemas import GuestOfficerGrant, GuestOfficerUpdate, GuestOfficerView, Items

router = APIRouter(prefix="/api/admin/guest-officers")


def view(db, grant):
    target = require(db, Member, grant.member_id)
    return {**{key: getattr(grant, key) for key in (
        "member_id", "permissions", "expires_at", "granted_at", "updated_at", "granted_by", "updated_by", "revision",
    )}, "name": target.name, "email": target.email,
        "active": target.approval_status == "approved" and grant.expires_at > utcnow()}


def validate(db, mid, value):
    target = require(db, Member, mid)
    if not target.email or target.approval_status != "approved":
        fail(422, "guest_eligibility", "Choose an approved member with an email address.")
    if db.get(Officer, mid):
        fail(409, "full_officer", "This member already has full officer access.")
    if value.expires_at <= utcnow():
        fail(422, "guest_expiry", "Choose an expiry in the future.")


@router.get("", response_model=Items[GuestOfficerView])
def list_guests(user=Depends(officer), db=Depends(get_db, scope="function")):
    return {"items": [view(db, grant) for grant in db.scalars(
        select(GuestOfficerAccess).order_by(GuestOfficerAccess.granted_at.desc())
    )]}


@router.post("", response_model=GuestOfficerView, status_code=201)
def grant_guest(value: GuestOfficerGrant, user=Depends(officer), db=Depends(get_db, scope="function")):
    advisory(db, 700)
    validate(db, value.member_id, value)
    if db.get(GuestOfficerAccess, value.member_id):
        fail(409, "guest_exists", "Edit or renew this member’s existing Guest grant.")
    grant = GuestOfficerAccess(**value.model_dump(), granted_by=user.id, updated_by=user.id)
    db.add(grant)
    db.flush()
    audit(db, user, "guest.grant", grant.member_id, {"after": value.model_dump(mode="json")})
    return view(db, grant)


@router.put("/{mid}", response_model=GuestOfficerView)
def update_guest(mid: int, value: GuestOfficerUpdate, user=Depends(officer), db=Depends(get_db, scope="function")):
    advisory(db, 700)
    validate(db, mid, value)
    grant = require(db, GuestOfficerAccess, mid, True)
    revision(grant, value.expected_revision)
    before = {"permissions": grant.permissions, "expires_at": grant.expires_at.isoformat()}
    grant.permissions, grant.expires_at = value.permissions, value.expires_at
    grant.updated_by, grant.updated_at = user.id, utcnow()
    grant.revision += 1
    audit(db, user, "guest.update", mid, {"before": before, "after": value.model_dump(mode="json")})
    return view(db, grant)


@router.delete("/{mid}")
def revoke_guest(mid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    advisory(db, 700)
    grant = db.get(GuestOfficerAccess, mid)
    if grant:
        audit(db, user, "guest.revoke", mid, {"before": {
            "permissions": grant.permissions, "expires_at": grant.expires_at.isoformat(),
        }})
        db.delete(grant)
    return {"ok": True}
