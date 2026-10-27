import hashlib
from datetime import datetime, timedelta
from uuid import uuid4
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from ..auth import limited, officer
from ..db import get_db
from ..domain import (
    audit,
    ensure_member,
    ensure_membership,
    fail,
    open_quarter,
    operational_event,
    require,
    utcnow,
)
from ..models import ImportPreview, Member, Signup, Vehicle
from ..schemas import ImportApply, ImportWrite, MemberInput, SignupWrite, ImportView, ImportOutcome
from ..services.import_parser import event_fields, read_rows
from ..services.participation import save_signup
from ..services.restrictions import enforce
from ..services.approval import enforce_approval
from ..domain import get_membership

router = APIRouter(prefix="/api/admin/imports")


def scope(db, value):
    open_quarter(db, value.quarter_id)
    if value.mode == "participants":
        if value.event_id is None:
            fail(422, "event_required", "Choose the event to import participants into.")
        event = operational_event(db, value.event_id)
        if event.quarter_id != value.quarter_id:
            fail(422, "quarter_mismatch", "The event belongs to a different quarter.")
        return event
    return None


@router.post("/preview", response_model=ImportView)
def preview(value: ImportWrite, request: Request, user=Depends(officer), db=Depends(get_db, scope="function")):
    limited(request, db, "import", 10)
    event = scope(db, value)
    if len(value.text.encode()) > 1048576:
        fail(422, "import_size", "Import at most 1 MiB at a time.")
    rows, issues, seen = [], [], set()
    for number, raw in read_rows(value.text):
        try:
            if raw is None:
                raise ValueError("Column count does not match the header")
            parsed = MemberInput(
                name=raw.get("name", ""), email=raw.get("email", ""), phone=raw.get("phone", "")
            )
            if not parsed.email:
                raise ValueError("An email is required for each imported member")
            if parsed.email in seen:
                raise ValueError("Duplicate email in this import")
            seen.add(parsed.email)
            data = parsed.model_dump()
            if event:
                fields = event_fields(raw, value.fallback_role)
                if fields["seats"] > 50:
                    raise ValueError("Passenger count exceeds the supported capacity")
                if fields["joined_at"]:
                    fields["joined_at"] = fields["joined_at"].isoformat()
                data.update(fields)
            existing = db.scalar(select(Member).where(Member.email == parsed.email))
            action = "reuse" if existing else "create"
            if (
                event
                and existing
                and db.scalar(
                    select(Signup.id).where(Signup.event_id == event.id, Signup.member_id == existing.id)
                )
            ):
                action = "skip existing signup"
            if existing:
                enforce_approval(db, existing.id)
                if event and action != "skip existing signup":
                    enforce(db, existing.id, event=event)
                membership = get_membership(db, existing.id, value.quarter_id)
                if value.mode == "paid_members" and (not membership or membership.status != "approved"):
                    enforce(db, existing.id, membership=True)
            rows.append({"line": number, "action": action, **data})
        except HTTPException as exc:
            if exc.detail.get("code") not in {"membership_restricted", "event_signup_restricted", "approval_required"}:
                raise
            message = ("Club approval is required before importing this member." if exc.detail["code"] == "approval_required"
                       else "Active ban: lift the matching ban before importing this member.")
            issues.append({"line": number, "message": message})
        except (ValueError, ValidationError) as exc:
            issues.append({"line": number, "message": str(exc)[:500]})
    signature = hashlib.sha256(value.model_dump_json().encode()).hexdigest()
    item = ImportPreview(
        id=uuid4().hex,
        actor_id=user.id,
        request_hash=signature,
        specification=value.model_dump(mode="json", exclude={"text"}),
        rows=rows,
        issues=issues,
        expires_at=utcnow() + timedelta(minutes=30),
    )
    db.add(item)
    return {
        "id": item.id,
        "request_hash": signature,
        "expires_at": item.expires_at,
        "rows": rows,
        "issues": issues,
        "can_apply": not issues,
        "total": len(rows) + len(issues),
    }


@router.post("/{pid}/apply", response_model=ImportOutcome)
def apply(pid: str, value: ImportApply, user=Depends(officer), db=Depends(get_db, scope="function")):
    original = require(db, ImportPreview, pid)
    spec = ImportWrite(text="", **original.specification)
    event = scope(db, spec)
    item = require(db, ImportPreview, pid, True)
    if item.actor_id != user.id or item.request_hash != value.request_hash:
        fail(403, "preview_scope", "This import preview belongs to a different request or officer.")
    if item.applied:
        return item.applied
    if item.expires_at <= utcnow():
        fail(409, "preview_expired", "Preview the import again before applying it.")
    if item.issues:
        fail(422, "import_errors", "Resolve every row error before applying.")
    created, reused, skipped = 0, 0, 0
    for row in item.rows:
        existing = db.scalar(select(Member).where(Member.email == row["email"]))
        m = existing or ensure_member(
            db, MemberInput(**{k: row[k] for k in ("name", "email", "phone", "student")})
        )
        enforce_approval(db, m.id)
        created += existing is None
        reused += existing is not None
        if not m.phone:
            m.phone = row["phone"]
        membership = ensure_membership(db, m.id, spec.quarter_id)
        if spec.mode == "paid_members" and membership.status != "approved":
            enforce(db, m.id, membership=True)
            membership.status, membership.source = "approved", "imported"
            membership.reason = "Imported paid member; payment receipt unknown"
        if event:
            if db.scalar(select(Signup.id).where(Signup.event_id == event.id, Signup.member_id == m.id)):
                skipped += 1
                continue
            # A changed membership can make a retreat row invalid; abort all rows.
            vehicle_id = None
            if row["role"] == "driver":
                v = db.scalar(
                    select(Vehicle)
                    .where(
                        Vehicle.member_id == m.id,
                        Vehicle.removed.is_(False),
                        Vehicle.capacity >= row["seats"],
                    )
                    .order_by(Vehicle.id)
                )
                if v is None:
                    v = Vehicle(
                        member_id=m.id,
                        year=None,
                        make="Unknown",
                        model="Imported car",
                        capacity=row["seats"],
                        source="import",
                    )
                    db.add(v)
                    db.flush()
                vehicle_id = v.id
            s = save_signup(
                db,
                event,
                m,
                SignupWrite(role=row["role"], seats=row["seats"], vehicle_id=vehicle_id),
                True,
                "import",
                actor=user,
                capacity_override_reason=value.capacity_override_reason,
            )
            if row.get("joined_at"):
                s.joined_at = datetime.fromisoformat(row["joined_at"])
    item.applied = {"created": created, "reused": reused, "skipped": skipped, "total": len(item.rows)}
    audit(db, user, "import.apply", item.id, item.applied)
    return item.applied
