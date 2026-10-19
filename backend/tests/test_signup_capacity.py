from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import select

from app.models import Audit, Member, Signup
from app.schemas import EventWrite
from conftest import cookie, event, person, quarter, signup


def edit_caps(api, e, **caps):
    current = api.get(f"/api/admin/events/{e['id']}").json()
    body = {k: v for k, v in current.items() if k in EventWrite.model_fields}
    response = api.put(
        f"/api/admin/events/{e['id']}", json={**body, **caps, "expected_revision": current["revision"]}
    )
    assert response.status_code == 200, response.text
    return response.json()


def add(api, e, member, role="ride", **kwargs):
    return api.post(
        f"/api/admin/events/{e['id']}/signups", json={"member_id": member["id"], "role": role, **kwargs}
    )


def test_independent_transport_caps_total_and_released_spots(api):
    q = quarter(api)
    e = event(api, q, signup_cap_total=3, signup_cap_ride=1, signup_cap_driver=1)
    people = [person(api, n) for n in range(1, 6)]
    signup(api, e, people[0], "driver")
    assert add(api, e, people[1], "driver").status_code == 409
    signup(api, e, people[1])
    assert add(api, e, people[2]).status_code == 409
    own = signup(api, e, people[2], "own")
    assert add(api, e, people[3], "own").status_code == 409
    totals = api.get(f"/api/events/{e['id']}").json()
    assert totals["signup_count"] == 3
    assert totals["signup_counts_by_role"] == {"driver": 1, "ride": 1, "own": 1}
    assert totals["offered_seats"] == 3  # A driver's offered seats are not signup places.
    assert api.delete(f"/api/admin/signups/{own['id']}").status_code == 200
    signup(api, e, people[3], "own")
    assert add(api, e, people[2], "own").status_code == 409  # Restoration needs a place.
    other = event(api, q, signup_cap_ride=0)
    assert add(api, other, people[4]).status_code == 409
    signup(api, other, people[4], "own")  # Blank limits remain unlimited.


def test_lower_caps_keep_places_and_allow_nonincreasing_changes(api):
    q = quarter(api)
    e = event(api, q)
    a, b, c = [person(api, n) for n in range(1, 4)]
    signup(api, e, a)
    signup(api, e, b)
    e = edit_caps(api, e, signup_cap_total=1, signup_cap_ride=0, signup_cap_own=1)
    assert e["signup_count"] == 2
    assert add(api, e, a, notes="Updated while over capacity").status_code == 200
    assert add(api, e, a, "own").status_code == 200  # Does not increase total occupancy.
    assert add(api, e, b, "own").status_code == 409
    assert add(api, e, c, "own").status_code == 409
    api.cookies.set("aac_session", cookie(b["id"]))
    assert (
        api.put(f"/api/events/{e['id']}/signup", json={"role": "ride", "notes": "Member edit"}).status_code
        == 200
    )
    assert api.delete(f"/api/events/{e['id']}/signup").status_code == 200


def test_capacity_overrides_require_officer_and_reason_and_are_audited(api):
    q = quarter(api)
    e = event(api, q, signup_cap_total=0, signup_cap_own=0)
    m = person(api)
    assert add(api, e, m, "own").status_code == 409
    assert add(api, e, m, "own", capacity_override_reason="  ").status_code == 422
    api.cookies.set("aac_session", cookie(m["id"]))
    assert api.put(f"/api/events/{e['id']}/signup", json={"role": "own"}).status_code == 409
    assert (
        api.put(
            f"/api/events/{e['id']}/signup", json={"role": "own", "capacity_override_reason": "Please"}
        ).status_code
        == 422
    )
    assert add(api, e, m, "own", capacity_override_reason="Please").status_code == 403
    api.cookies.set("aac_session", cookie(1))
    result = add(api, e, m, "own", capacity_override_reason="  Additional campsite confirmed  ")
    assert result.status_code == 200
    with api.app.state.sessions() as db:
        entry = db.scalar(select(Audit).where(Audit.action == "signup.capacity_override"))
        assert entry.actor_id == 1 and entry.entity == str(result.json()["id"])
        assert entry.data["reason"] == "Additional campsite confirmed"
        assert {v["category"] for v in entry.data["limits"]} == {"total", "own"}
    retreat = event(api, q, kind="retreat", signup_cap_total=0)
    assert add(api, retreat, m, "own", capacity_override_reason="Extra space").status_code == 403


def test_walkin_and_import_capacity_are_atomic_and_can_be_overridden(api):
    q = quarter(api)
    e = event(api, q, signup_cap_total=0)
    walkin = {
        "member": {"name": "Walk-in", "email": "walkin@example.com"},
        "signup": {"role": "own"},
        "request_id": "walkin",
    }
    url = f"/api/admin/events/{e['id']}/walk-ins"
    assert api.post(url, json=walkin).status_code == 409
    with api.app.state.sessions() as db:
        assert db.scalar(select(Member).where(Member.email == "walkin@example.com")) is None
    result = api.post(url, json={**walkin, "capacity_override_reason": "Extra campsite"})
    assert result.status_code == 200 and result.json()["checked_in_at"]
    assert (
        api.post(url, json={**walkin, "capacity_override_reason": "Extra campsite"}).json()["id"]
        == result.json()["id"]
    )
    e = edit_caps(api, e, signup_cap_total=2)
    preview = api.post(
        "/api/admin/imports/preview",
        json={
            "mode": "participants",
            "quarter_id": q["id"],
            "event_id": e["id"],
            "fallback_role": "own",
            "text": "Name,Email\nImport One,import1@example.com\nImport Two,import2@example.com",
        },
    ).json()
    apply_url = f"/api/admin/imports/{preview['id']}/apply"
    body = {"request_hash": preview["request_hash"]}
    assert api.post(apply_url, json=body).status_code == 409
    with api.app.state.sessions() as db:
        assert db.scalar(select(Member).where(Member.email == "import1@example.com")) is None
        assert len(list(db.scalars(select(Signup)))) == 1
    assert (
        api.post(
            apply_url, json={**body, "capacity_override_reason": "Approved extra camping space"}
        ).status_code
        == 200
    )
    assert api.get(f"/api/events/{e['id']}").json()["signup_count"] == 3


@pytest.mark.parametrize("limits", [{"signup_cap_total": 1}, {"signup_cap_own": 1}])
def test_last_place_concurrent_requests(api, limits):
    e = event(api, quarter(api), **limits)
    people = [person(api, n) for n in range(1, 9)]
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(
            pool.map(
                lambda m: api.put(
                    f"/api/events/{e['id']}/signup",
                    json={"role": "own"},
                    headers={"Cookie": f"aac_session={cookie(m['id'])}"},
                ),
                people,
            )
        )
    assert sorted(r.status_code for r in results) == [200] + [409] * 7
    assert api.get(f"/api/events/{e['id']}").json()["signup_count"] == 1


def test_caps_validate_and_copy_and_survive_unrelated_edits(api):
    q = quarter(api)
    e = event(api, q, signup_cap_total=10, signup_cap_ride=7, signup_cap_driver=2, signup_cap_own=1)
    fields = {k: v for k, v in e.items() if k in EventWrite.model_fields and not k.startswith("signup_cap_")}
    assert api.put(f"/api/admin/events/{e['id']}", json={**fields, "signup_cap_total": -1}).status_code == 422
    assert api.put(f"/api/admin/events/{e['id']}", json={**fields, "signup_cap_ride": 1.5}).status_code == 422
    assert api.put(f"/api/admin/events/{e['id']}", json=fields).json()["signup_cap_total"] == 10
    duplicate = api.post(
        f"/api/admin/events/{e['id']}/duplicate",
        json={k: e[k] for k in ("quarter_id", "starts_at", "ends_at")},
    )
    assert duplicate.status_code == 200
    assert [duplicate.json()[f"signup_cap_{role}"] for role in ("total", "ride", "driver", "own")] == [
        10,
        7,
        2,
        1,
    ]
    assert duplicate.json()["signup_count"] == 0


def test_recurring_events_have_independent_caps(api):
    from test_event_rules import series_input

    q = quarter(api)
    value = series_input(q)
    value["event"].update(signup_cap_total=1, signup_cap_ride=0)
    response = api.post("/api/admin/series", json=value)
    assert response.status_code == 201
    series = response.json()
    assert all(e["signup_cap_total"] == 1 and e["signup_cap_ride"] == 0 for e in series["occurrences"])
    del value["event"]["signup_cap_total"]
    del value["event"]["signup_cap_ride"]
    value["event"]["name"] = "Renamed series with limits preserved"
    edited = api.put(f"/api/admin/series/{series['id']}", json=value)
    assert edited.status_code == 200
    assert all(e["signup_cap_total"] == 1 and e["signup_cap_ride"] == 0 for e in edited.json()["occurrences"])
    assert api.post(f"/api/admin/series/{series['id']}/publish", json={}).status_code == 200
    m = person(api)
    for occurrence in series["occurrences"][:2]:
        signup(api, occurrence, m, "own")
        assert api.get(f"/api/events/{occurrence['id']}").json()["signup_count"] == 1
