import base64
import json
import os
from datetime import timedelta
import pytest
from fastapi.testclient import TestClient
from itsdangerous import TimestampSigner
from sqlalchemy import text
from app.config import Settings
from app.db import make_engine
from app.domain import today, utcnow
from app.main import create_app
from app.models import Base

SECRET = "aac-isolated-tests-only-session-secret-123456789"
DATABASE = os.getenv("TEST_DATABASE_URL", "postgresql+psycopg://aac:aac@127.0.0.1:55432/aac")


def cookie(mid):
    payload = base64.b64encode(json.dumps({"member_id": mid, "login_at": int(utcnow().timestamp())}).encode())
    return TimestampSigner(SECRET).sign(payload).decode()


@pytest.fixture(scope="session")
def engine():
    engine = make_engine(DATABASE)
    assert engine.dialect.name == "postgresql", "These integration tests require PostgreSQL"
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def api(engine, tmp_path):
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE "
                + ",".join('"' + name + '"' for name in Base.metadata.tables)
                + " RESTART IDENTITY CASCADE"
            )
        )
    app = create_app(
        Settings(
            app_url="http://testserver",
            session_secret=SECRET,
            initial_officers="officer@uci.edu",
            media_root=tmp_path,
        ),
        engine,
    )
    with TestClient(app, headers={"Origin": "http://testserver"}) as client:
        client.cookies.set("aac_session", cookie(1))
        client.app = app
        yield client


def quarter(api, **kwargs):
    data = {
        "name": "Test quarter",
        "starts_on": str(today() - timedelta(days=10)),
        "ends_on": str(today() + timedelta(days=90)),
        "budget": "100.00",
        "driver_cap": "0.00",
        "mpg": "25.00",
        **kwargs,
    }
    response = api.post("/api/admin/quarters", json=data)
    assert response.status_code == 201, response.text
    return response.json()


def event(api, q, **kwargs):
    start = utcnow() + timedelta(days=2)
    data = {
        "quarter_id": q["id"],
        "name": "Trail day",
        "starts_at": start.isoformat(),
        "ends_at": (start + timedelta(hours=5)).isoformat(),
        "departure_at": start.isoformat(),
        "miles": "100.00",
        "gas_price": "5.000",
        **kwargs,
    }
    response = api.post("/api/admin/events", json=data)
    assert response.status_code == 201, response.text
    e = response.json()
    if kwargs.get("publish", True):
        response = api.post(f"/api/admin/events/{e['id']}/state", json={"state": "published"})
        assert response.status_code == 200, response.text
        e = response.json()
    return e


def person(api, index=1):
    response = api.post(
        "/api/admin/members",
        json={"name": f"Person {index}", "email": f"person{index}@uci.edu", "phone": "9495550100"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def signup(api, e, m, role="ride", **extra):
    data = {"member_id": m["id"], "role": role, **extra}
    if role == "driver" and "vehicle_id" not in data:
        response = api.post(
            f"/api/admin/members/{m['id']}/vehicles",
            json={"year": 2020, "make": "Toyota", "model": "Prius", "capacity": 3},
        )
        assert response.status_code == 200, response.text
        data.update(vehicle_id=response.json()["id"], seats=3)
    response = api.post(f"/api/admin/events/{e['id']}/signups", json=data)
    assert response.status_code == 200, response.text
    return response.json()
