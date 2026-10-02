import pytest
from sqlalchemy import select

from app.models import AttendanceAction, Audit, Card, Event, Recap, Signup, Trip
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


@pytest.mark.parametrize("history", ["signup", "cancelled_signup", "trip", "card", "attendance", "published_recap"])
def test_cancelled_deletion_preserves_participation_and_published_history(api, history):
    q = quarter(api)
    e = event(api, q)
    s = signup(api, e, person(api)) if history in {"signup", "cancelled_signup", "attendance"} else None
    e = cancel(api, api.get(f"/api/admin/events/{e['id']}").json())
    with api.app.state.sessions() as db:
        if history == "cancelled_signup":
            db.get(Signup, s["id"]).cancelled = True
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
    e = cancel(api, series["occurrences"][0])
    assert remove(api, f"/api/admin/events/{e['id']}", e["revision"]).status_code == 200
    current = api.get(f"/api/admin/series/{series['id']}").json()
    assert current["revision"] == series["revision"] + 2
    assert series["definition"]["starts_on"] in current["definition"]["excluded"]
    update = {**current["definition"], "expected_revision": current["revision"]}
    update["event"]["name"] = "Remaining weekly meetings"
    response = api.put(f"/api/admin/series/{series['id']}", json=update)
    assert response.status_code == 200, response.text
    assert len(response.json()["occurrences"]) == 2
    assert api.get(f"/api/admin/events/{e['id']}").status_code == 404


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
