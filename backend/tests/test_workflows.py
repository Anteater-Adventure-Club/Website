import io
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from PIL import Image
from sqlalchemy import func, select
from app.domain import today
from app.models import Card, Member, Officer, Payout, Trip
from conftest import cookie, event, person, quarter, signup


def test_auth_roles_origin_and_no_test_endpoint(api):
    assert api.get("/api/session").json()["officer"] is True
    m = person(api)
    api.cookies.set("aac_session", cookie(m["id"]))
    assert api.get("/api/admin/officers").status_code == 403
    assert (
        api.put(
            "/api/me/profile", json={"name": "A", "phone": "123"}, headers={"Origin": "https://evil.org"}
        ).status_code
        == 403
    )
    api.cookies.clear()
    assert api.get("/api/me/profile").status_code == 401
    assert api.post("/api/auth/test", json={}).status_code == 404


def test_last_officer_and_bootstrap_once(api):
    assert api.delete("/api/admin/officers/1").status_code == 409
    m = person(api)
    assert api.post("/api/admin/officers", json={"member_id": m["id"]}).status_code == 200
    assert api.delete("/api/admin/officers/1").status_code == 200
    assert api.get("/api/admin/officers").status_code == 403
    from app.auth import bootstrap

    with api.app.state.sessions() as db:
        bootstrap(db, api.app.state.settings)
        assert db.get(Officer, 1) is None


def test_draft_privacy_disabled_operations_and_quarter_overlap(api):
    q = quarter(api)
    assert (
        api.post(
            "/api/admin/quarters",
            json={"name": "Overlap", "starts_on": q["starts_on"], "ends_on": q["ends_on"]},
        ).status_code
        == 409
    )
    e = event(api, q, signups_enabled=False, kind="meeting")
    assert api.post(f"/api/admin/events/{e['id']}/trips", json={"member_id": 1}).status_code == 409
    assert api.get(f"/api/admin/events/{e['id']}/check-in").status_code == 409
    assert api.put(f"/api/events/{e['id']}/signup", json={"role": "own"}).status_code == 409
    api.post(f"/api/admin/events/{e['id']}/state", json={"state": "draft"})
    assert api.get(f"/api/events/{e['id']}").status_code == 404


def test_guarantee_requires_enough_seats_and_public_has_no_pii(api):
    q = quarter(api)
    e = event(api, q)
    m = person(api)
    api.post(
        f"/api/admin/members/{m['id']}/memberships/{q['id']}/decision",
        json={"category": "exception", "reason": "Officer scholarship"},
    )
    signup(api, e, m)
    data = api.get(f"/api/events/{e['id']}").json()
    assert data["paid_riders"] == 1 and data["paid_ride_guaranteed"] is False
    assert all(k not in data for k in ("signups", "completion", "email", "phone", "answers"))
    driver = person(api, 2)
    signup(api, e, driver, "driver")
    assert api.get(f"/api/events/{e['id']}").json()["paid_ride_guaranteed"] is True


def test_dues_pending_receipt_corrections_and_collection(api):
    q = quarter(api)
    m = person(api)
    api.cookies.set("aac_session", cookie(m["id"]))
    pending = api.post(f"/api/me/memberships/{q['id']}", json={"student": True, "method": "venmo"}).json()
    assert pending["status"] == "pending"
    api.cookies.set("aac_session", cookie(1))
    url = f"/api/admin/members/{m['id']}/memberships/{q['id']}/decision"
    payment = {
        "category": "payment",
        "amount": "25.00",
        "paid_on": str(today()),
        "method": "venmo",
        "reference": "receipt1",
    }
    first = api.post(url, json=payment)
    assert first.status_code == 200, first.text
    assert len(api.post(url, json=payment).json()["receipts"]) == 1
    assert api.post(url, json={**payment, "amount": "30.00"}).status_code == 422
    fixed = api.post(url, json={**payment, "amount": "30.00", "reason": "Corrected category"}).json()
    assert len(fixed["receipts"]) == 2 and sum(not r["voided"] for r in fixed["receipts"]) == 1
    overview = api.get(f"/api/admin/overview?quarter_id={q['id']}").json()
    assert overview["statistics"]["dues_collected"] == "30.00"


def test_retreat_gate_and_vehicle_snapshot(api):
    q = quarter(api)
    e = event(api, q, kind="retreat")
    m = person(api)
    api.cookies.set("aac_session", cookie(m["id"]))
    assert api.put(f"/api/events/{e['id']}/signup", json={"role": "own"}).status_code == 403
    api.cookies.set("aac_session", cookie(1))
    api.post(
        f"/api/admin/members/{m['id']}/memberships/{q['id']}/decision",
        json={"category": "exception", "reason": "Scholarship"},
    )
    signup(api, e, m, "driver")
    api.cookies.set("aac_session", cookie(m["id"]))
    v = api.get("/api/me/vehicles").json()["items"][0]
    api.put(
        f"/api/me/vehicles/{v['id']}", json={"year": 2022, "make": "Honda", "model": "Civic", "capacity": 2}
    )
    own = api.get("/api/me/signups").json()["items"][0]
    assert own["vehicle"]["make"] == "Toyota" and "email" not in own


def test_checkin_concurrency_cards_and_idempotent_driver(api):
    q = quarter(api)
    e = event(api, q)
    riders = [signup(api, e, person(api, i)) for i in range(1, 17)]
    driver = signup(api, e, person(api, 17), "driver")
    with ThreadPoolExecutor(max_workers=16) as pool:
        responses = list(pool.map(lambda s: api.post(f"/api/admin/signups/{s['id']}/check-in"), riders))
    assert all(r.status_code == 200 for r in responses), [r.text for r in responses if r.status_code != 200]
    numbers = [r.json()["card"]["number"] for r in responses]
    assert len(set(numbers)) == 16
    with ThreadPoolExecutor(max_workers=8) as pool:
        responses = list(
            pool.map(lambda _: api.post(f"/api/admin/signups/{driver['id']}/check-in"), range(8))
        )
    assert all(r.status_code == 200 for r in responses)
    assert all(r.json()["card"] is None for r in responses)
    assert len({r.json()["checked_in_at"] for r in responses}) == 1
    with api.app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(Trip)) == 1
        assert db.scalar(select(func.count()).select_from(Card)) == 16


def test_fill_preserves_assignments_capacity_and_undo_keeps_edited_trip(api):
    q = quarter(api)
    e = event(api, q)
    drivers = [signup(api, e, person(api, i), "driver") for i in (1, 2)]
    riders = [signup(api, e, person(api, i)) for i in range(3, 11)]
    for s in drivers + riders:
        assert api.post(f"/api/admin/signups/{s['id']}/check-in").status_code == 200
    response = api.put(
        f"/api/admin/events/{e['id']}/carpools/{riders[-1]['id']}",
        json={"driver_signup_id": drivers[1]["id"]},
    )
    assert response.status_code == 200
    response = api.post(f"/api/admin/events/{e['id']}/carpools/fill", json={})
    assert response.json()["filled"] == 5
    state = api.get(f"/api/admin/events/{e['id']}/check-in").json()
    assert (
        next(s for s in state["signups"] if s["id"] == riders[-1]["id"])["driver_signup_id"]
        == drivers[1]["id"]
    )
    trip = api.get(f"/api/admin/events/{e['id']}/trips").json()["items"][0]
    api.put(f"/api/admin/trips/{trip['id']}", json={"cost_override": "0.00", "notes": "No cost"})
    api.delete(f"/api/admin/signups/{drivers[0]['id']}/check-in")
    assert len(api.get(f"/api/admin/events/{e['id']}/trips").json()["items"]) == 2
    stale = api.put(
        f"/api/admin/events/{e['id']}/carpools/{riders[0]['id']}",
        json={"driver_signup_id": drivers[1]["id"], "expected_revision": 1},
    )
    assert stale.status_code == 409


def test_walkin_rolls_back_when_cards_exhausted_and_repeats_safe(api):
    q = quarter(api)
    e = event(api, q)
    api.put(f"/api/admin/events/{e['id']}/cards", json={"general_cards": 0, "paid_cards": 10})
    data = {
        "member": {"name": "Walk in", "email": "walk@uci.edu"},
        "signup": {"role": "ride"},
        "request_id": "walk1",
    }
    assert api.post(f"/api/admin/events/{e['id']}/walk-ins", json=data).status_code == 409
    with api.app.state.sessions() as db:
        assert db.scalar(select(Member.id).where(Member.email == "walk@uci.edu")) is None
    api.put(f"/api/admin/events/{e['id']}/cards", json={"general_cards": 10, "paid_cards": 10})
    first = api.post(f"/api/admin/events/{e['id']}/walk-ins", json=data)
    second = api.post(f"/api/admin/events/{e['id']}/walk-ins", json=data)
    assert first.status_code == second.status_code == 200
    assert first.json()["id"] == second.json()["id"] and first.json()["card"] == second.json()["card"]


def test_finance_override_zero_finalize_payment_archive(api):
    q = quarter(api, budget="10.00")
    e = event(api, q)
    m = person(api)
    api.post(f"/api/admin/events/{e['id']}/trips", json={"member_id": m["id"]})
    url = f"/api/admin/quarters/{q['id']}/reimbursements"
    assert api.get(url).json()["drivers"][0]["allocated"] == "0.00"
    api.put(
        f"/api/admin/quarters/{q['id']}/drivers/{m['id']}/eligibility",
        json={"eligible_override": True, "reason": "Approved driving"},
    )
    assert (
        api.get(f"/api/admin/members/{m['id']}?quarter_id={q['id']}").json()["membership"] is None
        or api.get(f"/api/admin/members/{m['id']}?quarter_id={q['id']}").json()["membership"]["status"]
        == "general"
    )
    assert api.get(url).json()["drivers"][0]["allocated"] == "10.00"
    finalized = api.post(f"/api/admin/quarters/{q['id']}/finalize").json()
    api.post(f"/api/admin/quarters/{q['id']}/finalize")
    assert (
        api.put(f"/api/admin/events/{e['id']}/mileage", json={"miles": "200", "gas_price": "5"}).status_code
        == 409
    )
    assert api.post(f"/api/admin/quarters/{q['id']}/archive").status_code == 409
    p = finalized["drivers"][0]["payout_id"]
    assert (
        api.put(
            f"/api/admin/payouts/{p}/payment",
            json={"paid_on": str(today() + timedelta(days=1)), "reference": "x"},
        ).status_code
        == 422
    )
    payment = {"paid_on": str(today()), "reference": "zelle receipt"}
    assert api.put(f"/api/admin/payouts/{p}/payment", json=payment).status_code == 200
    assert api.put(f"/api/admin/payouts/{p}/payment", json=payment).status_code == 200
    assert api.post(f"/api/admin/quarters/{q['id']}/archive").status_code == 200
    with api.app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(Payout)) == 1


def test_import_atomic_idempotent_and_unknown_vehicle_year(api):
    q = quarter(api)
    e = event(api, q)
    data = {
        "mode": "participants",
        "quarter_id": q["id"],
        "event_id": e["id"],
        "text": "Name,UCI Email,Phone Number,Ride situation?,For drivers: how many passengers are you willing to take?\nDriver,driver@uci.edu,123,driver,3\nRider,rider@uci.edu,456,ride,",
    }
    p = api.post("/api/admin/imports/preview", json=data)
    assert p.status_code == 200, p.text
    preview = p.json()
    assert preview["can_apply"]
    url = f"/api/admin/imports/{preview['id']}/apply"
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(lambda _: api.post(url, json={"request_hash": preview["request_hash"]}), range(2))
        )
    assert all(r.status_code == 200 for r in results), [r.text for r in results]
    assert results[0].json() == results[1].json()
    roster = api.get(f"/api/admin/events/{e['id']}/signups").json()
    assert roster["total"] == 2 and roster["items"][0]["vehicle"]["year"] is None
    bad = api.post("/api/admin/imports/preview", json={**data, "text": "Name,Email\nBroken,invalid"}).json()
    assert not bad["can_apply"]
    assert (
        api.post(
            f"/api/admin/imports/{bad['id']}/apply", json={"request_hash": bad["request_hash"]}
        ).status_code
        == 422
    )


def test_media_and_recap_publication_separate_from_draft(api):
    q = quarter(api)
    e = event(api, q, signups_enabled=False)
    api.post(f"/api/admin/events/{e['id']}/state", json={"state": "completed"})
    output = io.BytesIO()
    Image.new("RGB", (900, 600), "green").save(output, "JPEG")
    upload = api.post(
        "/api/admin/media",
        files={"file": ("photo.jpg", output.getvalue(), "image/jpeg")},
        data={"purpose": "event"},
    )
    assert upload.status_code == 201, upload.text
    mid = upload.json()["id"]
    assert api.get(f"/media/{mid}/medium").status_code == 404
    url = f"/api/admin/events/{e['id']}/recap"
    assert (
        api.put(
            url,
            json={
                "image_id": mid,
                "title": "Trail",
                "caption": "Club day",
                "text": "A lovely adventure",
                "homepage": True,
            },
        ).status_code
        == 200
    )
    assert api.post(url + "/publication", json={}).status_code == 200
    assert api.get(f"/media/{mid}/medium").status_code == 200
    api.put(url, json={"image_id": mid, "title": "Edited draft", "caption": "Club day", "text": "Changed"})
    assert api.get(f"/api/gallery/{e['id']}").json()["title"] == "Trail"
    assert "completion" not in api.get(f"/api/events/{e['id']}").json()
    api.post(f"/api/admin/quarters/{q['id']}/finalize")
    assert api.post(url + "/publication", json={}).status_code == 200
    assert api.delete(f"/api/admin/media/{mid}").status_code == 409


def test_board_public_privacy_terms_and_independent_access(api):
    m = person(api)
    term = api.post("/api/admin/board/terms", json={"label": "2026–2027", "start_year": 2026}).json()
    entry = api.post(
        f"/api/admin/board/terms/{term['id']}/entries",
        json={"member_id": m["id"], "name": m["name"], "role": "Secretary", "site_access": True},
    ).json()
    public = api.get("/api/board").json()["entries"][0]
    assert "site_access" not in public and "member_id" not in public and "email" not in public
    api.post("/api/admin/board/terms", json={"label": "2027–2028", "start_year": 2027})
    assert api.get("/api/board").json()["entries"] == []
    api.delete(f"/api/admin/board/entries/{entry['id']}")
    assert any(o["member_id"] == m["id"] for o in api.get("/api/admin/officers").json()["items"])
