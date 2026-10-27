"""Signup restrictions. Authentication and existing paid benefits are independent."""
from sqlalchemy import or_, select, text
from ..domain import fail, utcnow
from ..models import Event, MemberBan, Signup
from ..schemas import BanView, RestrictionView


def restriction_lock(db, *, exclusive=False):
    """Acquire before quarter/event locks. Normal requests share; ban writes exclude.

    This closes the gap between checking eligibility and committing a signup,
    including multi-member imports and bans cancelling across several quarters.
    """
    function = "pg_advisory_xact_lock" if exclusive else "pg_advisory_xact_lock_shared"
    db.execute(text(f"SELECT {function}(731)"))


def active_clause(now=None):
    now = now or utcnow()
    return (
        MemberBan.created_at <= now,
        MemberBan.lifted_at.is_(None),
        or_(MemberBan.expires_at.is_(None), MemberBan.expires_at > now),
    )


def active_bans(db, mid):
    return list(db.scalars(select(MemberBan).where(MemberBan.member_id == mid, *active_clause())
                           .order_by(MemberBan.created_at, MemberBan.id)))


def matches_event(ban, event):
    return ban.all_events or event.kind in ban.event_kinds or event.id in {e["id"] for e in ban.events}


def ban_view(ban):
    status = "lifted" if ban.lifted_at else "expired" if ban.expires_at and ban.expires_at <= utcnow() else "active"
    return BanView(**{k: getattr(ban, k) for k in BanView.model_fields if k != "status"}, status=status)


def own_view(db, ban):
    data = RestrictionView.model_validate(ban)
    # Target labels must not disclose an event that has subsequently become private.
    public = set(db.scalars(select(Event.id).where(
        Event.id.in_([e.id for e in data.events]), Event.state != "draft", Event.skipped.is_(False),
    )))
    data.events = [e.model_copy(update={"name": "Selected event"}) if e.id not in public else e for e in data.events]
    return data


def enforce(db, mid, *, event=None, membership=False):
    bans = [b for b in active_bans(db, mid) if (membership and b.membership) or (event and matches_event(b, event))]
    if bans:
        action = "Membership signup" if membership else "Signup for this event"
        fail(403, "membership_restricted" if membership else "event_signup_restricted",
             f"{action} is restricted. See your restrictions in My AAC or contact AAC officers.")


def impact(db, mid, ban, now):
    query = select(Signup, Event).join(Event).where(
        Signup.member_id == mid, Signup.cancelled.is_(False),
        Event.starts_at >= now, Event.state == "published", Event.skipped.is_(False),
    ).order_by(Event.starts_at, Event.id)
    if ban.expires_at:
        query = query.where(Event.starts_at < ban.expires_at)
    return [(s, e) for s, e in db.execute(query) if matches_event(ban, e)]
