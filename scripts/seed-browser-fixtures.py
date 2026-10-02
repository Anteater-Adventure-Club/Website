"""Synthetic browser fixtures. Refuses to run against any non-local/browser database."""

import base64
import json
import os
import sys
from datetime import timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
DATABASE = os.environ.get(
    "DATABASE_URL", "postgresql+psycopg://aac:aac@127.0.0.1:55432/aac_browser"
)
if "127.0.0.1:55432/aac_browser" not in DATABASE:
    raise SystemExit("Fixtures require the isolated local aac_browser database")
os.environ["DATABASE_URL"] = DATABASE
from app.config import Settings
from app.db import make_engine
from app.domain import PACIFIC, today, utcnow
from app.main import create_app
from app.models import Base
from fastapi.testclient import TestClient
from itsdangerous import TimestampSigner
from sqlalchemy import text

SECRET = "aac-isolated-browser-only-session-secret-123456789"
engine = make_engine(DATABASE)
with engine.begin() as conn:
    conn.execute(
        text(
            "TRUNCATE "
            + ",".join('"' + name + '"' for name in Base.metadata.tables)
            + " RESTART IDENTITY CASCADE"
        )
    )
settings = Settings(
    app_url="http://localhost:5173",
    database_url=DATABASE,
    session_secret=SECRET,
    initial_officers="officer@uci.edu",
    media_root=Path("/tmp/aac-browser-media"),
    venmo="@fixture-club",
    zelle="fixture@uci.edu",
)


def cookie(mid):
    data = base64.b64encode(
        json.dumps({"member_id": mid, "login_at": int(utcnow().timestamp())}).encode()
    )
    return TimestampSigner(SECRET).sign(data).decode()


with TestClient(
    create_app(settings, engine), headers={"Origin": settings.app_url}
) as api:
    api.cookies.set("aac_session", cookie(1))

    def call(url, body=None, method="POST", **kwargs):
        response = api.request(method, url, json=body, **kwargs)
        if response.status_code >= 400:
            raise RuntimeError(f"{url}: {response.status_code} {response.text}")
        return response.json()

    quarter = call(
        "/api/admin/quarters",
        {
            "name": "Fixture Fall",
            "starts_on": str(today() - timedelta(days=20)),
            "ends_on": str(today() + timedelta(days=70)),
            "budget": "80.00",
            "driver_cap": "50.00",
            "mpg": "25.00",
        },
    )
    past = call(
        "/api/admin/quarters",
        {
            "name": "Fixture Summer",
            "starts_on": str(today() - timedelta(days=110)),
            "ends_on": str(today() - timedelta(days=21)),
            "budget": "80.00",
            "driver_cap": "50.00",
            "mpg": "25.00",
        },
    )
    call(f"/api/admin/quarters/{past['id']}/finalize")
    call(f"/api/admin/quarters/{past['id']}/archive")
    people = {}
    for i, label in enumerate(
        [
            "Member",
            "Driver",
            "Pending",
            "Exception",
            "General Rider",
            "Paid Rider",
            "Own Ride",
            "Late Rider",
            "Officer Two",
        ]
    ):
        m = call(
            "/api/admin/members",
            {
                "name": f"Fixture {label}",
                "email": f"fixture{i}@uci.edu",
                "phone": "9495550100",
            },
        )
        people[label] = m
    call("/api/admin/officers", {"member_id": people["Officer Two"]["id"]})
    for label in ["Member", "Driver", "Paid Rider"]:
        call(
            f"/api/admin/members/{people[label]['id']}/memberships/{quarter['id']}/decision",
            {
                "category": "payment",
                "student": True,
                "amount": "25.00",
                "paid_on": str(today()),
                "method": "cash",
                "reference": "Fixture payment",
            },
        )
    call(
        f"/api/admin/members/{people['Exception']['id']}/memberships/{quarter['id']}/decision",
        {"category": "exception", "reason": "Fixture volunteer exception"},
    )
    api.cookies.set("aac_session", cookie(people["Pending"]["id"]))
    call(f"/api/me/memberships/{quarter['id']}", {"student": True, "method": "cash"})
    api.cookies.set("aac_session", cookie(1))
    car = call(
        f"/api/admin/members/{people['Driver']['id']}/vehicles",
        {
            "year": 2020,
            "make": "Toyota",
            "model": "Prius",
            "color": "Silver",
            "plate": "FIXTURE",
            "capacity": 4,
        },
    )
    now = utcnow()

    def event(label, start, state="published", **extras):
        body = {
            "quarter_id": quarter["id"],
            "name": f"Fixture {label}",
            "description": "A synthetic adventure for browser acceptance. Bring water, comfortable shoes, and your curiosity.",
            "destination": "UCI flagpoles",
            "starts_at": start.isoformat(),
            "ends_at": (start + timedelta(hours=6)).isoformat(),
            "departure_at": start.isoformat(),
            "miles": "100.00",
            "gas_price": "5.000",
            "packing": ["Water", "Comfortable shoes", "Lunch"],
            **extras,
        }
        e = call("/api/admin/events", body)
        if state != "draft":
            e = call(f"/api/admin/events/{e['id']}/state", {"state": "published"})
        if state in {"completed", "cancelled"}:
            e = call(
                f"/api/admin/events/{e['id']}/state",
                {"state": state, "reason": "Fixture weather cancellation"},
            )
        return e

    events = {}
    events["Field"] = event(
        "Coastal Trail",
        now + timedelta(hours=2),
        questions=[
            {
                "id": "food",
                "label": "Lunch preference",
                "kind": "choice",
                "required": False,
                "options": ["Packed lunch", "Buy lunch"],
            }
        ],
    )
    events["Adventure"] = event("Adventure Signup", now + timedelta(days=4))
    events["Multi-day"] = event(
        "Camping Retreat",
        now + timedelta(days=6),
        kind="retreat",
        ends_at=(now + timedelta(days=8)).isoformat(),
    )
    events["Not Open"] = event(
        "Future Signup",
        now + timedelta(days=10),
        opens_at=(now + timedelta(days=8)).isoformat(),
    )
    events["Closed"] = event(
        "Signup Closed",
        now + timedelta(days=3),
        closes_at=(now - timedelta(hours=1)).isoformat(),
    )
    events["Draft"] = event("Private Draft", now + timedelta(days=5), state="draft")
    events["Cancelled"] = event(
        "Cancelled Beach Day", now + timedelta(days=3), state="cancelled"
    )
    events["Completed"] = event(
        "Past Adventure", now - timedelta(days=3), state="completed"
    )
    events["Meeting"] = event(
        "Club Meeting", now + timedelta(days=2), kind="meeting", signups_enabled=False
    )
    seriesStart = (now + timedelta(days=7)).astimezone(PACIFIC)
    series = call(
        "/api/admin/series",
        {
            "event": {
                "quarter_id": quarter["id"],
                "name": "Fixture Weekly Picnic",
                "kind": "picnic",
                "signups_enabled": False,
                "starts_at": seriesStart.isoformat(),
                "ends_at": (seriesStart + timedelta(hours=2)).isoformat(),
            },
            "starts_on": str(seriesStart.date()),
            "until": str(seriesStart.date() + timedelta(days=21)),
            "kind": "alternating",
            "start_time": seriesStart.strftime("%H:%M"),
            "end_time": (seriesStart + timedelta(hours=2)).strftime("%H:%M"),
            "weekdays_a": [seriesStart.weekday()],
            "weekdays_b": [],
            "request_id": "fixture-series",
        },
    )
    call(
        f"/api/admin/series/{series['id']}/publish",
        {"expected_revision": series["revision"]},
    )
    signups = {}
    for label, role in [
        ("Member", "ride"),
        ("Driver", "driver"),
        ("Paid Rider", "ride"),
        ("General Rider", "ride"),
        ("Own Ride", "own"),
        ("Late Rider", "ride"),
    ]:
        body = {
            "member_id": people[label]["id"],
            "role": role,
            "answers": {"food": "Packed lunch"},
        }
        if role == "driver":
            body.update(vehicle_id=car["id"], seats=4)
        signups[label] = call(
            f"/api/admin/events/{events['Field']['id']}/signups", body
        )
    for label in ["Driver", "Paid Rider", "General Rider", "Own Ride"]:
        call(f"/api/admin/signups/{signups[label]['id']}/check-in")
    call(
        f"/api/admin/events/{events['Field']['id']}/carpools/{signups['Paid Rider']['id']}",
        {"driver_signup_id": signups["Driver"]["id"]},
        method="PUT",
    )
    imageResponse = api.post(
        "/api/admin/media",
        data={"purpose": "event", "focal_x": ".5", "focal_y": ".5"},
        files={
            "file": (
                "fixture.webp",
                (ROOT / "frontend/public/images/about_tide_pools.webp").read_bytes(),
                "image/webp",
            )
        },
    )
    assert imageResponse.status_code == 201, imageResponse.text
    image = imageResponse.json()["id"]
    recap = call(
        f"/api/admin/events/{events['Completed']['id']}/recap",
        {
            "image_id": image,
            "title": "Fixture Tide Pools",
            "caption": "A day by the coast",
            "text": "We explored the shoreline together. Synthetic acceptance content.",
            "homepage": True,
        },
        method="PUT",
    )
    call(
        f"/api/admin/events/{events['Completed']['id']}/recap/publication",
        {"expected_revision": recap["revision"]},
    )
    board = call(
        "/api/admin/board/terms",
        {"label": "Fixture Previous Board", "start_year": 2025},
    )
    call(
        f"/api/admin/board/terms/{board['id']}/entries",
        {
            "name": "Fixture Past Officer",
            "role": "Treasurer",
            "bio": "Past board fixture.",
        },
    )
    board = call(
        "/api/admin/board/terms", {"label": "Fixture Current Board", "start_year": 2026}
    )
    for i, name in enumerate(["Officer One", "Officer Two", "Member"]):
        call(
            f"/api/admin/board/terms/{board['id']}/entries",
            {
                "name": f"Fixture {name}",
                "role": ["President", "Treasurer", "Secretary"][i],
                "major": "Environmental science",
                "bio": "I love exploring new trails and meeting adventurous people.",
                "memory": "A sunset picnic by the coast.",
                "position": i,
                "palette": ["forest", "rose", "ocean"][i],
            },
        )
    finalized = call(
        "/api/admin/quarters",
        {
            "name": "Fixture Payments",
            "starts_on": str(today() - timedelta(days=200)),
            "ends_on": str(today() - timedelta(days=111)),
            "budget": "80.00",
            "driver_cap": "50.00",
            "mpg": "25.00",
        },
    )
    old_event = event(
        "Historic Trip",
        now - timedelta(days=140),
        state="completed",
        quarter_id=finalized["id"],
    )
    for label in ["Driver", "Member"]:
        call(
            f"/api/admin/members/{people[label]['id']}/memberships/{finalized['id']}/decision",
            {"category": "exception", "reason": "Fixture paid benefits"},
        )
        call(
            f"/api/admin/events/{old_event['id']}/trips",
            {"member_id": people[label]["id"]},
        )
    frozen = call(f"/api/admin/quarters/{finalized['id']}/finalize")
    call(
        f"/api/admin/payouts/{frozen['drivers'][0]['payout_id']}/payment",
        {"paid_on": str(today()), "reference": "Fixture completed payout"},
        method="PUT",
    )
    fixtures = {
        "quarter": quarter,
        "past": past,
        "finalized": finalized,
        "events": events,
        "people": people,
        "series": series,
        "signups": signups,
        "cookies": {
            "officer": cookie(1),
            **{label: cookie(m["id"]) for label, m in people.items()},
        },
        "created_at": now.isoformat(),
    }
    path = ROOT / "artifacts/browser-fixtures.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(fixtures, indent=2))
    print(
        "Created isolated synthetic browser fixtures:",
        len(events),
        "events;",
        len(people),
        "members",
    )
