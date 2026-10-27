from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.domain import today, utcnow
from app.models import Assignment, Audit, Card, EventSheet, MemberBan, Membership, Signup, Trip
from conftest import cookie, event, person, quarter, signup


def ban(api, member, **fields):
    body = {"all_events": True, "reason": "Confidential officer reason", "message": "Please contact the club.",
            "request_id": uuid4().hex, **fields}
    return api.post(f"/api/admin/members/{member['id']}/bans", json=body)


def own(api, member):
    api.cookies.set("aac_session", cookie(member["id"]))


def officer(api):
    api.cookies.set("aac_session", cookie(1))


def test_private_notes_authentication_scope_and_lifting(api):
    q, m = quarter(api), person(api)
    e = event(api, q)
    result = ban(api, m)
    assert result.status_code == 201, result.text
    b = result.json()
    own(api, m)
    assert api.get("/api/session").json()["member"]["id"] == m["id"]
    assert api.get("/api/me/profile").status_code == 200
    assert api.get("/api/me/vehicles").status_code == 200
    restrictions = api.get("/api/me/restrictions")
    assert "Confidential" not in restrictions.text
    assert "reason" not in restrictions.text and "created_by" not in restrictions.text
    assert restrictions.json()["items"][0]["message"] == "Please contact the club."
    for method, url, body in [
        ("GET", f"/api/admin/members/{m['id']}/bans", None),
        ("POST", f"/api/admin/members/{m['id']}/bans/{b['id']}/lift", {"reason": "self"}),
        ("POST", f"/api/admin/members/{m['id']}/bans/preview", {"all_events": True}),
    ]:
        assert api.request(method, url, json=body).status_code == 403
    assert ban(api, m).status_code == 403
    denied = api.put(f"/api/events/{e['id']}/signup", json={"role": "own"})
    assert denied.status_code == 403
    assert denied.json()["detail"]["code"] == "event_signup_restricted"
    assert "ban" not in denied.json()["detail"]["message"].lower()
    # Event-only bans leave membership signup available.
    assert api.post(f"/api/me/memberships/{q['id']}", json={"method": "cash"}).status_code == 200
    officer(api)
    assert api.post(f"/api/admin/events/{e['id']}/signups", json={"member_id": m["id"], "role": "own", "capacity_override_reason": "extra"}).status_code == 403
    lift = f"/api/admin/members/{m['id']}/bans/{b['id']}/lift"
    assert api.post(lift, json={"reason": "Reviewed"}).json()["status"] == "lifted"
    assert api.post(lift, json={"reason": "Retry"}).status_code == 200
    own(api, m)
    assert api.get("/api/me/restrictions").json()["items"] == []
    assert api.put(f"/api/events/{e['id']}/signup", json={"role": "own"}).status_code == 200


def test_type_and_specific_event_scopes_cross_quarter_and_expiry(api, monkeypatch):
    q, m = quarter(api), person(api)
    e = event(api, q, kind="picnic")
    other = event(api, q, kind="regular")
    later = utcnow() + timedelta(days=105)
    next_quarter = quarter(api, starts_on=str(today() + timedelta(days=100)), ends_on=str(today() + timedelta(days=190)))
    retreat = event(api, next_quarter, kind="retreat", starts_at=later.isoformat(), ends_at=(later + timedelta(days=1)).isoformat(),
                    departure_at=later.isoformat(), general_signup_opens_at=(utcnow() - timedelta(hours=1)).isoformat())
    expiry = utcnow() + timedelta(days=1)
    b = ban(api, m, all_events=False, event_kinds=["retreat"], event_ids=[e["id"]], expires_at=expiry.isoformat()).json()
    own(api, m)
    for blocked in (e, retreat):
        assert api.put(f"/api/events/{blocked['id']}/signup", json={"role": "own"}).status_code == 403
    assert api.put(f"/api/events/{other['id']}/signup", json={"role": "own"}).status_code == 200
    monkeypatch.setattr("app.services.restrictions.utcnow", lambda: expiry)
    assert api.get("/api/me/restrictions").json()["items"] == []
    assert api.put(f"/api/events/{e['id']}/signup", json={"role": "own"}).status_code == 200
    officer(api)
    assert api.get(f"/api/admin/members/{m['id']}/bans").json()["items"][0]["status"] == "expired"
    assert api.get("/api/admin/members?ban_status=active").json()["total"] == 0
    assert b["expires_at"]


def test_overlapping_bans_and_filtered_pagination(api):
    q, m = quarter(api), person(api)
    other = person(api, 2)
    e = event(api, q)
    b1, b2 = ban(api, m).json(), ban(api, m, membership=True).json()
    ban(api, other, all_events=False, membership=True)
    result = api.get("/api/admin/members?ban_status=active&limit=1&offset=1").json()
    assert result["total"] == 2 and len(result["items"]) == 1
    assert api.get("/api/admin/members?ban_status=none").json()["total"] == 1
    found = api.get(f"/api/admin/members?ban_status=active&status=general&search={m['email']}&quarter_id={q['id']}").json()
    assert found["total"] == 1 and len(found["items"][0]["bans"]) == 2
    api.post(f"/api/admin/members/{m['id']}/bans/{b1['id']}/lift", json={"reason": "One lifted"})
    own(api, m)
    assert api.put(f"/api/events/{e['id']}/signup", json={"role": "own"}).status_code == 403
    assert api.get("/api/me/restrictions").json()["items"][0]["id"] == b2["id"]


def test_cancellation_window_and_retained_signup_edits(api, monkeypatch):
    now = utcnow()
    monkeypatch.setattr("app.routers.bans.utcnow", lambda: now)
    q, m = quarter(api), person(api)
    expiry = now + timedelta(days=4)
    during = event(api, q)
    at_end = event(api, q, starts_at=expiry.isoformat(), ends_at=(expiry + timedelta(hours=2)).isoformat())
    started = event(api, q, starts_at=(now - timedelta(hours=1)).isoformat(), ends_at=(now + timedelta(hours=1)).isoformat())
    unaffected = event(api, q, kind="picnic")
    registrations = {e["id"]: signup(api, e, m, "own") for e in (during, at_end, started, unaffected)}
    preview = api.post(f"/api/admin/members/{m['id']}/bans/preview", json={"event_kinds": ["regular"], "expires_at": expiry.isoformat()}).json()
    assert [i["event_id"] for i in preview["items"]] == [during["id"]]
    b = ban(api, m, all_events=False, event_kinds=["regular"], expires_at=expiry.isoformat()).json()
    with api.app.state.sessions() as db:
        for e in (during, at_end, started, unaffected):
            assert db.get(Signup, registrations[e["id"]]["id"]).cancelled == (e == during)
    own(api, m)
    assert api.put(f"/api/events/{at_end['id']}/signup", json={"role": "own", "notes": "Still attending"}).status_code == 200
    assert api.delete(f"/api/events/{at_end['id']}/signup").status_code == 200
    assert api.put(f"/api/events/{at_end['id']}/signup", json={"role": "own"}).status_code == 403
    officer(api)
    api.post(f"/api/admin/members/{m['id']}/bans/{b['id']}/lift", json={"reason": "Reviewed"})
    with api.app.state.sessions() as db:
        assert db.get(Signup, registrations[during["id"]]["id"]).cancelled


@pytest.mark.parametrize("role", ["driver", "ride"])
def test_early_checkin_cleanup_capacity_and_sheets(api, role):
    q, m, other = quarter(api), person(api), person(api, 2)
    e = event(api, q, signup_cap_total=2)
    s = signup(api, e, m, role)
    peer = signup(api, e, other, "ride" if role == "driver" else "driver")
    for row in (s, peer):
        assert api.post(f"/api/admin/signups/{row['id']}/check-in").status_code == 200
    rider, driver = (peer, s) if role == "driver" else (s, peer)
    assert api.put(f"/api/admin/events/{e['id']}/carpools/{rider['id']}", json={"driver_signup_id": driver["id"]}).status_code == 200
    with api.app.state.sessions.begin() as db:
        sheet = EventSheet(event_id=e["id"], title="Fixture sheet", columns=[])
        db.add(sheet)
        db.flush()
        sheet_id, requested = sheet.id, sheet.requested
    assert ban(api, m).status_code == 201
    with api.app.state.sessions() as db:
        row = db.get(Signup, s["id"])
        assert row.cancelled and row.checked_in_at is None
        assert not list(db.scalars(select(Assignment)))
        assert not list(db.scalars(select(Card).where(Card.signup_id == s["id"], Card.voided.is_(False))))
        assert not list(db.scalars(select(Trip).where(Trip.arrival_signup_id == s["id"])))
        assert db.get(EventSheet, sheet_id).requested > requested
        assert db.scalar(select(Audit).where(Audit.action == "signup.ban_cancel"))
    third = person(api, 3)
    signup(api, e, third, "own")  # cancellation releases the place


def test_return_to_general_clears_pending_and_preserves_paid_membership(api):
    q, m, paid = quarter(api), person(api), person(api, 2)
    own(api, m)
    assert api.post(f"/api/me/memberships/{q['id']}", json={"method": "cash"}).json()["status"] == "pending"
    officer(api)
    api.post(f"/api/admin/members/{paid['id']}/memberships/{q['id']}/decision", json={"category": "exception", "reason": "Approved"})
    b = ban(api, m, all_events=False, membership=True).json()
    ban(api, paid, all_events=False, membership=True)
    decision = f"/api/admin/members/{m['id']}/memberships/{q['id']}/decision"
    assert api.post(decision, json={"category": "exception", "reason": "Override"}).status_code == 403
    returned = api.post(decision, json={"category": "general", "reason": "Please contact officers about your payment."}).json()
    assert returned["status"] == "general" and returned["source"] is None
    assert api.get(f"/api/admin/members?quarter_id={q['id']}&status=pending").json()["total"] == 0
    own(api, paid)
    assert api.get(f"/api/me/memberships/{q['id']}").json()["status"] == "approved"
    own(api, m)
    assert api.post(f"/api/me/memberships/{q['id']}", json={"method": "cash"}).status_code == 403
    officer(api)
    api.post(f"/api/admin/members/{m['id']}/bans/{b['id']}/lift", json={"reason": "Resolved"})
    own(api, m)
    fresh = api.post(f"/api/me/memberships/{q['id']}", json={"method": "cash"}).json()
    assert fresh["status"] == "pending" and fresh["source"] is None
    with api.app.state.sessions() as db:
        assert any(a.data["category"] == "general" and a.data["reason"] for a in db.scalars(
            select(Audit).where(Audit.action == "membership.decision")
        ))


@pytest.mark.parametrize("mode", ["participants", "paid_members"])
def test_import_rechecks_bans_and_rolls_back_entire_batch(api, mode):
    q, m, other = quarter(api), person(api), person(api, 2)
    e = event(api, q)
    spec = {"mode": mode, "quarter_id": q["id"], "event_id": e["id"] if mode == "participants" else None,
            "fallback_role": "own", "text": f"Name,Email\n{other['name']},{other['email']}\n{m['name']},{m['email']}"}
    preview = api.post("/api/admin/imports/preview", json=spec).json()
    assert preview["can_apply"]
    ban(api, m, membership=True)
    current = api.post("/api/admin/imports/preview", json=spec).json()
    assert not current["can_apply"] and "Active ban" in current["issues"][0]["message"]
    applied = api.post(f"/api/admin/imports/{preview['id']}/apply", json={"request_hash": preview["request_hash"]})
    assert applied.status_code == 403
    with api.app.state.sessions() as db:
        assert not list(db.scalars(select(Signup)))
        assert not list(db.scalars(select(Membership).where(Membership.member_id == other["id"])))
    assert api.post(f"/api/admin/events/{e['id']}/walk-ins", json={"member_id": m["id"], "signup": {"role": "own"}, "request_id": "blocked-walk-in"}).status_code == 403


def test_validation_idempotency_and_rollback(api, monkeypatch):
    q, m = quarter(api), person(api)
    e = event(api, q)
    s = signup(api, e, m, "own")
    for fields in ({"all_events": False}, {"reason": "  "}, {"expires_at": utcnow().isoformat()},
                   {"all_events": False, "event_ids": [99999]}, {"event_kinds": ["retreat"]}):
        assert ban(api, m, **fields).status_code == 422
    from app.routers import bans
    original = bans.cancel_signup

    def broken(*args, **kwargs):
        original(*args, **kwargs)
        from app.domain import fail
        fail(409, "fixture_failure", "Rollback fixture")

    monkeypatch.setattr(bans, "cancel_signup", broken)
    assert ban(api, m).status_code == 409
    with api.app.state.sessions() as db:
        assert not db.get(Signup, s["id"]).cancelled
        assert not list(db.scalars(select(MemberBan)))
    monkeypatch.setattr(bans, "cancel_signup", original)
    request_id = uuid4().hex
    first, second = ban(api, m, request_id=request_id), ban(api, m, request_id=request_id)
    assert first.json()["id"] == second.json()["id"]
    with api.app.state.sessions() as db:
        assert len(list(db.scalars(select(MemberBan)))) == 1


@pytest.mark.parametrize("operation", ["signup", "membership"])
def test_concurrent_ban_and_new_participation(api, operation):
    q, m = quarter(api), person(api)
    e = event(api, q)
    def submit():
        return api.request("PUT" if operation == "signup" else "POST",
                           f"/api/events/{e['id']}/signup" if operation == "signup" else f"/api/me/memberships/{q['id']}",
                           json={"role": "own"} if operation == "signup" else {"method": "cash"},
                           headers={"Cookie": f"aac_session={cookie(m['id'])}"})
    with ThreadPoolExecutor(max_workers=2) as pool:
        submitted = pool.submit(submit)
        created = pool.submit(ban, api, m, membership=True)
        assert created.result(timeout=10).status_code == 201
        assert submitted.result(timeout=10).status_code in {200, 403}
    with api.app.state.sessions() as db:
        if operation == "signup":
            assert not list(db.scalars(select(Signup).where(Signup.member_id == m["id"], Signup.cancelled.is_(False))))
        else:
            membership = db.scalar(select(Membership).where(Membership.member_id == m["id"]))
            assert membership is None or membership.status == "pending"
    officer(api)
    assert api.post(f"/api/admin/members/{m['id']}/memberships/{q['id']}/decision", json={"category": "exception", "reason": "Cannot approve"}).status_code == 403
