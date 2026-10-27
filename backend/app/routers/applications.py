from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from ..auth import authenticated_member, limited, officer
from ..db import get_db
from ..domain import audit, fail, require, utcnow
from ..models import ApprovalApplication, ApprovalApplicationHistory, FormDefinition, Member
from ..schemas import (
    ApplicationDecision, ApplicationFormView, ApplicationFormWrite, ApplicationReopen,
    ApplicationSubmissionView, ApplicationSubmit, ApplicationView,
)
from ..services.forms import validate_answers

router = APIRouter(prefix="/api")
FORM_KEY = "external-members"


def application_view(db, user, *, admin=False):
    previous = list(db.scalars(select(ApprovalApplicationHistory)
                              .where(ApprovalApplicationHistory.member_id == user.id)
                              .order_by(ApprovalApplicationHistory.id.desc()))) if admin else []
    result = {"status": user.approval_status, "previous_applications": previous}
    record = db.get(ApprovalApplication, user.id)
    if record:
        result.update({k: getattr(record, k) for k in ApplicationSubmissionView.model_fields})
        if not admin:
            result["reviewed_by"] = None
        if user.approval_status != "denied":
            result["message"] = ""
        return result
    if user.approval_status == "required":
        form = require(db, FormDefinition, FORM_KEY)
        return {**result, "form_revision": form.revision, "questions": form.questions}
    return result


@router.get("/me/application", response_model=ApplicationView)
def own_application(user=Depends(authenticated_member), db=Depends(get_db, scope="function")):
    return application_view(db, user)


@router.post("/me/application", response_model=ApplicationView)
def submit(value: ApplicationSubmit, request: Request, user=Depends(authenticated_member), db=Depends(get_db, scope="function")):
    limited(request, db, "application", 10)
    user = require(db, Member, user.id, True)
    # require() refreshes locked rows; a concurrent submission cannot create a second application.
    if user.approval_status != "required":
        fail(409, "application_locked", "This application cannot be submitted again.")
    form = require(db, FormDefinition, FORM_KEY, True)
    if value.form_revision != form.revision:
        fail(409, "form_changed", "The application questions changed. Review the updated form before submitting.")
    answers = validate_answers(form.questions, value.answers)
    db.add(ApprovalApplication(member_id=user.id, form_revision=form.revision, questions=form.questions, answers=answers))
    user.approval_status = "pending"
    db.flush()
    audit(db, user, "application.submit", user.id, {"form_revision": form.revision})
    return application_view(db, user)


@router.get("/admin/application-form", response_model=ApplicationFormView)
def read_form(user=Depends(officer), db=Depends(get_db, scope="function")):
    return require(db, FormDefinition, FORM_KEY)


@router.put("/admin/application-form", response_model=ApplicationFormView)
def save_form(value: ApplicationFormWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    form = require(db, FormDefinition, FORM_KEY, True)
    if form.revision != value.expected_revision:
        fail(409, "revision_conflict", "Another officer changed the questions. Reload before saving.")
    form.questions = [q.model_dump() for q in value.questions]
    form.revision += 1
    audit(db, user, "application.form_edit", FORM_KEY, {"revision": form.revision})
    return form


@router.get("/admin/members/{mid}/application", response_model=ApplicationView)
def review(mid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    return application_view(db, require(db, Member, mid), admin=True)


@router.post("/admin/members/{mid}/application/decision", response_model=ApplicationView)
def decide(mid: int, value: ApplicationDecision, user=Depends(officer), db=Depends(get_db, scope="function")):
    target = require(db, Member, mid, True)
    if target.approval_status != "pending":
        fail(409, "application_decided", "This application is no longer awaiting a decision. Refresh to see its status.")
    record = require(db, ApprovalApplication, mid, True)
    if record.submitted_at != value.expected_submitted_at:
        fail(409, "application_changed", "This application has changed. Refresh before making a decision.")
    target.approval_status = value.decision
    record.reviewed_at, record.reviewed_by = utcnow(), user.id
    record.message = value.message.strip() if value.decision == "denied" else ""
    audit(db, user, "application.decision", mid, {"decision": value.decision})
    return application_view(db, target, admin=True)


@router.post("/admin/members/{mid}/application/reopen", response_model=ApplicationView)
def reopen(mid: int, value: ApplicationReopen, user=Depends(officer), db=Depends(get_db, scope="function")):
    target = require(db, Member, mid, True)
    if target.approval_status != "denied":
        fail(409, "application_changed", "Only a denied application can be reopened. Refresh to see its status.")
    record = require(db, ApprovalApplication, mid, True)
    if record.submitted_at != value.expected_submitted_at:
        fail(409, "application_changed", "This application has changed. Refresh before allowing reapplication.")
    previous = ApprovalApplicationHistory(
        member_id=mid, reopened_by=user.id,
        **{k: getattr(record, k) for k in ApplicationSubmissionView.model_fields},
    )
    db.add(previous)
    db.delete(record)
    target.approval_status = "required"
    db.flush()
    audit(db, user, "application.reopen", mid, {"history_id": previous.id})
    return application_view(db, target, admin=True)
