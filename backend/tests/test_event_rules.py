import asyncio
from concurrent.futures import ThreadPoolExecutor
import httpx
from sqlalchemy import text
from datetime import datetime, time, timedelta
from app.domain import PACIFIC, today
from conftest import cookie, event, person, quarter, signup


def test_write_is_committed_before_response_headers(api):
    """A separate connection must see a new member when HTTP headers are sent."""
    committed_at_headers = []

    async def boundary(scope, receive, send):
        async def observe(message):
            if message["type"] == "http.response.start":
                with api.app.state.sessions() as db:
                    committed_at_headers.append(
                        db.execute(text("SELECT count(*) FROM members WHERE email='response-boundary@uci.edu'"))
                        .scalar_one()
                    )
            await send(message)

        await api.app(scope, receive, observe)

    async def request():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=boundary), base_url="http://testserver") as client:
            return await client.post(
                "/api/admin/members",
                headers={"Origin": "http://testserver", "Cookie": f"aac_session={cookie(1)}"},
                json={"name": "Response boundary", "email": "response-boundary@uci.edu"},
            )

    response = asyncio.run(request())
    assert response.status_code == 201
    assert committed_at_headers == [1]


def test_multi_day_and_multiple_same_day_calendar(api):
    q = quarter(api)
    first = event(api, q, name="First adventure")
    second = event(api, q, name="Second adventure", starts_at=first["starts_at"], ends_at=first["ends_at"])
    start = datetime.fromisoformat(first["starts_at"])
    overnight = event(
        api,
        q,
        name="Overnight",
        starts_at=start.isoformat(),
        ends_at=(start + timedelta(days=2)).isoformat(),
        signups_enabled=False,
    )
    day = start.astimezone(PACIFIC).date()
    response = api.get(f"/api/events?from={day}&to={day}")
    assert {e["id"] for e in response.json()["items"]} == {first["id"], second["id"], overnight["id"]}
    response = api.get(f"/api/events?from={day + timedelta(days=1)}&to={day + timedelta(days=1)}")
    assert [e["id"] for e in response.json()["items"]] == [overnight["id"]]
    assert api.get(f"/api/events?from={day}&to={day + timedelta(days=371)}").status_code == 422


def test_question_freeze_and_completion_attendance_independent_finance(api):
    q = quarter(api)
    question = {
        "id": "experience",
        "label": "Experience?",
        "kind": "choice",
        "required": True,
        "options": ["First time", "Experienced"],
    }
    e = event(api, q, questions=[question])
    m = person(api)
    s = signup(api, e, m, answers={"experience": "First time"})
    write = {
        k: e[k]
        for k in (
            "quarter_id",
            "name",
            "kind",
            "destination",
            "description",
            "starts_at",
            "ends_at",
            "signups_enabled",
            "opens_at",
            "closes_at",
            "arrival_at",
            "departure_at",
            "return_at",
            "packing",
            "questions",
            "photo_id",
            "miles",
            "gas_price",
            "rate_override",
        )
    }
    assert api.put(f"/api/admin/events/{e['id']}", json={**write, "questions": []}).status_code == 409
    optional = {"id": "extra", "label": "Anything else?", "kind": "text", "required": False}
    assert (
        api.put(f"/api/admin/events/{e['id']}", json={**write, "questions": [question, optional]}).status_code
        == 200
    )
    assert (
        api.put(f"/api/admin/events/{e['id']}", json={**write, "signups_enabled": False}).status_code == 409
    )
    api.post(f"/api/admin/signups/{s['id']}/check-in")
    assert (
        api.post(
            f"/api/admin/events/{e['id']}/state", json={"state": "cancelled", "reason": "Weather"}
        ).status_code
        == 409
    )
    completed = api.post(f"/api/admin/events/{e['id']}/state", json={"state": "completed"}).json()
    assert completed["completion"]["arrived"] == 1
    assert api.delete(f"/api/admin/signups/{s['id']}/check-in").status_code == 409
    assert (
        api.put(
            f"/api/admin/events/{e['id']}/mileage", json={"miles": "90.00", "gas_price": "5.000"}
        ).status_code
        == 200
    )
    assert api.get(f"/api/admin/events/{e['id']}").json()["completion"] == completed["completion"]


def series_input(q):
    day = today() + timedelta(days=3)
    start = datetime.combine(day, time(18), PACIFIC)
    return {
        "event": {
            "quarter_id": q["id"],
            "name": "Weekly hangout",
            "starts_at": start.isoformat(),
            "ends_at": (start + timedelta(hours=1)).isoformat(),
        },
        "kind": "alternating",
        "starts_on": str(day),
        "until": str(day + timedelta(days=28)),
        "start_time": "18:00",
        "end_time": "19:00",
        "weekdays_a": [day.weekday()],
        "weekdays_b": [],
        "request_id": "weekly1",
    }


def test_series_preview_save_protected_participants_skip_and_individual_edit(api):
    q = quarter(api)
    data = series_input(q)
    preview = api.post("/api/admin/series/preview", json=data)
    assert preview.status_code == 200 and len(preview.json()["items"]) == 3
    response = api.post("/api/admin/series", json=data)
    assert response.status_code == 201, response.text
    series = response.json()
    assert len(series["occurrences"]) == 3
    assert api.post("/api/admin/series", json=data).json()["id"] == series["id"]
    first = series["occurrences"][0]
    api.post(f"/api/admin/events/{first['id']}/state", json={"state": "published"})
    signup(api, first, person(api))
    assert api.post(f"/api/admin/events/{first['id']}/skip", json={}).status_code == 409
    update = {**data, "event": {**data["event"], "name": "New hangout"}}
    assert api.put(f"/api/admin/series/{series['id']}", json=update).status_code == 409
    write = {
        **data["event"],
        "starts_at": first["starts_at"],
        "ends_at": first["ends_at"],
        "name": "One-date exception",
    }
    assert api.put(f"/api/admin/events/{first['id']}", json=write).status_code == 200
    response = api.put(f"/api/admin/series/{series['id']}", json=update)
    assert response.status_code == 200, response.text
    assert response.json()["occurrences"][0]["name"] == "One-date exception"
    second = response.json()["occurrences"][1]
    assert second["name"] == "New hangout"
    assert api.post(f"/api/admin/events/{second['id']}/skip", json={}).status_code == 200
    assert api.get(f"/api/events/{second['id']}").status_code == 404


def test_last_officer_concurrent_revocations(api):
    m = person(api)
    api.post("/api/admin/officers", json={"member_id": m["id"]})
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(
                lambda mid: api.delete(
                    f"/api/admin/officers/{mid}", headers={"Cookie": f"aac_session={cookie(mid)}"}
                ),
                [1, m["id"]],
            )
        )
    assert sorted(r.status_code for r in results) == [200, 409]


def test_cards_never_reuse_after_undo_or_void(api):
    q = quarter(api)
    e = event(api, q)
    s = signup(api, e, person(api))
    api.post(f"/api/admin/events/{e['id']}/cards/void", json={"category": "general", "number": 1})
    first = api.post(f"/api/admin/signups/{s['id']}/check-in").json()
    assert first["card"]["number"] == 2
    api.delete(f"/api/admin/signups/{s['id']}/check-in")
    second = api.post(f"/api/admin/signups/{s['id']}/check-in").json()
    assert second["card"]["number"] == 3
    assert (
        api.put(
            f"/api/admin/events/{e['id']}/cards", json={"general_cards": 2, "paid_cards": 100}
        ).status_code
        == 409
    )


def test_paid_general_inventory_and_driver_own_receipts(api):
    q = quarter(api)
    e = event(api, q)
    general = person(api, 1)
    paid = person(api, 2)
    api.post(
        f"/api/admin/members/{paid['id']}/memberships/{q['id']}/decision",
        json={"category": "exception", "reason": "Scholarship"},
    )
    rows = [
        signup(api, e, general),
        signup(api, e, paid),
        signup(api, e, person(api, 3), "driver"),
        signup(api, e, person(api, 4), "own"),
    ]
    receipts = [api.post(f"/api/admin/signups/{s['id']}/check-in").json() for s in rows]
    assert receipts[0]["card"] == {"category": "general", "number": 1}
    assert receipts[1]["card"] == {"category": "paid", "number": 1}
    assert receipts[2]["card"] is None and receipts[3]["card"] is None
    state = api.get(f"/api/admin/events/{e['id']}/check-in").json()
    assert state["next_cards"] == {"paid": 2, "general": 2}
