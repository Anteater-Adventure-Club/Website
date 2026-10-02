import re
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from sqlalchemy import func, select, text
from .models import Audit, Event, Member, Membership, Quarter

PACIFIC = ZoneInfo("America/Los_Angeles")
CENT = Decimal("0.01")


def utcnow():
    return datetime.now(timezone.utc)


def today():
    return utcnow().astimezone(PACIFIC).date()


def fail(status, code, message, **extra):
    raise HTTPException(status, detail={"code": code, "message": message, **extra})


def require(db, model, identity, lock=False):
    obj = (
        db.scalar(
            select(model)
            .where(model.id == identity)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if lock
        else db.get(model, identity)
    )
    if obj is None:
        fail(404, "not_found", "This record could not be found.")
    return obj


def revision(obj, expected):
    if expected is not None and obj.revision != expected:
        fail(
            409,
            "stale_revision",
            "This record changed. Refresh and try again.",
            current_revision=obj.revision,
        )


def advisory(db, key):
    if db.bind.dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": key})


def audit(db, actor, action, entity, data=None):
    db.add(Audit(actor_id=actor.id if actor else None, action=action, entity=str(entity), data=data or {}))


def open_quarter(db, qid, lock=True):
    q = require(db, Quarter, qid, lock)
    if q.state != "open":
        fail(409, "quarter_locked", "This quarter's financial records are locked.")
    return q


def operational_event(db, eid, expected=None):
    initial = require(db, Event, eid)
    open_quarter(db, initial.quarter_id)
    e = require(db, Event, eid, True)
    revision(e, expected)
    if not e.signups_enabled:
        fail(409, "signups_disabled", "Signups and attendance are disabled for this event.")
    if e.state != "published" or e.skipped:
        fail(409, "event_locked", "Attendance is available only for a published active event.")
    return e


def default_quarter(db, qid=None):
    if qid is not None:
        return require(db, Quarter, qid)
    d = today()
    q = db.scalar(select(Quarter).where(Quarter.starts_on <= d, Quarter.ends_on >= d))
    return (
        q
        or db.scalar(select(Quarter).where(Quarter.starts_on > d).order_by(Quarter.starts_on))
        or db.scalar(select(Quarter).order_by(Quarter.ends_on.desc()))
    )


def paid(db, member_id, quarter_id):
    return bool(
        db.scalar(
            select(Membership.id).where(
                Membership.member_id == member_id,
                Membership.quarter_id == quarter_id,
                Membership.status == "approved",
            )
        )
    )


def get_membership(db, mid, qid):
    return db.scalar(select(Membership).where(Membership.member_id == mid, Membership.quarter_id == qid))


def ensure_membership(db, mid, qid):
    value = get_membership(db, mid, qid)
    if value is None:
        value = Membership(member_id=mid, quarter_id=qid)
        db.add(value)
        db.flush()
    return value


def ensure_member(db, value):
    if value.email:
        advisory(db, 701)
        member = db.scalar(select(Member).where(Member.email == value.email))
        if member:
            return member
    member = Member(**value.model_dump())
    db.add(member)
    db.flush()
    return member


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "event"


def page(db, statement, limit=50, offset=0):
    total = db.scalar(select(func.count()).select_from(statement.order_by(None).subquery()))
    return {"items": list(db.scalars(statement.limit(limit).offset(offset))), "total": total}


def allocate(totals, budget, cap=Decimal(0)):
    """MVP Decimal allocation: cap, prorate, deterministic largest-remainder cents."""
    eligible = {key: min(value, cap) if cap else value for key, value in totals.items()}
    total = sum(eligible.values(), Decimal(0))
    target = min(budget, total).quantize(CENT, rounding=ROUND_HALF_UP)
    if not total:
        return {key: Decimal("0.00") for key in totals}
    exact = {key: value * target / total for key, value in eligible.items()}
    result = {key: value.quantize(CENT, rounding=ROUND_DOWN) for key, value in exact.items()}
    remaining = int((target - sum(result.values())) / CENT)
    for key in sorted(exact, key=lambda k: (-(exact[k] - result[k]), k))[:remaining]:
        result[key] += CENT
    return result


def local_instant(day: date, clock):
    naive = datetime.combine(day, clock)
    value = naive.replace(tzinfo=PACIFIC)
    if value.astimezone(timezone.utc).astimezone(PACIFIC).replace(tzinfo=None) != naive:
        fail(422, "dst_nonexistent", "This local time does not exist because of daylight saving time.")
    if value.utcoffset() != naive.replace(tzinfo=PACIFIC, fold=1).utcoffset():
        fail(422, "dst_ambiguous", "Choose a time outside the repeated daylight saving hour.")
    return value


def expand_series(value):
    if value.until < value.starts_on or (value.until - value.starts_on).days > 366:
        fail(422, "recurrence_range", "Use a recurrence range of at most one year.")
    anchor = value.starts_on - timedelta(days=value.starts_on.weekday())
    result = []
    day = value.starts_on
    while day <= value.until:
        week = (day - anchor).days // 7
        weekdays = value.weekdays_a if value.kind == "weekly" or week % 2 == 0 else value.weekdays_b
        if day.weekday() in weekdays and day not in value.excluded:
            starts = local_instant(day, value.start_time)
            ends = local_instant(day + timedelta(days=value.end_time <= value.start_time), value.end_time)
            result.append({"date": day, "starts_at": starts, "ends_at": ends})
        day += timedelta(days=1)
    return result
