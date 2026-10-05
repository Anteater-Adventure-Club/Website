import json
from pathlib import Path

import pytest

from app import person_search
from app.models import Signup
from app.person_search import rank_people
from conftest import cookie, event, quarter, signup

CASES = json.loads((Path(__file__).parent / "fixtures/person-search.json").read_text())


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["label"])
def test_shared_ranking_examples(case):
    assert [row["id"] for row in rank_people(case["people"], case["query"])] == case["expected"]


def add(api, name, index):
    response = api.post("/api/admin/members", json={"name": name, "email": f"search-{index}@uci.edu"})
    assert response.status_code == 201, response.text
    return response.json()


def test_member_search_ranks_before_pagination_and_respects_membership(api):
    q = quarter(api)
    for i in range(55):
        add(api, f"Zara Person {i}", i)
    closest = add(api, "Zarah Person", 60)
    paid = add(api, "Zaraa Person", 61)
    assert (
        api.post(
            f"/api/admin/members/{paid['id']}/memberships/{q['id']}/decision",
            json={"category": "exception", "reason": "Search fixture"},
        ).status_code
        == 200
    )
    result = api.get("/api/admin/members?search=Zarah&limit=10").json()
    assert result["items"][0]["member"]["id"] == closest["id"]
    assert result["total"] == 57
    second = api.get("/api/admin/members?search=Zarah&limit=10&offset=10").json()
    assert second["total"] == 57
    assert not {row["member"]["id"] for row in result["items"]}.intersection(
        row["member"]["id"] for row in second["items"]
    )
    filtered = api.get(f"/api/admin/members?search=Zarah&status=exception&quarter_id={q['id']}").json()
    assert [row["member"]["id"] for row in filtered["items"]] == [paid["id"]]
    assert filtered["total"] == 1
    assert api.get("/api/admin/members?search=zzzz&limit=10").json()["total"] == 0


def test_event_search_ranks_before_pagination_and_keeps_event_and_role(api):
    q = quarter(api)
    first = event(api, q)
    second = event(api, q, name="Other event")
    for i in range(52):
        signup(api, first, add(api, f"Zara Person {i}", i))
    closest = add(api, "Zarah Person", 60)
    target = signup(api, first, closest)
    own = add(api, "Zarah Person", 61)
    own_signup = signup(api, first, own, "own")
    signup(api, second, add(api, "Zarah Person", 62))
    url = f"/api/admin/events/{first['id']}/signups"
    result = api.get(url + "?search=Zarah&limit=50&role=ride").json()
    assert result["items"][0]["id"] == target["id"]
    assert result["total"] == 53
    tail = api.get(url + "?search=Zarah&limit=50&offset=50&role=ride").json()
    assert len(tail["items"]) == 3
    assert tail["total"] == 53
    assert not {row["id"] for row in result["items"]}.intersection(row["id"] for row in tail["items"])
    assert [row["id"] for row in api.get(url + "?search=Zarah&role=own").json()["items"]] == [
        own_signup["id"]
    ]
    email = api.get(url + "?search=search-60%40uci.edu").json()
    assert [row["id"] for row in email["items"]] == [target["id"]]
    assert email["total"] == 1


def test_search_access_and_default_order_are_preserved(api):
    q = quarter(api)
    e = event(api, q)
    z = add(api, "Zulu Person", 1)
    a = add(api, "Alpha Person", 2)
    zs, als = signup(api, e, z), signup(api, e, a)
    url = f"/api/admin/events/{e['id']}/signups"
    assert [row["id"] for row in api.get(url + "?search=%20%20").json()["items"]] == [zs["id"], als["id"]]
    items = api.get("/api/admin/members?search=%20%20").json()["items"]
    assert items == api.get("/api/admin/members").json()["items"]
    api.cookies.set("aac_session", cookie(z["id"]))
    assert api.get("/api/admin/members?search=Zulu").status_code == 403
    assert api.get(url + "?search=Zulu").status_code == 403
    api.cookies.clear()
    assert api.get("/api/admin/members?search=Zulu").status_code == 401


def test_hydration_retains_role_filter_if_another_desk_changes_a_signup(api, monkeypatch):
    q = quarter(api)
    e = event(api, q)
    target = signup(api, e, add(api, "Srinivasan Patel", 1))
    original = person_search.rank_people

    def changed_during_search(rows, query):
        ranked = original(rows, query)
        with api.app.state.sessions() as db:
            db.get(Signup, target["id"]).role = "own"
            db.commit()
        return ranked

    monkeypatch.setattr(person_search, "rank_people", changed_during_search)
    result = api.get(f"/api/admin/events/{e['id']}/signups?search=Srinivasn&role=ride")
    assert result.status_code == 200, result.text
    assert result.json()["items"] == []
