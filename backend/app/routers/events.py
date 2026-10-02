from datetime import date, datetime, timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from ..auth import officer
from ..db import get_db
from ..domain import (
    PACIFIC,
    audit,
    default_quarter,
    expand_series,
    fail,
    open_quarter,
    page,
    require,
    revision,
    today,
    utcnow,
)
from ..models import Event, Media, Series, Signup, Trip
from ..projections import event_projection, events_projection
from ..schemas import (
    SeriesView,
    DuplicateWrite,
    EventPrivate,
    EventPublic,
    EventWrite,
    Page,
    Revision,
    SeriesWrite,
    StateChange,
)

router = APIRouter(prefix="/api")
Limit = Annotated[int, Query(ge=1, le=200)]
Offset = Annotated[int, Query(ge=0)]


def validate_event(db, value, existing=None):
    q = open_quarter(db, value.quarter_id)
    if not (
        q.starts_on
        <= value.starts_at.astimezone(PACIFIC).date()
        <= value.ends_at.astimezone(PACIFIC).date()
        <= q.ends_on
    ):
        fail(422, "event_dates", "The entire event must fit inside its quarter.")
    if value.photo_id:
        require(db, Media, value.photo_id, True)
    if existing:
        if existing.quarter_id != value.quarter_id:
            fail(422, "quarter_change", "An existing event cannot move between quarters.")
        if existing.state in {"completed", "cancelled"}:
            fail(409, "event_locked", "This event is closed. Mileage and recap have separate editors.")
        participated = db.scalar(
            select(Signup.id).where(Signup.event_id == existing.id).limit(1)
        ) or db.scalar(select(Trip.id).where(Trip.event_id == existing.id).limit(1))
        if participated and not value.signups_enabled:
            fail(409, "participation_exists", "Signups cannot be disabled after participation exists.")
        if participated:
            new = {q.id: q.model_dump() for q in value.questions}
            if any(new.get(q["id"]) != q for q in existing.questions):
                fail(409, "questions_locked", "Existing questions are frozen after the first signup.")
            old = {q["id"] for q in existing.questions}
            if any(q.required and q.id not in old for q in value.questions):
                fail(409, "questions_locked", "New questions must be optional after the first signup.")
    return q


def apply_event(e, value):
    for k, v in value.model_dump(exclude={"expected_revision"}).items():
        setattr(e, k, v)
    if not value.signups_enabled:
        e.questions = []
        e.opens_at = e.closes_at = e.arrival_at = e.departure_at = e.return_at = None
        e.miles = e.gas_price = 0
        e.rate_override = None


@router.get("/events", response_model=Page[EventPublic])
def public_events(
    from_date: date = Query(alias="from"),
    to_date: date = Query(alias="to"),
    limit: Limit = 50,
    offset: Offset = 0,
    db=Depends(get_db, scope="function"),
):
    if to_date < from_date or (to_date - from_date).days > 370:
        fail(422, "date_range", "Choose a date range of at most 370 days.")
    start = datetime.combine(from_date, datetime.min.time(), PACIFIC)
    end = datetime.combine(to_date + timedelta(days=1), datetime.min.time(), PACIFIC)
    values = page(
        db,
        select(Event)
        .where(
            Event.state != "draft", Event.skipped.is_(False), Event.starts_at < end, Event.ends_at >= start
        )
        .order_by(Event.starts_at, Event.id),
        limit,
        offset,
    )
    values["items"] = events_projection(db, values["items"])
    return values


@router.get("/events/{eid}", response_model=EventPublic)
def public_event(eid: int, db=Depends(get_db, scope="function")):
    e = require(db, Event, eid)
    if e.state == "draft" or e.skipped:
        fail(404, "not_found", "This event could not be found.")
    return event_projection(db, e)


@router.get("/admin/events", response_model=Page[EventPrivate])
def admin_events(
    quarter_id: int,
    search: str = "",
    state: str | None = None,
    limit: Limit = 50,
    offset: Offset = 0,
    user=Depends(officer),
    db=Depends(get_db, scope="function"),
):
    default_quarter(db, quarter_id)
    query = select(Event).where(Event.quarter_id == quarter_id, Event.skipped.is_(False))
    if search:
        query = query.where(Event.name.ilike("%" + search[:100] + "%"))
    if state:
        query = query.where(Event.state == state)
    result = page(db, query.order_by(Event.starts_at, Event.id), limit, offset)
    result["items"] = events_projection(db, result["items"], True)
    return result


@router.post("/admin/events", response_model=EventPrivate, status_code=201)
def create_event(value: EventWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    validate_event(db, value)
    e = Event()
    apply_event(e, value)
    db.add(e)
    db.flush()
    audit(db, user, "event.create", e.id)
    return event_projection(db, e, True)


@router.get("/admin/events/{eid}", response_model=EventPrivate)
def manage_event(eid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    return event_projection(db, require(db, Event, eid), True)


@router.put("/admin/events/{eid}", response_model=EventPrivate)
def edit_event(eid: int, value: EventWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    open_quarter(db, value.quarter_id)
    e = require(db, Event, eid, True)
    revision(e, value.expected_revision)
    validate_event(db, value, e)
    apply_event(e, value)
    e.exception = bool(e.series_id)
    e.revision += 1
    db.flush()
    audit(db, user, "event.edit", e.id)
    return event_projection(db, e, True)


@router.post("/admin/events/{eid}/state", response_model=EventPrivate)
def event_state(eid: int, value: StateChange, user=Depends(officer), db=Depends(get_db, scope="function")):
    initial = require(db, Event, eid)
    open_quarter(db, initial.quarter_id)
    e = require(db, Event, eid, True)
    revision(e, value.expected_revision)
    if e.state == value.state:
        return event_projection(db, e, True)
    if e.state in {"completed", "cancelled"}:
        fail(409, "event_locked", "Closed events cannot change state.")
    rows = list(db.scalars(select(Signup).where(Signup.event_id == eid)))
    if value.state == "draft" and rows:
        fail(409, "participation_exists", "An event with participation cannot become a draft.")
    if value.state == "cancelled":
        if not value.reason.strip():
            fail(422, "reason_required", "Enter the cancellation reason members will see.")
        if any(s.checked_in_at for s in rows):
            fail(409, "active_arrivals", "Undo active check-ins before cancelling.")
        e.cancellation_reason = value.reason.strip()
    if value.state == "completed":
        if e.state != "published":
            fail(409, "not_published", "Publish the event before completing it.")
        active = [s for s in rows if not s.cancelled]
        arrived = [s for s in active if s.checked_in_at]
        e.completion = {
            "signed_up": len(active),
            "arrived": len(arrived),
            "no_shows": len(active) - len(arrived),
            "drivers": sum(s.role == "driver" for s in arrived),
            "riders": sum(s.role == "ride" for s in arrived),
            "own_ride": sum(s.role == "own" for s in arrived),
            "completed_at": utcnow().isoformat(),
            "arrivals": [{"signup_id": s.id, "at": s.checked_in_at.isoformat()} for s in arrived],
        }
    e.state = value.state
    e.revision += 1
    if e.series_id and value.state in {"completed", "cancelled"}:
        e.exception = True
    audit(db, user, "event." + value.state, eid, {"reason": value.reason})
    db.flush()
    return event_projection(db, e, True)


@router.post("/admin/events/{eid}/duplicate", response_model=EventPrivate)
def duplicate(eid: int, value: DuplicateWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    old = require(db, Event, eid)
    fields = {k: getattr(old, k) for k in EventWrite.model_fields if hasattr(old, k)}
    fields.update(quarter_id=value.quarter_id, starts_at=value.starts_at, ends_at=value.ends_at)
    delta = value.starts_at - old.starts_at
    for field in ("opens_at", "closes_at", "arrival_at", "departure_at", "return_at"):
        fields[field] = fields[field] + delta if fields[field] else None
    return create_event(EventWrite(**fields), user, db)


@router.post("/admin/events/{eid}/skip")
def skip(eid: int, value: Revision, user=Depends(officer), db=Depends(get_db, scope="function")):
    e = require(db, Event, eid)
    open_quarter(db, e.quarter_id)
    e = require(db, Event, eid, True)
    revision(e, value.expected_revision)
    if not e.series_id or e.starts_at < utcnow() or e.state in {"completed", "cancelled"}:
        fail(409, "cannot_skip", "Only upcoming active series dates may be skipped.")
    if db.scalar(select(Signup.id).where(Signup.event_id == eid).limit(1)) or db.scalar(
        select(Trip.id).where(Trip.event_id == eid).limit(1)
    ):
        fail(409, "participation_exists", "Cancel this date with a reason to preserve its participants.")
    e.skipped = e.exception = True
    e.revision += 1
    audit(db, user, "event.skip", eid)
    return {"ok": True}


def series_dates(db, value):
    q = open_quarter(db, value.event.quarter_id)
    rows = expand_series(value)
    if not q.starts_on <= value.starts_on <= value.until <= q.ends_on:
        fail(422, "series_quarter", "The recurrence must fit inside one quarter.")
    for row in rows:
        occurrence_input(value, row)  # Also validate derived operational windows.
        if row["ends_at"].date() > q.ends_on:
            fail(422, "series_quarter", "An overnight occurrence extends outside the quarter.")
    return rows


def occurrence_input(value, row):
    fields = value.event.model_dump()
    delta = row["starts_at"] - value.event.starts_at
    fields.update(starts_at=row["starts_at"], ends_at=row["ends_at"])
    for field in ("opens_at", "closes_at", "arrival_at", "departure_at", "return_at"):
        if fields[field]:
            fields[field] += delta
    return EventWrite(**fields)


@router.post("/admin/series/preview")
def preview_series(value: SeriesWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    return {"items": series_dates(db, value)}


@router.post("/admin/series", status_code=201, response_model=SeriesView)
def create_series(value: SeriesWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    rows = series_dates(db, value)
    existing = db.scalar(select(Series).where(Series.request_id == value.request_id))
    if existing:
        return series_detail(existing.id, user, db)
    series = Series(
        quarter_id=value.event.quarter_id,
        definition=value.model_dump(mode="json"),
        request_id=value.request_id,
    )
    db.add(series)
    db.flush()
    for row in rows:
        item = occurrence_input(value, row)
        validate_event(db, item)
        event = Event(series_id=series.id, original_date=row["date"])
        apply_event(event, item)
        db.add(event)
    audit(db, user, "series.create", series.id)
    db.flush()
    return series_detail(series.id, user, db)


@router.get("/admin/series/{sid}", response_model=SeriesView)
def series_detail(sid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    series = require(db, Series, sid)
    events = list(db.scalars(select(Event).where(Event.series_id == sid).order_by(Event.starts_at)))
    participated = set(
        db.scalars(select(Signup.event_id).where(Signup.event_id.in_([e.id for e in events])).distinct())
    )
    return {
        "id": series.id,
        "revision": series.revision,
        "definition": series.definition,
        "occurrences": [
            {**v.model_dump(mode="json"), "participated": v.id in participated}
            for v in events_projection(db, events, True)
        ],
    }


@router.put("/admin/series/{sid}", response_model=SeriesView)
def edit_series(sid: int, value: SeriesWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    rows = series_dates(db, value)
    series = require(db, Series, sid, True)
    revision(series, value.expected_revision)
    if series.quarter_id != value.event.quarter_id:
        fail(422, "quarter_change", "A series cannot move between quarters.")
    effective = value.effective_from or today()
    if effective < today():
        fail(422, "past_edit", "Series edits may affect only today and future dates.")
    existing = list(
        db.scalars(select(Event).where(Event.series_id == sid).order_by(Event.starts_at).with_for_update())
    )
    protected = {
        e.original_date
        for e in existing
        if e.exception or e.starts_at < utcnow() or e.state in {"completed", "cancelled"}
    }
    affected = [e for e in existing if e.original_date >= effective and e.original_date not in protected]
    conflicts = list(
        db.scalars(select(Signup.event_id).where(Signup.event_id.in_([e.id for e in affected])).distinct())
    )
    if conflicts:
        fail(409, "participating_dates", "Edit participating dates individually.", event_ids=conflicts)
    by_date = {e.original_date: e for e in affected}
    new_dates = set()
    for row in rows:
        day = row["date"]
        if day < effective or day in protected:
            continue
        new_dates.add(day)
        e = by_date.get(day)
        if e is None:
            e = Event(series_id=sid, original_date=day)
            db.add(e)
        else:
            e.revision += 1
        apply_event(e, occurrence_input(value, row))
        e.skipped = False
    for e in affected:
        if e.original_date not in new_dates:
            e.skipped = True
            e.revision += 1
    series.definition = value.model_dump(mode="json")
    series.revision += 1
    audit(db, user, "series.edit", sid)
    db.flush()
    return series_detail(sid, user, db)


@router.post("/admin/series/{sid}/publish", response_model=SeriesView)
def publish_series(sid: int, value: Revision, user=Depends(officer), db=Depends(get_db, scope="function")):
    """Publish the remaining active drafts as one transaction."""
    initial = require(db, Series, sid)
    open_quarter(db, initial.quarter_id)
    series = require(db, Series, sid, True)
    revision(series, value.expected_revision)
    events = list(
        db.scalars(
            select(Event)
            .where(Event.series_id == sid, Event.state == "draft", Event.skipped.is_(False))
            .order_by(Event.id)
            .with_for_update()
        )
    )
    for e in events:
        event_state(e.id, StateChange(state="published", expected_revision=e.revision), user, db)
    if events:
        series.revision += 1
        audit(db, user, "series.publish", sid, {"count": len(events)})
    return series_detail(sid, user, db)
