from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.domain import utcnow
from app.models import EventForm, EventFormResponse, Signup, Member, Audit, Quarter
from conftest import cookie, event, person, quarter, signup

QUESTIONS = [
    {"id": "camping", "label": "Are you camping?", "kind": "yes-no", "required": True},
    {"id": "gear", "label": "Gear needed", "kind": "long", "required": True, "max_words": 10,
     "show_when": {"question_id": "camping", "equals": "yes"}},
]


def create_form(api, e, **extra):
    at = utcnow()
    response = api.post(f"/api/admin/events/{e['id']}/forms", json={
        "title": "Gear check", "questions": QUESTIONS, "opens_at": (at - timedelta(hours=1)).isoformat(),
        "closes_at": (at + timedelta(hours=2)).isoformat(), "required": True, "state": "published", **extra,
    })
    assert response.status_code == 201, response.text
    return response.json()


def setup(api, **extra):
    e = event(api, quarter(api))
    m = person(api)
    s = signup(api, e, m)
    f = create_form(api, e, **extra)
    return e, m, s, f


def url(e, f, admin=False):
    return f"/api/{'admin/' if admin else ''}events/{e['id']}/forms/{f['number']}"


def respond(api, e, f, **extra):
    return api.put(url(e, f) + "/response", json={"form_revision": f["revision"], "answers": {"camping": "no"}, **extra})


def edit(api, e, f, **extra):
    body = {key: f[key] for key in (
        "title", "instructions", "questions", "opens_at", "closes_at", "required", "allow_late", "state",
    )}
    response = api.put(url(e, f, True), json={**body, "expected_revision": f["revision"], **extra})
    return response


def test_access_and_conditional_validation(api):
    e, m, s, f = setup(api)
    assert api.get(url(e, f)).status_code == 403  # officers preview through admin
    api.cookies.set("aac_session", cookie(m["id"]))
    assert api.get(url(e, f, True)).status_code == 403
    assert api.get("/api/me/event-forms/attention").json()["items"][0]["number"] == f["number"]
    assert respond(api, e, f, answers={"camping": "yes"}).status_code == 422
    assert respond(api, e, f, answers={"camping": "yes", "gear": "word " * 11}).status_code == 422
    r = respond(api, e, f, answers={"camping": "no", "gear": "hidden"})
    assert r.status_code == 200, r.text
    assert r.json()["response"]["answers"] == {"camping": "no"}
    assert r.json()["status"] == "responded"
    assert api.get("/api/me/event-forms/attention").json()["items"] == []
    r2 = respond(api, e, f, expected_revision=1, answers={"camping": "yes", "gear": "Sleeping bag"})
    assert r2.status_code == 200, r2.text
    assert r2.json()["response"]["revision"] == 2
    assert r2.json()["response"]["submitted_at"] == r.json()["response"]["submitted_at"]
    assert respond(api, e, f, expected_revision=1).status_code == 409
    with api.app.state.sessions() as db:
        records = list(db.scalars(select(Audit).where(Audit.action == "event_form.respond")))
        assert len(records) == 2
        assert all("answers" not in record.data for record in records)


@pytest.mark.parametrize("late", [False, True])
def test_deadline_and_late_first_response(api, late):
    e, m, s, f = setup(api, closes_at=(utcnow() - timedelta(minutes=5)).isoformat(), allow_late=late)
    with api.app.state.sessions.begin() as db:
        db.get(Signup, s["id"]).registered_at = utcnow() - timedelta(days=1)
    api.cookies.set("aac_session", cookie(m["id"]))
    own = api.get(url(e, f)).json()
    assert own["status"] == "no_response"
    assert own["can_submit"] is late
    assert bool(api.get("/api/me/event-forms/attention").json()["items"]) is late
    response = respond(api, e, f)
    assert response.status_code == (200 if late else 409), response.text
    if late:
        assert response.json()["status"] == "responded_late"
        assert not response.json()["can_submit"]
        assert respond(api, e, f, expected_revision=1).status_code == 409
    api.cookies.set("aac_session", cookie(1))
    roster = api.get(f"/api/admin/events/{e['id']}/signups?form_status=no_response")
    assert roster.status_code == 200, roster.text
    assert roster.json()["total"] == (0 if late else 1)
    with api.app.state.sessions() as db:
        assert not db.get(Signup, s["id"]).cancelled


def test_late_signup_exemption_and_optional_forms(api):
    e, m, s, f = setup(api, closes_at=(utcnow() - timedelta(minutes=5)).isoformat())
    api.cookies.set("aac_session", cookie(m["id"]))
    assert api.get(url(e, f)).json()["status"] == "not_required"
    api.cookies.set("aac_session", cookie(1))
    f2 = edit(api, e, f, required=False).json()
    api.cookies.set("aac_session", cookie(m["id"]))
    assert api.get(url(e, f2)).json()["status"] == "not_submitted"
    assert api.get("/api/me/event-forms/attention").json()["items"] == []


def test_rejoin_preserves_missed_requirement(api):
    e, m, s, f = setup(api, closes_at=(utcnow() - timedelta(minutes=5)).isoformat())
    before = utcnow() - timedelta(days=1)
    with api.app.state.sessions.begin() as db:
        db.get(Signup, s["id"]).registered_at = before
    assert api.delete(f"/api/admin/signups/{s['id']}").status_code == 200
    signup(api, e, m)
    api.cookies.set("aac_session", cookie(m["id"]))
    assert api.get(url(e, f)).json()["status"] == "no_response"
    with api.app.state.sessions() as db:
        assert db.get(Signup, s["id"]).registered_at == before


def test_questions_lock_and_metadata_can_change(api):
    e, m, s, f = setup(api)
    api.cookies.set("aac_session", cookie(m["id"]))
    assert respond(api, e, f).status_code == 200
    api.cookies.set("aac_session", cookie(1))
    assert edit(api, e, f, questions=[{**QUESTIONS[0], "label": "Changed"}]).status_code == 409
    updated = edit(api, e, f, title="Final gear check", allow_late=True)
    assert updated.status_code == 200, updated.text
    assert updated.json()["questions_locked"]
    assert edit(api, e, f).status_code == 409
    api.cookies.set("aac_session", cookie(m["id"]))
    assert respond(api, e, f, expected_revision=1).json()["detail"]["code"] == "form_changed"


def test_draft_scheduled_archived_cancelled_and_quarter_locked(api):
    e, m, s, f = setup(api, state="draft")
    api.cookies.set("aac_session", cookie(m["id"]))
    assert api.get(url(e, f)).status_code == 404
    assert respond(api, e, f).status_code == 409
    api.cookies.set("aac_session", cookie(1))
    f = edit(api, e, f, state="published", opens_at=(utcnow() + timedelta(hours=1)).isoformat()).json()
    api.cookies.set("aac_session", cookie(m["id"]))
    assert api.get(url(e, f)).json()["phase"] == "scheduled"
    assert respond(api, e, f).status_code == 409
    api.cookies.set("aac_session", cookie(1))
    f = edit(api, e, f, state="archived").json()
    api.cookies.set("aac_session", cookie(m["id"]))
    assert api.get(url(e, f)).json()["phase"] == "archived"
    assert api.get("/api/me/event-forms/attention").json()["items"] == []
    with api.app.state.sessions.begin() as db:
        form = db.get(EventForm, f["id"])
        form.state, form.opens_at = "published", utcnow() - timedelta(hours=1)
        db.get(Quarter, e["quarter_id"]).state = "finalized"
    assert respond(api, e, f).status_code == 409
    assert api.get("/api/me/event-forms/attention").json()["items"] == []


def test_cancelled_signup_and_unapproved_members_cannot_submit(api):
    e, m, s, f = setup(api)
    api.delete(f"/api/admin/signups/{s['id']}")
    api.cookies.set("aac_session", cookie(m["id"]))
    assert api.get(url(e, f)).status_code == 403
    assert respond(api, e, f).status_code == 403
    assert api.get("/api/me/event-forms/attention").json()["items"] == []
    with api.app.state.sessions.begin() as db:
        db.get(Signup, s["id"]).cancelled = False
        db.get(Member, m["id"]).approval_status = "pending"
    assert respond(api, e, f).status_code == 403


def test_template_defaults_are_atomic_and_copies_are_independent(api):
    body = {"kind": "signup", "title": "Retreat signup", "questions": QUESTIONS, "default_event_kinds": ["retreat"]}
    first = api.post("/api/admin/form-templates", json=body).json()
    second = api.post("/api/admin/form-templates", json={**body, "title": "New default"}).json()
    views = {v["key"]: v for v in api.get("/api/admin/form-templates").json()["items"]}
    assert views[first["key"]]["default_event_kinds"] == []
    assert views[second["key"]]["default_event_kinds"] == ["retreat"]
    assert api.put("/api/admin/form-templates/" + first["key"], json={**body, "expected_revision": 1}).status_code == 409
    e, m, s, f = setup(api)
    assert api.put("/api/admin/form-templates/" + second["key"], json={
        **body, "questions": [QUESTIONS[0]], "expected_revision": second["revision"],
    }).status_code == 200
    assert len(api.get(url(e, f, True)).json()["questions"]) == 2
    assert api.put("/api/admin/form-templates/external-members", json=body).status_code == 404


def test_concurrent_first_responses_and_event_deletion_history(api):
    e, m, s, f = setup(api)
    def send(_):
        with TestClient(api.app, headers={"Origin": "http://testserver"}) as client:
            client.cookies.set("aac_session", cookie(m["id"]))
            return respond(client, e, f).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(send, range(2))) == [200, 409]
    with api.app.state.sessions() as db:
        assert len(list(db.scalars(select(EventFormResponse)))) == 1
    assert api.post(f"/api/admin/events/{e['id']}/state", json={"state": "cancelled", "reason": "Weather"}).status_code == 200
    assert api.request("DELETE", f"/api/admin/events/{e['id']}", json={}).status_code == 409


def test_form_times_and_multiple_reminders(api):
    e, m, s, f = setup(api)
    second = create_form(api, e, title="Final confirmation")
    api.cookies.set("aac_session", cookie(m["id"]))
    assert len(api.get("/api/me/event-forms/attention").json()["items"]) == 2
    assert respond(api, e, f).status_code == 200
    assert [x["id"] for x in api.get("/api/me/event-forms/attention").json()["items"]] == [second["id"]]
    api.cookies.set("aac_session", cookie(1))
    assert edit(api, e, second, closes_at=second["opens_at"]).status_code == 422
    assert edit(api, e, second, opens_at="2026-10-27T12:00:00").status_code == 422
    rows = api.get(url(e, f, True) + "/responses").json()
    assert rows["items"][0]["response"]["answers"] == {"camping": "no"}
    assert rows["items"][0]["status"] == "responded"
    api.cookies.clear()
    assert api.get(url(e, f)).status_code == 401


def test_unpublished_or_archived_forms_do_not_flag_missing_responses(api):
    e, m, s, f = setup(api, state="draft", closes_at=(utcnow() - timedelta(minutes=5)).isoformat())
    with api.app.state.sessions.begin() as db:
        db.get(Signup, s["id"]).registered_at = utcnow() - timedelta(days=1)
    rows = api.get(url(e, f, True) + "/responses").json()["items"]
    assert rows[0]["status"] == "not_open"
    f = edit(api, e, f, state="published").json()
    assert api.get(url(e, f, True) + "/responses").json()["items"][0]["status"] == "no_response"
    f = edit(api, e, f, state="archived").json()
    assert api.get(url(e, f, True) + "/responses").json()["items"][0]["status"] == "not_required"
    assert api.get(f"/api/admin/events/{e['id']}/signups").json()["items"][0]["form_statuses"] == []


def test_private_form_links_have_nonindexable_metadata(api):
    response = api.get("/api/page-metadata", headers={"X-AAC-Page-URI": "/events/private-trip/123/form/1"})
    assert response.status_code == 200
    assert "Event Form |" in response.text
    assert "noindex" in response.text
    assert "private-trip" not in response.text
