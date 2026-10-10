from datetime import timedelta
from sqlalchemy import delete, func, select
from ..domain import audit, fail, paid, require, revision, utcnow
from ..models import Assignment, AttendanceAction, Card, DriverRegistration, Signup, Trip, Vehicle
from ..projections import signup_window


def save_signup(db, event, member, value, officer=False, source="member"):
    if not officer and signup_window(event) != "open":
        fail(409, "signup_closed", "Signups are not currently open.")
    if event.kind == "retreat" and not paid(db, member.id, event.quarter_id):
        fail(403, "paid_membership_required", "Approved paid membership is required for retreats.")
    s = db.scalar(select(Signup).where(Signup.event_id == event.id, Signup.member_id == member.id))
    if s:
        revision(s, value.expected_revision)
        if s.checked_in_at:
            fail(409, "already_arrived", "This signup is locked after check-in.")
    if value.phone is not None:
        member.phone = value.phone.strip()
    if source == "member" and not member.phone:
        fail(422, "phone_required", "Add your contact phone number before signing up.")
    snapshot = None
    if value.role == "driver":
        v = require(db, Vehicle, value.vehicle_id) if value.vehicle_id else None
        if v is None or v.member_id != member.id or v.removed:
            fail(422, "vehicle_required", "Choose one of this member's active cars.")
        if not 1 <= value.seats <= v.capacity:
            fail(422, "seat_capacity", "Offered seats must fit the car's passenger capacity.")
        snapshot = {k: getattr(v, k) for k in ("year", "make", "model", "color", "plate", "capacity")}
        if (
            db.scalar(
                select(DriverRegistration.id).where(
                    DriverRegistration.quarter_id == event.quarter_id,
                    DriverRegistration.member_id == member.id,
                )
            )
            is None
        ):
            db.add(DriverRegistration(quarter_id=event.quarter_id, member_id=member.id))
    definitions = {q["id"]: q for q in event.questions}
    if any(k not in definitions for k in value.answers) or any(len(v) > 2000 for v in value.answers.values()):
        fail(422, "answer_invalid", "An answer does not match the event questions.")
    for q in event.questions:
        answer = value.answers.get(q["id"], "").strip()
        if source != "import" and q["required"] and not answer:
            fail(422, "answer_required", "Complete the required questions.", field=q["id"])
        if answer and q["kind"] == "choice" and answer not in q["options"]:
            fail(422, "answer_invalid", "Choose one of the available answers.", field=q["id"])
        if answer and q["kind"] == "yes-no" and answer not in {"yes", "no"}:
            fail(422, "answer_invalid", "Choose yes or no.", field=q["id"])
    if s is None:
        s = Signup(event_id=event.id, member_id=member.id, role=value.role)
        db.add(s)
        db.flush()
    else:
        s.revision += 1
    s.role, s.vehicle_id, s.vehicle = value.role, value.vehicle_id if snapshot else None, snapshot
    s.seats = value.seats if snapshot else 0
    s.answers, s.notes, s.source, s.cancelled = value.answers, value.notes, source, False
    event.revision += 1
    db.flush()
    return s


def cancel_signup(db, s, event, actor, own=False):
    if s.checked_in_at:
        fail(409, "already_arrived", "Undo check-in before removing this signup.")
    if own and signup_window(event) != "open":
        fail(409, "signup_closed", "Signup changes are closed.")
    if not s.cancelled:
        s.cancelled = True
        s.revision += 1
        event.revision += 1
        audit(db, actor, "signup.cancel", s.id)


def next_card(db, event, category):
    used = set(db.scalars(select(Card.number).where(Card.event_id == event.id, Card.category == category)))
    maximum = event.paid_cards if category == "paid" else event.general_cards
    return next((n for n in range(1, maximum + 1) if n not in used), None)


def arrive(db, event, signup, actor):
    if signup.cancelled:
        fail(409, "signup_cancelled", "Restore this signup before checking in.")
    if signup.checked_in_at:
        return signup
    # Drivers and own-ride members never consume the rider-card inventory.
    if signup.role == "ride":
        category = "paid" if paid(db, signup.member_id, event.quarter_id) else "general"
        number = next_card(db, event, category)
        if number is None:
            fail(409, "cards_exhausted", "Increase card inventory before checking in.")
        db.add(Card(event_id=event.id, category=category, number=number, signup_id=signup.id))
    signup.checked_in_at = utcnow()
    signup.revision += 1
    event.revision += 1
    db.add(AttendanceAction(event_id=event.id, signup_id=signup.id, actor_id=actor.id, action="check-in"))
    if (
        signup.role == "driver"
        and db.scalar(select(Trip.id).where(Trip.event_id == event.id, Trip.member_id == signup.member_id))
        is None
    ):
        db.add(
            Trip(event_id=event.id, member_id=signup.member_id, source="arrival", arrival_signup_id=signup.id)
        )
    audit(db, actor, "attendance.check-in", signup.id)
    db.flush()
    return signup


def undo(db, event, signup, actor):
    if not signup.checked_in_at:
        return
    db.execute(
        delete(Assignment).where((Assignment.rider_id == signup.id) | (Assignment.driver_id == signup.id))
    )
    for card in db.scalars(select(Card).where(Card.signup_id == signup.id, Card.voided.is_(False))):
        card.voided = True
    trip = db.scalar(select(Trip).where(Trip.arrival_signup_id == signup.id))
    if trip and trip.source == "arrival" and not trip.edited:
        db.delete(trip)
    signup.checked_in_at = None
    signup.revision += 1
    event.revision += 1
    db.add(AttendanceAction(event_id=event.id, signup_id=signup.id, actor_id=actor.id, action="undo"))
    audit(db, actor, "attendance.undo", signup.id)
    db.flush()


def assign(db, event, rider, driver):
    if rider.event_id != event.id or rider.role != "ride" or rider.cancelled or not rider.checked_in_at:
        fail(409, "rider_unavailable", "Only checked-in active riders may be seated.")
    current = db.get(Assignment, rider.id)
    if driver is None:
        if current:
            db.delete(current)
    else:
        if (
            driver.event_id != event.id
            or driver.role != "driver"
            or driver.cancelled
            or not driver.checked_in_at
        ):
            fail(409, "driver_unavailable", "Choose an arrived driver for this event.")
        if current and current.driver_id == driver.id:
            return
        occupied = db.scalar(
            select(func.count()).select_from(Assignment).where(Assignment.driver_id == driver.id)
        )
        if occupied >= driver.seats:
            fail(409, "car_full", "This car is full. Choose another car.")
        if current:
            current.driver_id = driver.id
        else:
            db.add(Assignment(rider_id=rider.id, driver_id=driver.id))
    event.revision += 1
    db.flush()


def fill_remaining(db, event):
    arrivals = list(
        db.scalars(
            select(Signup).where(
                Signup.event_id == event.id, Signup.cancelled.is_(False), Signup.checked_in_at.is_not(None)
            )
        )
    )
    assigned = set(
        db.scalars(
            select(Assignment.rider_id)
            .join(Signup, Signup.id == Assignment.rider_id)
            .where(Signup.event_id == event.id)
        )
    )
    riders = sorted(
        (s for s in arrivals if s.role == "ride" and s.id not in assigned),
        key=lambda s: (not paid(db, s.member_id, event.quarter_id), s.checked_in_at, s.id),
    )
    drivers = sorted((s for s in arrivals if s.role == "driver"), key=lambda s: (s.checked_in_at, s.id))
    count = 0
    for driver in drivers:
        occupied = db.scalar(
            select(func.count()).select_from(Assignment).where(Assignment.driver_id == driver.id)
        )
        for _ in range(driver.seats - occupied):
            if not riders:
                break
            assign(db, event, riders.pop(0), driver)
            count += 1
    return count


def extension_chips(event):
    now = utcnow()
    departure = event.departure_at or event.starts_at
    options = [departure, departure + timedelta(minutes=5)]
    while len(options) < 2 or any(t <= now for t in options):
        options = [t for t in options if t > now]
        candidate = departure + timedelta(minutes=5)
        if options:
            candidate = options[-1] + timedelta(minutes=5)
        while candidate <= now:
            candidate += timedelta(minutes=5)
        options.append(candidate)
    return sorted(set(options))[:2]
