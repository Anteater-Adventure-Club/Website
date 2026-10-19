from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from sqlalchemy import select

from app.domain import utcnow
from app.models import Audit, Membership
from conftest import cookie, event, person, quarter


def pause(api, q, start, end, **extra):
    return api.put(
        f"/api/admin/quarters/{q['id']}/membership-signups",
        json={
            "membership_pause_starts_at": start.isoformat() if start else None,
            "membership_pause_ends_at": end.isoformat() if end else None,
            "membership_pause_message": "Retreat priority registration is underway.",
            **extra,
        },
    )


def test_scheduled_pause_boundaries_and_no_membership_created(api, monkeypatch):
    q = quarter(api)
    members = [person(api, n) for n in range(1, 5)]
    start, end = utcnow() + timedelta(hours=1), utcnow() + timedelta(hours=2)
    assert pause(api, q, start, end).status_code == 200
    url = f"/api/me/memberships/{q['id']}"
    body = {"method": "cash"}
    monkeypatch.setattr("app.models.now", lambda: start - timedelta(microseconds=1))
    api.cookies.set("aac_session", cookie(members[0]["id"]))
    assert api.post(url, json=body).status_code == 200
    monkeypatch.setattr("app.models.now", lambda: start)
    api.cookies.set("aac_session", cookie(members[1]["id"]))
    blocked = api.post(url, json=body)
    assert blocked.status_code == 409
    assert blocked.json()["detail"]["code"] == "membership_signups_paused"
    assert blocked.json()["detail"]["reopens_at"] == end.isoformat()
    assert api.get("/api/quarters").json()["items"][0]["membership_signups_paused"]
    with api.app.state.sessions() as db:
        assert db.scalar(select(Membership).where(Membership.member_id == members[1]["id"])) is None
    monkeypatch.setattr("app.models.now", lambda: end - timedelta(microseconds=1))
    assert api.post(url, json=body).status_code == 409
    monkeypatch.setattr("app.models.now", lambda: end)
    assert api.post(url, json=body).status_code == 200
    assert not api.get("/api/quarters").json()["items"][0]["membership_signups_paused"]


def test_pending_approvals_remain_eligible_and_pause_is_quarter_scoped(api):
    q = quarter(api)
    pending = person(api)
    api.cookies.set("aac_session", cookie(pending["id"]))
    url = f"/api/me/memberships/{q['id']}"
    submitted = api.post(url, json={"method": "cash"}).json()
    api.cookies.set("aac_session", cookie(1))
    now = utcnow()
    assert pause(api, q, now - timedelta(hours=1), now + timedelta(hours=1)).status_code == 200
    e = event(api, q, kind="retreat")
    api.cookies.set("aac_session", cookie(pending["id"]))
    assert api.post(url, json={"method": "cash"}).json() == submitted
    assert api.put(f"/api/events/{e['id']}/signup", json={"role": "own"}).status_code == 403
    api.cookies.set("aac_session", cookie(1))
    assert (
        api.post(
            f"/api/admin/members/{pending['id']}/memberships/{q['id']}/decision",
            json={"category": "exception", "reason": "Dues confirmed"},
        ).status_code
        == 200
    )
    api.cookies.set("aac_session", cookie(pending["id"]))
    assert api.put(f"/api/events/{e['id']}/signup", json={"role": "own"}).status_code == 200
    assert api.post(url, json={"method": "cash"}).json()["status"] == "approved"
    api.cookies.set("aac_session", cookie(1))
    other = quarter(
        api, starts_on=str(now.date() + timedelta(days=100)), ends_on=str(now.date() + timedelta(days=190))
    )
    general = person(api, 2)
    api.cookies.set("aac_session", cookie(general["id"]))
    assert api.post(f"/api/me/memberships/{other['id']}", json={"method": "cash"}).status_code == 200
    api.cookies.set("aac_session", cookie(1))
    regular = event(api, q)
    api.cookies.set("aac_session", cookie(general["id"]))
    assert api.put(f"/api/events/{regular['id']}/signup", json={"role": "own"}).status_code == 200


def test_pause_validation_revision_clear_and_budget_independence(api):
    q = quarter(api)
    now = utcnow()
    assert pause(api, q, now, None).status_code == 422
    assert pause(api, q, now, now).status_code == 422
    scheduled = pause(
        api, q, now, now + timedelta(hours=1), expected_revision=q["revision"], membership_pause_message=" "
    ).json()
    assert "temporarily paused" in scheduled["membership_pause_message"]
    assert pause(api, q, None, None, expected_revision=q["revision"]).status_code == 409
    fields = {k: scheduled[k] for k in ("name", "starts_on", "ends_on", "budget", "driver_cap", "mpg")}
    updated = api.put(f"/api/admin/quarters/{q['id']}", json={**fields, "budget": "123.00"}).json()
    assert updated["membership_signups_paused"]
    m = person(api)
    api.cookies.set("aac_session", cookie(m["id"]))
    assert pause(api, q, None, None).status_code == 403
    api.cookies.set("aac_session", cookie(1))
    assert not pause(api, q, None, None, expected_revision=updated["revision"]).json()[
        "membership_signups_paused"
    ]
    with api.app.state.sessions() as db:
        assert len(list(db.scalars(select(Audit).where(Audit.action == "membership.signup_settings")))) == 2


def test_concurrent_pause_changes_respect_revision(api):
    q = quarter(api)
    now = utcnow()
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(
                lambda _: pause(api, q, now, now + timedelta(hours=1), expected_revision=q["revision"]),
                range(2),
            )
        )
    assert sorted(r.status_code for r in results) == [200, 409]
