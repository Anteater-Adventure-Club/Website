"""Seed a fresh disposable load-test database; never seed the working database."""
import base64
import json
import re
import sys
import time
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from sqlalchemy import func, select  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402
from itsdangerous import TimestampSigner  # noqa: E402
from app.config import Settings  # noqa: E402
from app.db import make_engine  # noqa: E402
from app.domain import today, utcnow  # noqa: E402
from app.models import Assignment, Card, DriverRegistration, Event, Member, Membership, Officer, Quarter, Signup, Trip, Vehicle  # noqa: E402

SECRET = "aac-isolated-load-only-session-secret-123456789"
settings = Settings()
database = make_url(settings.database_url).database
if not re.fullmatch(r"aac_load_acceptance_\d{14}", database or ""):
    raise SystemExit("Load fixtures require a freshly named disposable load database")
if settings.app_url != "http://127.0.0.1:18001" or settings.session_secret != SECRET:
    raise SystemExit("Load fixtures require the isolated load application configuration")
engine = make_engine(settings.database_url)


def cookie(member_id):
    body = base64.b64encode(json.dumps({"member_id": member_id, "login_at": int(time.time())}).encode())
    return TimestampSigner(SECRET).sign(body).decode()


with Session(engine) as db:
    first = db.scalar(select(Member))
    if db.scalar(select(func.count()).select_from(Member)) != 1 or first.email != "load0@uci.edu":
        raise SystemExit("Refusing to seed a populated or unrecognized database")
    people = [first]
    for index in range(1, 500):
        person = Member(name=f"Load Member {index}", email=f"load{index}@uci.edu", phone="9495550100")
        db.add(person)
        people.append(person)
    db.flush()
    for person in people[1:10]:
        db.add(Officer(member_id=person.id))
    current = Quarter(name="Load Active Quarter", starts_on=today() - timedelta(days=20), ends_on=today() + timedelta(days=70), budget=6000, driver_cap=100, mpg=25)
    past = Quarter(name="Load Archived Quarter", starts_on=today() - timedelta(days=120), ends_on=today() - timedelta(days=21), state="archived")
    db.add_all([current, past])
    db.flush()
    for person in people[::2]:
        db.add(Membership(member_id=person.id, quarter_id=current.id, status="approved", source="exception", reason="Synthetic load-test benefits"))
    now = utcnow()
    events = []
    for index in range(40):
        start = now + timedelta(hours=2, days=index)
        event = Event(quarter_id=current.id, name=f"Load Adventure {index}", state="published", starts_at=start, ends_at=start + timedelta(hours=5), departure_at=start, description="Synthetic performance acceptance event", destination="Synthetic trail", miles=100, gas_price=5)
        db.add(event)
        events.append(event)
    for index in range(10):
        start = now - timedelta(days=30 + index)
        db.add(Event(quarter_id=past.id, name=f"Load Past Adventure {index}", state="completed", starts_at=start, ends_at=start + timedelta(hours=5)))
    db.flush()
    drivers = []
    card_numbers = {"paid": 0, "general": 0}
    for index, person in enumerate(people[:200]):
        signup = Signup(event_id=events[0].id, member_id=person.id, role="driver" if index < 10 else "ride", checked_in_at=now if index < 50 else None)
        if index < 10:
            car = Vehicle(member_id=person.id, year=2020, make="Toyota", model="Prius", color="Silver", plate=f"LOAD{index:03}", capacity=4)
            db.add(car)
            db.flush()
            signup.vehicle_id = car.id
            signup.vehicle = {name: getattr(car, name) for name in ["year", "make", "model", "color", "plate", "capacity"]}
            signup.seats = 4
        db.add(signup)
        db.flush()
        if index < 10:
            drivers.append(signup)
            db.add(DriverRegistration(quarter_id=current.id, member_id=person.id))
            db.add(Trip(event_id=events[0].id, member_id=person.id, source="arrival", arrival_signup_id=signup.id))
        elif index < 50:
            category = "paid" if index % 2 == 0 else "general"
            card_numbers[category] += 1
            db.add(Card(event_id=events[0].id, category=category, number=card_numbers[category], signup_id=signup.id))
            db.add(Assignment(rider_id=signup.id, driver_id=drivers[(index - 10) // 4].id))
    db.commit()
    print(json.dumps({"members": [{"id": person.id, "cookie": cookie(person.id)} for person in people], "events": [event.id for event in events], "field_event": events[0].id, "quarter": current.id, "from": str(today() - timedelta(days=5)), "to": str(today() + timedelta(days=60)), "counts": {"members": 500, "active_events": 40, "historical_events": 10, "roster": 200, "officers": 10}}))
engine.dispose()
