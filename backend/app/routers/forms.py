from uuid import uuid4
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from ..auth import limited, member, officer
from ..db import get_db
from ..domain import advisory, audit, fail, require, utcnow
from ..models import Event, EventForm, EventFormResponse, EventFormSheet, FormDefinition, Member, Quarter, Signup
from ..schemas import (
    EventFormResponseRow, EventFormView, EventFormWrite, FormResponseWrite,
    FormTemplateView, FormTemplateWrite, Items, Page, Question,
)
from ..services.event_forms import (
    can_submit, find_form, form_view, lock_form_event, response_status, response_view,
)
from ..services.forms import validate_answers

router = APIRouter(prefix="/api")


@router.get("/admin/form-templates", response_model=Items[FormTemplateView])
def templates(user=Depends(officer), db=Depends(get_db, scope="function")):
    return {"items": list(db.scalars(select(FormDefinition).where(
        FormDefinition.kind.in_(["signup", "followup"])).order_by(FormDefinition.title, FormDefinition.key)))}


def apply_template(db, template, value):
    # All default assignments share one lock; replacing a default is atomic.
    for other in db.scalars(select(FormDefinition).where(FormDefinition.key != template.key)):
        remaining = [kind for kind in other.default_event_kinds if kind not in value.default_event_kinds]
        if remaining != other.default_event_kinds:
            other.default_event_kinds = remaining
            other.revision += 1
    for key, val in value.model_dump(exclude={"expected_revision"}).items():
        setattr(template, key, val)


@router.post("/admin/form-templates", response_model=FormTemplateView, status_code=201)
def create_template(value: FormTemplateWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    advisory(db, 735)
    template = FormDefinition(key="template-" + uuid4().hex, revision=1)
    apply_template(db, template, value)
    db.add(template)
    db.flush()
    audit(db, user, "form_template.create", template.key)
    return template


@router.put("/admin/form-templates/{key}", response_model=FormTemplateView)
def update_template(key: str, value: FormTemplateWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    advisory(db, 735)
    template = require(db, FormDefinition, key, True)
    if template.kind not in {"signup", "followup"}:
        fail(404, "not_found", "This template could not be found.")
    if value.expected_revision != template.revision:
        fail(409, "stale_revision", "This template changed. Reload before saving.")
    if value.kind != template.kind:
        fail(422, "template_kind", "Create another template to change its purpose.")
    apply_template(db, template, value)
    template.revision += 1
    audit(db, user, "form_template.update", key)
    return template


@router.get("/admin/event-forms", response_model=Page[EventFormView])
def all_forms(quarter_id: int | None = None, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
              user=Depends(officer), db=Depends(get_db, scope="function")):
    query = select(EventForm, Event).join(Event)
    if quarter_id:
        query = query.where(Event.quarter_id == quarter_id)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.execute(query.order_by(Event.starts_at.desc(), EventForm.number).limit(limit).offset(offset))
    return {"items": [form_view(db, f, e, admin=True) for f, e in rows], "total": total}


@router.get("/admin/events/{eid}/forms", response_model=Items[EventFormView])
def event_forms(eid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    event = require(db, Event, eid)
    return {"items": [form_view(db, f, event, admin=True) for f in db.scalars(
        select(EventForm).where(EventForm.event_id == eid).order_by(EventForm.number))]}


@router.post("/admin/events/{eid}/forms", response_model=EventFormView, status_code=201)
def create_form(eid: int, value: EventFormWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    event = lock_form_event(db, eid)
    number = (db.scalar(select(func.max(EventForm.number)).where(EventForm.event_id == eid)) or 0) + 1
    form = EventForm(event_id=eid, number=number, **value.model_dump(exclude={"expected_revision"}))
    db.add(form)
    db.flush()
    audit(db, user, "event_form.create", form.id, {"event_id": eid})
    return form_view(db, form, event, admin=True)


@router.get("/admin/events/{eid}/forms/{number}", response_model=EventFormView)
def admin_form(eid: int, number: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    return form_view(db, find_form(db, eid, number), require(db, Event, eid), admin=True)


@router.put("/admin/events/{eid}/forms/{number}", response_model=EventFormView)
def update_form(eid: int, number: int, value: EventFormWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    event = lock_form_event(db, eid)
    form = find_form(db, eid, number, True)
    if value.expected_revision != form.revision:
        fail(409, "stale_revision", "This form changed. Reload before saving.")
    responded = db.scalar(select(EventFormResponse.id).where(EventFormResponse.form_id == form.id).limit(1))
    old = [Question.model_validate(q).model_dump() for q in form.questions]
    if responded and old != [q.model_dump() for q in value.questions]:
        fail(409, "questions_locked", "Questions lock after the first response. Create a new form to ask new questions.")
    if form.state != "draft" and value.state == "draft":
        fail(409, "form_published", "Archive a published form to stop collecting responses.")
    for key, val in value.model_dump(exclude={"expected_revision"}).items():
        setattr(form, key, val)
    form.revision += 1
    config = db.get(EventFormSheet, form.id)
    if config:
        valid = {"question:" + q["id"] for q in form.questions}
        columns = [c for c in config.columns if not c["key"].startswith("question:") or c["key"] in valid]
        if config.columns != columns:
            config.columns = columns
            config.revision += 1
    db.flush()
    audit(db, user, "event_form.update", form.id, {"state": form.state, "revision": form.revision})
    return form_view(db, form, event, admin=True)


@router.get("/admin/events/{eid}/forms/{number}/responses", response_model=Page[EventFormResponseRow])
def responses(eid: int, number: int, status: str | None = None, search: str = "",
              limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
              user=Depends(officer), db=Depends(get_db, scope="function")):
    form = find_form(db, eid, number)
    event = require(db, Event, eid)
    operational = event.state == "published" and require(db, Quarter, event.quarter_id).state == "open"
    query = select(Signup, Member, EventFormResponse).join(Member).outerjoin(
        EventFormResponse, (EventFormResponse.signup_id == Signup.id) & (EventFormResponse.form_id == form.id),
    ).where(Signup.event_id == eid).order_by(Member.name, Signup.id)
    rows = []
    at = utcnow()
    for signup, person, response in db.execute(query):
        state = response_status(form, signup, response, at)
        if status and state != status:
            continue
        if search.strip().casefold() not in (person.name + " " + (person.email or "")).casefold():
            continue
        rows.append({"signup_id": signup.id, "member_id": person.id, "name": person.name,
                     "email": person.email, "cancelled": signup.cancelled, "status": state,
                     "can_cancel": operational and not signup.cancelled and not signup.checked_in_at,
                     "response": response_view(response)})
    return {"items": rows[offset:offset + limit], "total": len(rows)}


def own_signup(db, eid, mid):
    signup = db.scalar(select(Signup).where(Signup.event_id == eid, Signup.member_id == mid, Signup.cancelled.is_(False)))
    if not signup:
        fail(403, "signup_required", "Sign up for this event to access its forms.")
    return signup


@router.get("/events/{eid}/forms", response_model=Items[EventFormView])
def own_forms(eid: int, user=Depends(member), db=Depends(get_db, scope="function")):
    signup = own_signup(db, eid, user.id)
    event = require(db, Event, eid)
    return {"items": [form_view(db, f, event, signup=signup) for f in db.scalars(
        select(EventForm).where(EventForm.event_id == eid, EventForm.state == "published").order_by(EventForm.number))]}


@router.get("/me/event-forms/attention", response_model=Items[EventFormView])
def attention(user=Depends(member), db=Depends(get_db, scope="function")):
    at = utcnow()
    query = select(EventForm, Event, Signup).select_from(EventForm).join(Event, Event.id == EventForm.event_id).join(
        Signup, Signup.event_id == Event.id).join(Quarter, Quarter.id == Event.quarter_id).where(
        Signup.member_id == user.id, Signup.cancelled.is_(False), EventForm.state == "published",
        EventForm.required.is_(True), EventForm.opens_at <= at,
        (EventForm.closes_at > at) | EventForm.allow_late.is_(True),
        Event.state.in_(["published", "completed"]), Event.skipped.is_(False), Quarter.state == "open",
        ~select(EventFormResponse.id).where(EventFormResponse.form_id == EventForm.id,
                                           EventFormResponse.signup_id == Signup.id).exists(),
    ).order_by(EventForm.closes_at, EventForm.id)
    return {"items": [form_view(db, f, e, signup=s) for f, e, s in db.execute(query)]}


@router.get("/events/{eid}/forms/{number}", response_model=EventFormView)
def own_form(eid: int, number: int, user=Depends(member), db=Depends(get_db, scope="function")):
    signup = own_signup(db, eid, user.id)
    form = find_form(db, eid, number)
    if form.state == "draft":
        fail(404, "not_found", "This form could not be found.")
    return form_view(db, form, require(db, Event, eid), signup=signup)


@router.put("/events/{eid}/forms/{number}/response", response_model=EventFormView)
def submit(eid: int, number: int, value: FormResponseWrite, request: Request,
           user=Depends(member), db=Depends(get_db, scope="function")):
    limited(request, db, "event_form.submit", 30)
    event = lock_form_event(db, eid)
    form = find_form(db, eid, number, True)
    signup = own_signup(db, eid, user.id)
    response = db.scalar(select(EventFormResponse).where(
        EventFormResponse.form_id == form.id, EventFormResponse.signup_id == signup.id).with_for_update())
    if value.form_revision != form.revision:
        fail(409, "form_changed", "This form changed. Review the updated form before submitting.")
    if (response.revision if response else None) != value.expected_revision:
        fail(409, "stale_revision", "Your response changed in another window. Reload before saving.")
    submitted_at = utcnow()
    if not can_submit(form, event, require(db, Quarter, event.quarter_id), signup, response, submitted_at):
        fail(409, "form_closed", "This form is not accepting this response right now.")
    answers = validate_answers(form.questions, value.answers)
    if response is None:
        response = EventFormResponse(form_id=form.id, signup_id=signup.id, questions=form.questions,
                                     answers=answers, form_revision=form.revision,
                                     submitted_at=submitted_at, updated_at=submitted_at)
        db.add(response)
    else:
        response.answers, response.updated_at = answers, submitted_at
        response.revision += 1
        response.form_revision = form.revision
    db.flush()
    audit(db, user, "event_form.respond", form.id, {"signup_id": signup.id, "revision": response.revision})
    return form_view(db, form, event, signup=signup)
