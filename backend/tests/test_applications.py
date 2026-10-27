from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from app.domain import today
import pytest
from sqlalchemy import func, select
from app.models import ApprovalApplication, ApprovalApplicationHistory, Audit, Event, Member
from app.schemas import ApplicationFormWrite
from app.services.forms import validate_answers
from conftest import cookie, event, person, quarter


def applicant(api, status="required"):
    with api.app.state.sessions() as db:
        m = Member(email="applicant@example.com", name="New Applicant", approval_status=status)
        db.add(m)
        db.commit()
        return m.id


def as_member(api, mid):
    api.cookies.set("aac_session", cookie(mid))


def submission(api, student=False):
    view = api.get("/api/me/application").json()
    answers = {"college_student": "yes" if student else "no", "about": "I enjoy hiking.", "why_join": "To meet other adventurers."}
    if student:
        answers.update(college_email="student@example.edu", school="Example College", grade="2nd year")
    return {"form_revision": view["form_revision"], "answers": answers}


def decide(api, mid, **value):
    current = api.get(f"/api/admin/members/{mid}/application").json()
    return api.post(f"/api/admin/members/{mid}/application/decision", json={
        "expected_submitted_at": current["submitted_at"], **value,
    })


def assert_member_access_blocked(api, q, e):
    for url in ["/api/me/profile", "/api/me/overview", "/api/me/vehicles", "/api/me/signups",
                "/api/me/reimbursements", f"/api/me/memberships/{q['id']}"]:
        response = api.get(url)
        assert response.status_code == 403, url
        assert response.json()["detail"]["code"] == "approval_required"
    signup = api.put(f"/api/events/{e['id']}/signup", json={"role": "own"})
    assert signup.status_code == 403
    assert signup.json()["detail"]["code"] == "approval_required"
    assert api.post(f"/api/me/memberships/{q['id']}", json={"method": "cash"}).status_code == 403
    assert api.get("/api/me/application").status_code == 200
    assert api.get(f"/api/events/{e['id']}").status_code == 200


@pytest.mark.parametrize("student", [False, True])
def test_application_lifecycle_and_independent_dues(api, student):
    q = quarter(api)
    e = event(api, q)
    mid = applicant(api)
    as_member(api, mid)
    value = submission(api, student)
    assert_member_access_blocked(api, q, e)
    response = api.post("/api/me/application", json=value)
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "pending"
    assert response.json()["answers"] == value["answers"]
    assert_member_access_blocked(api, q, e)
    assert api.post("/api/me/application", json=value).status_code == 409
    as_member(api, 1)
    result = decide(api, mid, decision="approved", message="Welcome!")
    assert result.status_code == 200, result.text
    assert result.json()["reviewed_by"] == 1
    as_member(api, mid)
    assert api.get("/api/session").json()["member"]["approval_status"] == "approved"
    assert api.get("/api/me/application").json()["message"] == ""
    assert api.get("/api/me/application").json()["reviewed_by"] is None
    assert api.get("/api/me/profile").status_code == 200
    assert api.get(f"/api/me/memberships/{q['id']}").json()["status"] == "general"
    assert api.post("/api/me/application", json=value).status_code == 409


def test_denied_application_cannot_be_reopened_by_import_or_member_add(api):
    q = quarter(api)
    e = event(api, q)
    mid = applicant(api)
    as_member(api, mid)
    value = submission(api)
    assert api.post("/api/me/application", json=value).status_code == 200
    as_member(api, 1)
    reason = "We cannot approve this application because it does not meet our membership criteria."
    assert decide(api, mid, decision="denied", message=reason).status_code == 200
    assert decide(api, mid, decision="approved").status_code == 409
    reused = api.post("/api/admin/members", json={"name": "New name", "email": "applicant@example.com"})
    assert reused.json()["approval_status"] == "denied"
    assert api.post(f"/api/admin/events/{e['id']}/signups", json={"member_id": mid, "role": "own"}).status_code == 403
    assert api.post(f"/api/admin/events/{e['id']}/walk-ins", json={"member_id": mid, "signup": {"role": "own"}, "request_id": "denied-walkin"}).status_code == 403
    assert api.post(f"/api/admin/members/{mid}/memberships/{q['id']}/decision", json={"category": "exception", "reason": "test"}).status_code == 403
    preview = api.post("/api/admin/imports/preview", json={"quarter_id": q["id"], "mode": "paid_members", "text": "Name,Email\nNew Applicant,applicant@example.com"})
    assert preview.status_code == 200, preview.text
    assert not preview.json()["can_apply"]
    as_member(api, mid)
    assert api.post("/api/me/application", json=value).status_code == 409
    assert api.get("/api/me/application").json()["status"] == "denied"
    assert api.get("/api/me/application").json()["message"] == reason
    assert_member_access_blocked(api, q, e)


def test_configuration_snapshots_and_stale_submission(api):
    mid = applicant(api)
    as_member(api, mid)
    old = submission(api)
    as_member(api, 1)
    form = api.get("/api/admin/application-form").json()
    changed = [*form["questions"], {"id": "new", "label": "Favorite trail?", "kind": "text", "required": True}]
    value = {"expected_revision": form["revision"], "questions": changed}
    assert api.put("/api/admin/application-form", json=value).status_code == 200
    assert api.put("/api/admin/application-form", json=value).status_code == 409
    as_member(api, mid)
    assert api.put("/api/admin/application-form", json=value).status_code == 403
    assert api.post("/api/me/application", json=old).json()["detail"]["code"] == "form_changed"
    updated = submission(api)
    updated["answers"]["new"] = "Coastal trail"
    snapshot = api.post("/api/me/application", json=updated).json()
    as_member(api, 1)
    form = api.get("/api/admin/application-form").json()
    form["questions"][-1]["label"] = "Different question"
    assert api.put("/api/admin/application-form", json={"expected_revision": form["revision"], "questions": form["questions"]}).status_code == 200
    as_member(api, mid)
    assert api.get("/api/me/application").json()["questions"] == snapshot["questions"]


@pytest.mark.parametrize("change", [
    {"about": ""}, {"why_join": "word " * 251}, {"college_student": "maybe"},
    {"unknown": "answer"}, {"about": []}, {"college_student": "yes"},
])
def test_invalid_answers_do_not_submit(api, change):
    mid = applicant(api)
    as_member(api, mid)
    value = submission(api)
    value["answers"].update(change)
    assert api.post("/api/me/application", json=value).status_code == 422
    assert api.get("/api/me/application").json()["status"] == "required"


def test_word_boundaries_hidden_fields_and_email(api):
    mid = applicant(api)
    as_member(api, mid)
    value = submission(api, True)
    value["answers"]["college_email"] = "not an email"
    assert api.post("/api/me/application", json=value).status_code == 422
    value["answers"]["college_student"] = "no"
    value["answers"]["about"] = ("longadventureword\t\n" * 250).strip()
    result = api.post("/api/me/application", json=value)
    assert result.status_code == 200, result.text
    assert "college_email" not in result.json()["answers"]
    assert "school" not in result.json()["answers"]
    assert "grade" not in result.json()["answers"]


def test_question_conditions_reject_cycles_and_invalid_values():
    questions = [{"id": "a", "label": "Student?", "kind": "yes-no"}, {"id": "b", "label": "School", "show_when": {"question_id": "a", "equals": "yes"}}]
    assert ApplicationFormWrite(expected_revision=1, questions=questions)
    with pytest.raises(ValueError):
        ApplicationFormWrite(expected_revision=1, questions=list(reversed(questions)))
    questions[1]["show_when"]["equals"] = "maybe"
    with pytest.raises(ValueError):
        ApplicationFormWrite(expected_revision=1, questions=questions)


def test_pending_queue_is_global_and_distinguishes_membership(api):
    mid = applicant(api)
    as_member(api, mid)
    api.post("/api/me/application", json=submission(api))
    as_member(api, 1)
    assert api.get("/api/admin/overview").json()["attention"][0]["count"] == 1
    assert api.get("/api/admin/members?status=pending").json()["total"] == 1
    q = quarter(api)
    m = person(api)
    as_member(api, m["id"])
    assert api.post(f"/api/me/memberships/{q['id']}", json={"method": "cash"}).status_code == 200
    as_member(api, 1)
    result = api.get("/api/admin/members?status=pending").json()
    assert result["total"] == 2
    assert {row["member"]["id"] for row in result["items"]} == {mid, m["id"]}
    attention = api.get("/api/admin/overview").json()["attention"]
    pending = [item for item in attention if item["kind"] in ("approval", "dues")]
    assert len(pending) == 2
    assert {item["url"] for item in pending} == {f"/admin/members?quarter={q['id']}&status=pending"}
    q2 = quarter(api, name="Other", starts_on=str(today() + timedelta(days=100)), ends_on=str(today() + timedelta(days=180)))
    assert api.get(f"/api/admin/members?status=pending&quarter_id={q2['id']}").json()["total"] == 1


def test_approval_does_not_lift_bans(api):
    q = quarter(api)
    e = event(api, q)
    mid = applicant(api)
    api.post(f"/api/admin/members/{mid}/bans", json={"all_events": True, "membership": True, "reason": "Independent review", "request_id": "approval-ban"})
    as_member(api, mid)
    api.post("/api/me/application", json=submission(api))
    as_member(api, 1)
    decide(api, mid, decision="approved")
    as_member(api, mid)
    assert api.get("/api/me/profile").status_code == 200
    assert api.put(f"/api/events/{e['id']}/signup", json={"role": "own"}).json()["detail"]["code"] == "event_signup_restricted"
    assert api.post(f"/api/me/memberships/{q['id']}", json={"method": "cash"}).json()["detail"]["code"] == "membership_restricted"


def test_concurrent_submit_and_decisions(api):
    mid = applicant(api)
    as_member(api, mid)
    value = submission(api)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: api.post("/api/me/application", json=value), range(2)))
    assert sorted(r.status_code for r in responses) == [200, 409]
    with api.app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(ApprovalApplication)) == 1
    as_member(api, 1)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda decision: decide(api, mid, decision=decision), ["approved", "denied"]))
    assert sorted(r.status_code for r in responses) == [200, 409]


def test_application_privacy_and_trusted_creation(api):
    mid = applicant(api)
    other = person(api)
    as_member(api, other["id"])
    assert api.get(f"/api/admin/members/{mid}/application").status_code == 403
    assert api.get("/api/admin/application-form").status_code == 403
    assert api.get("/api/me/application").json()["status"] == "approved"
    as_member(api, 1)
    created = api.post("/api/admin/members", json={"name": "Trusted", "email": "trusted@example.com"})
    assert created.json()["approval_status"] == "approved"
    api.cookies.clear()
    assert api.get("/api/me/application").status_code == 401


def test_officer_reapplication_preserves_history_and_requires_fresh_review(api):
    q = quarter(api)
    e = event(api, q)
    other = person(api)
    mid = applicant(api)
    api.post(f"/api/admin/members/{mid}/bans", json={
        "all_events": True, "reason": "Independent restriction", "request_id": "reapply-ban",
    })
    as_member(api, mid)
    first = api.post("/api/me/application", json=submission(api)).json()
    as_member(api, 1)
    assert decide(api, mid, decision="denied", message="Original denial reason").status_code == 200
    reopen_url = f"/api/admin/members/{mid}/application/reopen"
    original = {"expected_submitted_at": first["submitted_at"]}
    for identity in [mid, other["id"]]:
        as_member(api, identity)
        assert api.post(reopen_url, json=original).status_code == 403
    api.cookies.clear()
    assert api.post(reopen_url, json=original).status_code == 401
    as_member(api, 1)
    form = api.get("/api/admin/application-form").json()
    form["questions"].append({"id": "new", "label": "Anything new?", "kind": "text", "required": True})
    api.put("/api/admin/application-form", json={"expected_revision": form["revision"], "questions": form["questions"]})
    reopened = api.post(reopen_url, json=original)
    assert reopened.status_code == 200, reopened.text
    assert reopened.json()["status"] == "required"
    assert reopened.json()["answers"] == {}
    assert reopened.json()["submitted_at"] is None
    previous = reopened.json()["previous_applications"][0]
    assert previous["questions"] == first["questions"]
    assert previous["answers"] == first["answers"]
    assert previous["message"] == "Original denial reason"
    assert previous["reviewed_by"] == previous["reopened_by"] == 1
    assert api.post(reopen_url, json=original).status_code == 409
    as_member(api, mid)
    assert api.get("/api/session").json()["member"]["approval_status"] == "required"
    own = api.get("/api/me/application").json()
    assert own["form_revision"] == form["revision"] + 1
    assert own["previous_applications"] == []
    assert_member_access_blocked(api, q, e)
    assert api.post("/api/me/application", json={"form_revision": first["form_revision"], "answers": first["answers"]}).status_code == 409
    body = submission(api)
    body["answers"]["new"] = "I have more experience now."
    second_response = api.post("/api/me/application", json=body)
    assert second_response.status_code == 200, second_response.text
    second = second_response.json()
    assert second["status"] == "pending"
    assert second["reviewed_at"] is None
    assert second["message"] == ""
    assert_member_access_blocked(api, q, e)
    as_member(api, 1)
    assert mid in {r["member"]["id"] for r in api.get("/api/admin/members?status=pending").json()["items"]}
    stale = api.post(f"/api/admin/members/{mid}/application/decision", json={**original, "decision": "approved"})
    assert stale.status_code == 409
    assert decide(api, mid, decision="denied", message="Second denial reason").status_code == 200
    assert api.post(reopen_url, json=original).status_code == 409
    assert api.post(reopen_url, json={"expected_submitted_at": second["submitted_at"]}).status_code == 200
    history = api.get(f"/api/admin/members/{mid}/application").json()["previous_applications"]
    assert [h["message"] for h in history] == ["Second denial reason", "Original denial reason"]
    as_member(api, mid)
    assert api.post("/api/me/application", json=body).status_code == 200
    as_member(api, 1)
    assert decide(api, mid, decision="approved").status_code == 200
    with api.app.state.sessions() as db:
        records = list(db.scalars(select(Audit).where(Audit.action == "application.reopen")))
        assert len(records) == 2
        assert all(record.actor_id == 1 and set(record.data) == {"history_id"} for record in records)
    as_member(api, mid)
    assert api.get("/api/me/profile").status_code == 200
    assert api.put(f"/api/events/{e['id']}/signup", json={"role": "own"}).json()["detail"]["code"] == "event_signup_restricted"


def test_concurrent_reopening_allows_one_new_submission(api):
    mid = applicant(api)
    as_member(api, mid)
    submitted = api.post("/api/me/application", json=submission(api)).json()
    as_member(api, 1)
    decide(api, mid, decision="denied")
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: api.post(f"/api/admin/members/{mid}/application/reopen", json={
            "expected_submitted_at": submitted["submitted_at"],
        }), range(2)))
    assert sorted(r.status_code for r in responses) == [200, 409]
    with api.app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(ApprovalApplicationHistory)) == 1
        assert db.get(ApprovalApplication, mid) is None
    as_member(api, mid)
    value = submission(api)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: api.post("/api/me/application", json=value), range(2)))
    assert sorted(r.status_code for r in responses) == [200, 409]


@pytest.mark.parametrize("status", ["required", "pending", "approved"])
def test_reapplication_only_available_for_denied_members(api, status):
    mid = applicant(api, status)
    assert api.post(f"/api/admin/members/{mid}/application/reopen", json={
        "expected_submitted_at": "2026-10-27T12:00:00Z",
    }).status_code == 409


def test_shared_validator_preserves_import_optional_answers():
    questions = [{"id": "a", "label": "Required", "kind": "text", "required": True}]
    assert validate_answers(questions, {}, require_answers=False) == {}


def test_import_rechecks_new_applicant_and_rolls_back_batch(api):
    q = quarter(api)
    preview = api.post("/api/admin/imports/preview", json={
        "quarter_id": q["id"], "mode": "paid_members",
        "text": "Name,Email\nOther,other-import@example.com\nApplicant,applicant@example.com",
    }).json()
    assert preview["can_apply"]
    applicant(api)
    response = api.post(f"/api/admin/imports/{preview['id']}/apply", json={"request_hash": preview["request_hash"]})
    assert response.status_code == 403
    with api.app.state.sessions() as db:
        assert db.scalar(select(Member.id).where(Member.email == "other-import@example.com")) is None


def test_legacy_event_questions_remain_editable_without_changing_frozen_fields(api):
    question = {"id": "experience", "label": "Experience", "kind": "text", "required": False, "options": []}
    e = event(api, quarter(api), questions=[question])
    m = person(api)
    assert api.post(f"/api/admin/events/{e['id']}/signups", json={"member_id": m["id"], "role": "own"}).status_code == 200
    with api.app.state.sessions() as db:
        # A pre-migration JSON definition has neither new optional property.
        db.get(Event, e["id"]).questions = [question]
        db.commit()
    from app.schemas import EventWrite

    body = {k: v for k, v in e.items() if k in EventWrite.model_fields}
    body["description"] = "An updated event description"
    assert api.put(f"/api/admin/events/{e['id']}", json=body).status_code == 200


def test_event_forms_share_conditional_validation(api):
    questions = [
        {"id": "student", "label": "Student?", "kind": "yes-no", "required": True},
        {"id": "school", "label": "School email", "kind": "email", "required": True, "show_when": {"question_id": "student", "equals": "yes"}},
        {"id": "intro", "label": "Introduction", "kind": "long", "max_words": 3},
    ]
    e = event(api, quarter(api), questions=questions)
    m = person(api)
    as_member(api, m["id"])
    url = f"/api/events/{e['id']}/signup"
    assert api.put(url, json={"role": "own", "answers": {"student": "yes"}}).status_code == 422
    assert api.put(url, json={"role": "own", "answers": {"student": "no", "intro": "one two three four"}}).status_code == 422
    result = api.put(url, json={"role": "own", "answers": {"student": "no", "school": "hidden", "intro": "one two three"}})
    assert result.status_code == 200
    assert result.json()["answers"] == {"student": "no", "intro": "one two three"}
