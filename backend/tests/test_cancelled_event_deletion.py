import pytest
from sqlalchemy import select

from app.domain import utcnow
from app.models import AttendanceAction, Audit, Card, Event, Member, Recap, Signup, Trip, Vehicle
from conftest import cookie, event, person, quarter, signup
from test_draft_lifecycle import create_series, remove


def cancel(api, e):
    response = api.post(
        f"/api/admin/events/{e['id']}/state",
        json={"state": "cancelled", "reason": "Duplicate event", "expected_revision": e["revision"]},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_delete_cancelled_event_removes_calendar_entry_and_private_recap(api):
    q = quarter(api)
    e = cancel(api, event(api, q, signups_enabled=False))
    assert api.put(f"/api/admin/events/{e['id']}/recap", json={"title": "Private recap"}).status_code == 200
    url = f"/api/admin/events/{e['id']}"
    assert remove(api, url, e["revision"] - 1).status_code == 409
    assert api.get(url).status_code == 200
    assert remove(api, url, e["revision"]).status_code == 200
    assert api.get(url).status_code == 404
    assert api.get(f"/api/events/{e['id']}").status_code == 404
    assert api.get(f"/api/admin/events?quarter_id={q['id']}").json()["total"] == 0
    assert api.get(f"/api/events?from={q['starts_on']}&to={q['ends_on']}").json()["total"] == 0
    with api.app.state.sessions() as db:
        assert db.get(Event, e["id"]) is None
        assert db.get(Recap, e["id"]) is None
        entry = db.scalar(select(Audit).where(Audit.action == "event.delete"))
        assert entry.entity == str(e["id"])
        assert entry.data == {"name": e["name"], "series_id": None, "state": "cancelled"}


@pytest.mark.parametrize("state", ["open", "finalized", "archived"])
def test_cancelled_deletion_obeys_officer_access_and_quarter_lock(api, state):
    q = quarter(api)
    e = cancel(api, event(api, q))
    m = person(api)
    url = f"/api/admin/events/{e['id']}"
    api.cookies.clear()
    assert remove(api, url, e["revision"]).status_code == 401
    api.cookies.set("aac_session", cookie(m["id"]))
    assert remove(api, url, e["revision"]).status_code == 403
    api.cookies.set("aac_session", cookie(1))
    if state != "open":
        assert api.post(f"/api/admin/quarters/{q['id']}/finalize").status_code == 200
        if state == "archived":
            assert api.post(f"/api/admin/quarters/{q['id']}/archive").status_code == 200
        assert remove(api, url, e["revision"]).status_code == 409
        assert api.get(url).status_code == 200
    else:
        assert remove(api, url, e["revision"]).status_code == 200


@pytest.mark.parametrize("role", ["ride", "driver", "own"])
@pytest.mark.parametrize("cancelled_signup", [False, True])
def test_delete_cancelled_event_removes_unattended_signups(api, role, cancelled_signup):
    q = quarter(api)
    e = event(api, q)
    m = person(api)
    s = signup(api, e, m, role)
    other = event(api, q, name="Event to keep")
    other_signup = signup(api, other, m, "own")
    if cancelled_signup:
        assert api.delete(f"/api/admin/signups/{s['id']}").status_code == 200
    e = cancel(api, api.get(f"/api/admin/events/{e['id']}").json())
    assert api.put(f"/api/admin/events/{e['id']}/recap", json={"title": "Private recap"}).status_code == 200
    url = f"/api/admin/events/{e['id']}"
    assert remove(api, url, e["revision"] - 1).status_code == 409
    with api.app.state.sessions() as db:
        assert db.get(Signup, s["id"]) is not None
    assert remove(api, url, e["revision"]).status_code == 200
    assert api.get(url).status_code == 404
    assert api.get(f"/api/events/{e['id']}").status_code == 404
    api.cookies.set("aac_session", cookie(m["id"]))
    remaining = api.get(f"/api/me/signups?quarter_id={q['id']}").json()["items"]
    assert [row["id"] for row in remaining] == [other_signup["id"]]
    with api.app.state.sessions() as db:
        assert db.get(Signup, s["id"]) is None
        assert db.get(Signup, other_signup["id"]) is not None
        assert db.get(Member, m["id"]) is not None
        if role == "driver":
            assert db.get(Vehicle, s["vehicle_id"]) is not None
        assert db.get(Recap, e["id"]) is None
        assert db.scalar(select(Audit.id).where(Audit.action == "event.delete")) is not None


@pytest.mark.parametrize("history", ["checked_in_signup", "trip", "card", "attendance", "published_recap"])
def test_cancelled_deletion_preserves_participation_and_published_history(api, history):
    q = quarter(api)
    e = event(api, q)
    s = signup(api, e, person(api))
    e = cancel(api, api.get(f"/api/admin/events/{e['id']}").json())
    with api.app.state.sessions() as db:
        if history == "checked_in_signup":
            db.get(Signup, s["id"]).checked_in_at = utcnow()
        elif history == "trip":
            db.add(Trip(event_id=e["id"], member_id=1))
        elif history == "card":
            db.add(Card(event_id=e["id"], category="general", number=1, voided=True))
        elif history == "attendance":
            db.add(AttendanceAction(event_id=e["id"], signup_id=s["id"], actor_id=1, action="undo"))
        elif history == "published_recap":
            db.add(Recap(event_id=e["id"], published={"title": "Published history"}))
        db.commit()
    response = remove(api, f"/api/admin/events/{e['id']}", e["revision"])
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "participation_exists"
    assert api.get(f"/api/admin/events/{e['id']}").status_code == 200
    with api.app.state.sessions() as db:
        assert db.scalar(select(Audit.id).where(Audit.action == "event.delete")) is None
        if s:
            assert db.get(Signup, s["id"]) is not None
        if history == "trip":
            assert db.scalar(select(Trip.id).where(Trip.event_id == e["id"])) is not None


def test_deleted_cancelled_series_date_does_not_reappear(api):
    q = quarter(api)
    series = create_series(api, q)
    occurrence = series["occurrences"][0]
    assert (
        api.post(f"/api/admin/events/{occurrence['id']}/state", json={"state": "published"}).status_code
        == 200
    )
    s = signup(api, occurrence, person(api))
    e = cancel(api, api.get(f"/api/admin/events/{occurrence['id']}").json())
    assert remove(api, f"/api/admin/events/{e['id']}", e["revision"]).status_code == 200
    current = api.get(f"/api/admin/series/{series['id']}").json()
    assert current["revision"] == series["revision"] + 3
    assert series["definition"]["starts_on"] in current["definition"]["excluded"]
    update = {**current["definition"], "expected_revision": current["revision"]}
    update["event"]["name"] = "Remaining weekly meetings"
    response = api.put(f"/api/admin/series/{series['id']}", json=update)
    assert response.status_code == 200, response.text
    assert len(response.json()["occurrences"]) == 2
    assert api.get(f"/api/admin/events/{e['id']}").status_code == 404
    with api.app.state.sessions() as db:
        assert db.get(Signup, s["id"]) is None


def test_undone_check_in_still_preserves_event_history(api):
    q = quarter(api)
    e = event(api, q)
    s = signup(api, e, person(api), "own")
    assert api.post(f"/api/admin/signups/{s['id']}/check-in").status_code == 200
    assert api.delete(f"/api/admin/signups/{s['id']}/check-in").status_code == 200
    e = cancel(api, api.get(f"/api/admin/events/{e['id']}").json())
    response = remove(api, f"/api/admin/events/{e['id']}", e["revision"])
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "participation_exists"
    with api.app.state.sessions() as db:
        assert db.get(Signup, s["id"]).checked_in_at is None
        assert (
            len(list(db.scalars(select(AttendanceAction).where(AttendanceAction.event_id == e["id"])))) == 2
        )


@pytest.mark.parametrize("state", ["published", "completed"])
def test_active_and_completed_events_still_cannot_be_deleted(api, state):
    q = quarter(api)
    e = event(api, q)
    if state == "completed":
        response = api.post(f"/api/admin/events/{e['id']}/state", json={"state": "completed"})
        assert response.status_code == 200
        e = response.json()
    response = remove(api, f"/api/admin/events/{e['id']}", e["revision"])
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "cannot_delete"
    assert api.get(f"/api/admin/events/{e['id']}").status_code == 200
