"""Follow-up form availability and response status, shared by pages and exports."""
from collections import defaultdict
from sqlalchemy import select
from ..domain import fail, open_quarter, require, slug, utcnow
from ..models import Event, EventForm, EventFormResponse, Quarter, Signup
from ..schemas import FormResponseView


STATUS_LABELS = {
    "not_open": "Not open yet", "awaiting": "Awaiting response", "not_submitted": "Not submitted",
    "no_response": "No Response", "not_required": "Not required", "responded": "Responded",
    "responded_late": "Responded late", "cancelled": "Cancelled",
}


def lock_form_event(db, eid):
    event = require(db, Event, eid)
    open_quarter(db, event.quarter_id)
    event = require(db, Event, eid, True)
    if not event.signups_enabled or event.skipped or event.state == "cancelled":
        fail(409, "event_locked", "Forms are unavailable for this event.")
    return event


def find_form(db, eid, number, lock=False):
    query = select(EventForm).where(EventForm.event_id == eid, EventForm.number == number)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    form = db.scalar(query)
    if form is None:
        fail(404, "not_found", "This form could not be found.")
    return form


def phase(form, event, quarter, at=None):
    at = at or utcnow()
    if form.state != "published":
        return form.state
    if event.state not in {"published", "completed"} or event.skipped or not event.signups_enabled or quarter.state != "open":
        return "unavailable"
    if at < form.opens_at:
        return "scheduled"
    if at < form.closes_at:
        return "open"
    return "late" if form.allow_late else "closed"


def response_status(form, signup, response, at=None):
    at = at or utcnow()
    if signup.cancelled:
        return "cancelled"
    if response:
        return "responded_late" if response.submitted_at >= form.closes_at else "responded"
    if form.state == "draft":
        return "not_open"
    if form.state == "archived":
        return "not_required"
    if at < form.opens_at:
        return "not_open"
    if not form.required:
        return "not_submitted"
    if at < form.closes_at:
        return "awaiting"
    if not form.allow_late and signup.registered_at >= form.closes_at:
        return "not_required"
    return "no_response"


def can_submit(form, event, quarter, signup, response, at=None):
    availability = phase(form, event, quarter, at)
    return not signup.cancelled and (availability == "open" or (availability == "late" and response is None))


def response_view(response):
    return FormResponseView.model_validate(response) if response else None


def form_view(db, form, event, *, signup=None, admin=False):
    quarter = require(db, Quarter, event.quarter_id)
    responses = list(db.scalars(select(EventFormResponse).where(EventFormResponse.form_id == form.id)))
    by_signup = {r.signup_id: r for r in responses}
    at = utcnow()
    response = by_signup.get(signup.id) if signup else None
    view = {key: getattr(form, key) for key in (
        "id", "event_id", "number", "title", "instructions", "questions", "opens_at", "closes_at",
        "required", "allow_late", "state", "revision",
    )}
    view.update(event_name=event.name, event_slug=slug(event.name), quarter_id=event.quarter_id,
                phase=phase(form, event, quarter, at), questions_locked=bool(responses),
                editable=quarter.state == "open" and event.state != "cancelled" and not event.skipped)
    if signup:
        view.update(status=response_status(form, signup, response, at), response=response_view(response),
                    can_submit=can_submit(form, event, quarter, signup, response, at))
    if admin:
        signups = list(db.scalars(select(Signup).where(Signup.event_id == event.id, Signup.cancelled.is_(False))))
        view.update(participant_count=len(signups), response_count=sum(s.id in by_signup for s in signups),
                    no_response_count=sum(response_status(form, s, by_signup.get(s.id), at) == "no_response"
                                          for s in signups) if form.state == "published" else 0)
    return view


def signup_form_statuses(db, signups):
    if not signups:
        return {}
    forms = list(db.scalars(select(EventForm).where(
        EventForm.event_id.in_({s.event_id for s in signups}), EventForm.state == "published",
    ).order_by(EventForm.number)))
    if not forms:
        return {}
    responses = {(r.form_id, r.signup_id): r for r in db.scalars(select(EventFormResponse).where(
        EventFormResponse.form_id.in_([f.id for f in forms]), EventFormResponse.signup_id.in_([s.id for s in signups]),
    ))}
    by_event = defaultdict(list)
    for form in forms:
        by_event[form.event_id].append(form)
    at = utcnow()
    return {s.id: [{"number": f.number, "title": f.title,
                    "status": response_status(f, s, responses.get((f.id, s.id)), at)} for f in by_event[s.event_id]]
            for s in signups}
