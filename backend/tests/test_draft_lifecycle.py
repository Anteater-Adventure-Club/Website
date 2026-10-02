import copy

import pytest
from sqlalchemy import func, select

from app.models import Audit, Event, Recap, Series, Trip
from conftest import cookie, event, person, quarter, signup
from test_event_rules import series_input


def remove(api, url, revision=None):
    return api.request("DELETE", url, json={"expected_revision": revision})


def create_series(api, q):
    response = api.post("/api/admin/series", json=series_input(q))
    assert response.status_code == 201, response.text
    return response.json()


def test_delete_draft_cleans_recap_and_records_audit(api):
    q = quarter(api)
    e = event(api, q, publish=False)
    response = api.put(f"/api/admin/events/{e['id']}/recap", json={"title": "Private recap draft"})
    assert response.status_code == 200
    assert remove(api, f"/api/admin/events/{e['id']}", e["revision"] + 1).status_code == 409
    assert api.get(f"/api/admin/events/{e['id']}").status_code == 200
    assert remove(api, f"/api/admin/events/{e['id']}", e["revision"]).status_code == 200
    assert api.get(f"/api/admin/events/{e['id']}").status_code == 404
    with api.app.state.sessions() as db:
        assert db.get(Recap, e["id"]) is None
        assert db.scalar(select(Audit.action).where(Audit.action == "event.delete")) == "event.delete"


def test_draft_deletion_obeys_officer_and_quarter_locks(api):
    q = quarter(api)
    e = event(api, q, publish=False)
    m = person(api)
    api.cookies.set("aac_session", cookie(m["id"]))
    assert remove(api, f"/api/admin/events/{e['id']}").status_code == 403
    api.cookies.set("aac_session", cookie(1))
    assert api.post(f"/api/admin/quarters/{q['id']}/finalize").status_code == 200
    assert remove(api, f"/api/admin/events/{e['id']}").status_code == 409
    assert api.get(f"/api/admin/events/{e['id']}").status_code == 200


def test_published_and_participating_events_cannot_be_deleted(api):
    q = quarter(api)
    e = event(api, q)
    signup(api, e, person(api))
    assert remove(api, f"/api/admin/events/{e['id']}").status_code == 409
    assert api.get(f"/api/admin/events/{e['id']}").status_code == 200
    draft = event(api, q, publish=False)
    with api.app.state.sessions() as db:
        db.add(Trip(event_id=draft["id"], member_id=1))
        db.commit()
    response = remove(api, f"/api/admin/events/{draft['id']}")
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "participation_exists"


def test_recurring_drafts_have_one_attention_item_per_series(api):
    q = quarter(api)
    series = create_series(api, q)
    extra = event(api, q, publish=False)
    draft_items = [
        i
        for i in api.get(f"/api/admin/overview?quarter_id={q['id']}").json()["attention"]
        if i["kind"] == "draft"
    ]
    assert len(draft_items) == 2
    series_item = next(i for i in draft_items if i["url"] == f"/admin/series/{series['id']}")
    assert series_item["count"] == len(series["occurrences"])
    assert next(i for i in draft_items if i["count"] == 1)["url"].endswith(f"/{extra['id']}/edit")
    e = series["occurrences"][0]
    assert api.post(f"/api/admin/events/{e['id']}/skip", json={}).status_code == 200
    draft_items = [
        i
        for i in api.get(f"/api/admin/overview?quarter_id={q['id']}").json()["attention"]
        if i["kind"] == "draft"
    ]
    assert next(i for i in draft_items if i["url"] == series_item["url"])["count"] == 2


def test_deleting_a_draft_series_is_atomic_and_respects_revision(api):
    q = quarter(api)
    series = create_series(api, q)
    url = f"/api/admin/series/{series['id']}"
    assert remove(api, url, series["revision"] + 1).status_code == 409
    assert len(api.get(url).json()["occurrences"]) == 3
    first = series["occurrences"][0]
    assert api.post(f"/api/admin/events/{first['id']}/state", json={"state": "published"}).status_code == 200
    assert remove(api, url, api.get(url).json()["revision"]).status_code == 409
    assert len(api.get(url).json()["occurrences"]) == 3
    assert api.post(f"/api/admin/events/{first['id']}/state", json={"state": "draft"}).status_code == 200
    assert remove(api, url, api.get(url).json()["revision"]).status_code == 200
    assert api.get(url).status_code == 404
    assert api.get(f"/api/admin/events?quarter_id={q['id']}").json()["total"] == 0


def test_deleted_draft_occurrence_does_not_reappear_on_series_edit(api):
    q = quarter(api)
    series = create_series(api, q)
    first = series["occurrences"][0]
    assert remove(api, f"/api/admin/events/{first['id']}", first["revision"]).status_code == 200
    current = api.get(f"/api/admin/series/{series['id']}").json()
    assert series["definition"]["starts_on"] in current["definition"]["excluded"]
    update = {**current["definition"], "expected_revision": current["revision"]}
    update["event"]["name"] = "Edited weekly hangout"
    response = api.put(f"/api/admin/series/{series['id']}", json=update)
    assert response.status_code == 200, response.text
    assert len(response.json()["occurrences"]) == 2
    assert api.get(f"/api/admin/events/{first['id']}").status_code == 404


def test_recurring_draft_becomes_one_existing_event_without_duplicates(api):
    q = quarter(api)
    series = create_series(api, q)
    first = series["occurrences"][0]
    value = {"event": series["definition"]["event"], "expected_revision": series["revision"]}
    value["event"]["name"] = "One hangout"
    response = api.post(f"/api/admin/series/{series['id']}/single", json=value)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["id"] == first["id"]
    assert result["series_id"] is None
    assert result["name"] == "One hangout"
    assert result["revision"] == first["revision"] + 1
    assert api.get(f"/api/admin/series/{series['id']}").status_code == 404
    assert api.get(f"/api/admin/events?quarter_id={q['id']}").json()["total"] == 1
    with api.app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(Series)) == 0


@pytest.mark.parametrize("conflict", ["stale", "published", "trip", "invalid_dates"])
def test_failed_series_conversion_preserves_all_occurrences(api, conflict):
    q = quarter(api)
    series = create_series(api, q)
    first = series["occurrences"][0]
    value = {"event": copy.deepcopy(series["definition"]["event"]), "expected_revision": series["revision"]}
    if conflict == "stale":
        value["expected_revision"] += 1
    elif conflict == "published":
        api.post(f"/api/admin/events/{first['id']}/state", json={"state": "published"})
        value["expected_revision"] = api.get(f"/api/admin/series/{series['id']}").json()["revision"]
    elif conflict == "trip":
        with api.app.state.sessions() as db:
            db.add(Trip(event_id=first["id"], member_id=1))
            db.commit()
    else:
        value["event"].update(starts_at="2020-01-01T18:00:00Z", ends_at="2020-01-01T19:00:00Z")
    response = api.post(f"/api/admin/series/{series['id']}/single", json=value)
    assert response.status_code in (409, 422), response.text
    current = api.get(f"/api/admin/series/{series['id']}").json()
    assert [e["id"] for e in current["occurrences"]] == [e["id"] for e in series["occurrences"]]


def test_single_draft_can_become_recurring_without_leaving_an_extra_event(api):
    q = quarter(api)
    value = series_input(q)
    e = event(api, q, publish=False, **value["event"])
    value["expected_revision"] = e["revision"]
    response = api.post(f"/api/admin/events/{e['id']}/series", json=value)
    assert response.status_code == 200, response.text
    series = response.json()
    assert series["occurrences"][0]["id"] == e["id"]
    assert api.get(f"/api/admin/events?quarter_id={q['id']}").json()["total"] == 3
    with api.app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(Event)) == 3


def test_individual_edits_invalidate_stale_series_deletion_and_conversion(api):
    q = quarter(api)
    series = create_series(api, q)
    first = series["occurrences"][0]
    update = {
        **series["definition"]["event"],
        "name": "Individually updated draft",
        "expected_revision": first["revision"],
    }
    assert api.put(f"/api/admin/events/{first['id']}", json=update).status_code == 200
    url = f"/api/admin/series/{series['id']}"
    assert remove(api, url, series["revision"]).status_code == 409
    assert (
        api.post(url + "/single", json={"event": update, "expected_revision": series["revision"]}).status_code
        == 409
    )
    current = api.get(url).json()
    assert len(current["occurrences"]) == 3
    assert current["occurrences"][0]["name"] == update["name"]


def test_series_conversion_keeps_first_active_occurrence_after_a_skip(api):
    q = quarter(api)
    series = create_series(api, q)
    first = series["occurrences"][0]
    assert api.post(f"/api/admin/events/{first['id']}/skip", json={}).status_code == 200
    current = api.get(f"/api/admin/series/{series['id']}").json()
    response = api.post(
        f"/api/admin/series/{series['id']}/single",
        json={"event": current["definition"]["event"], "expected_revision": current["revision"]},
    )
    assert response.status_code == 200, response.text
    assert response.json()["id"] == series["occurrences"][1]["id"]
    assert api.get(f"/api/admin/events/{first['id']}").status_code == 404
