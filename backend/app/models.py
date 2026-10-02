from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base


def now():
    return datetime.now(timezone.utc)


class Member(Base):
    __tablename__ = "members"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str | None] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(40), default="")
    pronouns: Mapped[str] = mapped_column(String(60), default="")
    discord: Mapped[str] = mapped_column(String(100), default="")
    can_drive: Mapped[bool | None] = mapped_column(Boolean)
    student: Mapped[bool] = mapped_column(Boolean, default=True)
    driving_preferences: Mapped[str] = mapped_column(String(500), default="")
    payout_method: Mapped[str] = mapped_column(String(20), default="")
    payout_destination: Mapped[str] = mapped_column(String(200), default="")
    payout_phone_suffix: Mapped[str] = mapped_column(String(4), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Identity(Base):
    __tablename__ = "identities"
    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), unique=True)
    issuer: Mapped[str] = mapped_column(String(200))
    subject: Mapped[str] = mapped_column(String(200))
    __table_args__ = (UniqueConstraint("issuer", "subject"),)


class Officer(Base):
    __tablename__ = "officers"
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), primary_key=True)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Marker(Base):
    __tablename__ = "markers"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)


class Vehicle(Base):
    __tablename__ = "vehicles"
    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), index=True)
    year: Mapped[int | None]
    make: Mapped[str] = mapped_column(String(60))
    model: Mapped[str] = mapped_column(String(60))
    color: Mapped[str] = mapped_column(String(40), default="")
    plate: Mapped[str] = mapped_column(String(20), default="")
    capacity: Mapped[int]
    removed: Mapped[bool] = mapped_column(default=False)
    source: Mapped[str] = mapped_column(String(20), default="member")
    __table_args__ = (CheckConstraint("capacity BETWEEN 1 AND 50"),)


class Quarter(Base):
    __tablename__ = "quarters"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    starts_on: Mapped[date] = mapped_column(Date)
    ends_on: Mapped[date] = mapped_column(Date)
    budget: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    driver_cap: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    mpg: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=25)
    state: Mapped[str] = mapped_column(String(20), default="open")
    reimbursement_data_available: Mapped[bool] = mapped_column(default=True, server_default="true")
    revision: Mapped[int] = mapped_column(default=1)
    __table_args__ = (
        CheckConstraint("ends_on >= starts_on"),
        CheckConstraint("budget >= 0 AND driver_cap >= 0 AND mpg > 0"),
        CheckConstraint("state IN ('open','finalized','archived')"),
    )


class Membership(Base):
    __tablename__ = "memberships"
    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), index=True)
    quarter_id: Mapped[int] = mapped_column(ForeignKey("quarters.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="general")
    source: Mapped[str | None] = mapped_column(String(20))
    student: Mapped[bool] = mapped_column(default=True)
    method: Mapped[str] = mapped_column(String(20), default="")
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str] = mapped_column(String(500), default="")
    __table_args__ = (
        UniqueConstraint("member_id", "quarter_id"),
        CheckConstraint("status IN ('general','pending','approved')"),
    )


class Receipt(Base):
    __tablename__ = "dues_receipts"
    id: Mapped[int] = mapped_column(primary_key=True)
    membership_id: Mapped[int] = mapped_column(ForeignKey("memberships.id"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    paid_on: Mapped[date]
    method: Mapped[str] = mapped_column(String(20))
    reference: Mapped[str] = mapped_column(String(200), default="")
    actor_id: Mapped[int] = mapped_column(ForeignKey("members.id"))
    correction_of: Mapped[int | None] = mapped_column(ForeignKey("dues_receipts.id"))
    voided: Mapped[bool] = mapped_column(default=False)
    reason: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Series(Base):
    __tablename__ = "event_series"
    id: Mapped[int] = mapped_column(primary_key=True)
    quarter_id: Mapped[int] = mapped_column(ForeignKey("quarters.id"), index=True)
    definition: Mapped[dict] = mapped_column(JSON)
    revision: Mapped[int] = mapped_column(default=1)
    request_id: Mapped[str] = mapped_column(String(80), unique=True)


class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(primary_key=True)
    quarter_id: Mapped[int] = mapped_column(ForeignKey("quarters.id"), index=True)
    series_id: Mapped[int | None] = mapped_column(ForeignKey("event_series.id"), index=True)
    original_date: Mapped[date | None]
    exception: Mapped[bool] = mapped_column(default=False)
    skipped: Mapped[bool] = mapped_column(default=False)
    name: Mapped[str] = mapped_column(String(150))
    kind: Mapped[str] = mapped_column(String(20), default="regular")
    destination: Mapped[str] = mapped_column(String(200), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    state: Mapped[str] = mapped_column(String(20), default="draft")
    signups_enabled: Mapped[bool] = mapped_column(default=True)
    opens_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    arrival_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    departure_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    return_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    packing: Mapped[list] = mapped_column(JSON, default=list)
    questions: Mapped[list] = mapped_column(JSON, default=list)
    photo_id: Mapped[str | None] = mapped_column(ForeignKey("media.id"))
    miles: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    gas_price: Mapped[Decimal] = mapped_column(Numeric(8, 3), default=0)
    rate_override: Mapped[Decimal | None] = mapped_column(Numeric(10, 6))
    cancellation_reason: Mapped[str] = mapped_column(String(500), default="")
    general_cards: Mapped[int] = mapped_column(default=100)
    paid_cards: Mapped[int] = mapped_column(default=100)
    completion: Mapped[dict | None] = mapped_column(JSON)
    revision: Mapped[int] = mapped_column(default=1)
    __table_args__ = (
        UniqueConstraint("series_id", "original_date"),
        Index("ix_event_calendar", "starts_at", "ends_at", "state"),
        CheckConstraint("ends_at >= starts_at"),
        CheckConstraint("miles >= 0 AND gas_price >= 0"),
        CheckConstraint("kind IN ('regular','meeting','picnic','retreat')"),
        CheckConstraint("state IN ('draft','published','completed','cancelled')"),
    )


class Signup(Base):
    __tablename__ = "signups"
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), index=True)
    role: Mapped[str] = mapped_column(String(10))
    vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id"))
    vehicle: Mapped[dict | None] = mapped_column(JSON)
    seats: Mapped[int | None] = mapped_column(Integer().evaluates_none(), default=0)
    answers: Mapped[dict] = mapped_column(JSON, default=dict)
    notes: Mapped[str] = mapped_column(String(1000), default="")
    source: Mapped[str] = mapped_column(String(20), default="member")
    joined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True).evaluates_none(), default=now)
    cancelled: Mapped[bool] = mapped_column(default=False)
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    extended_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    extension_reason: Mapped[str] = mapped_column(String(500), default="")
    revision: Mapped[int] = mapped_column(default=1)
    __table_args__ = (
        UniqueConstraint("event_id", "member_id"),
        CheckConstraint("role IN ('ride','driver','own','unknown')", name="ck_signups_role"),
        CheckConstraint("seats >= 0"),
    )


class Card(Base):
    __tablename__ = "cards"
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True)
    category: Mapped[str] = mapped_column(String(10))
    number: Mapped[int]
    signup_id: Mapped[int | None] = mapped_column(ForeignKey("signups.id"))
    voided: Mapped[bool] = mapped_column(default=False)
    __table_args__ = (UniqueConstraint("event_id", "category", "number"), CheckConstraint("number > 0"))


class Assignment(Base):
    __tablename__ = "assignments"
    rider_id: Mapped[int] = mapped_column(ForeignKey("signups.id"), primary_key=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("signups.id"), index=True)


class AttendanceAction(Base):
    __tablename__ = "attendance_actions"
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True)
    signup_id: Mapped[int] = mapped_column(ForeignKey("signups.id"))
    actor_id: Mapped[int] = mapped_column(ForeignKey("members.id"))
    action: Mapped[str] = mapped_column(String(20))
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class DriverRegistration(Base):
    __tablename__ = "driver_registrations"
    id: Mapped[int] = mapped_column(primary_key=True)
    quarter_id: Mapped[int] = mapped_column(ForeignKey("quarters.id"), index=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), index=True)
    eligible_override: Mapped[bool | None]
    reason: Mapped[str] = mapped_column(String(500), default="")
    __table_args__ = (UniqueConstraint("quarter_id", "member_id"),)


class Trip(Base):
    __tablename__ = "trips"
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), index=True)
    cost_override: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    notes: Mapped[str] = mapped_column(String(1000), default="")
    source: Mapped[str] = mapped_column(String(20), default="manual")
    arrival_signup_id: Mapped[int | None] = mapped_column(ForeignKey("signups.id"))
    edited: Mapped[bool] = mapped_column(default=False)
    revision: Mapped[int] = mapped_column(default=1)
    __table_args__ = (
        UniqueConstraint("event_id", "member_id"),
        CheckConstraint("cost_override IS NULL OR cost_override >= 0"),
    )


class Payout(Base):
    __tablename__ = "payouts"
    id: Mapped[int] = mapped_column(primary_key=True)
    quarter_id: Mapped[int] = mapped_column(ForeignKey("quarters.id"), index=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    snapshot: Mapped[dict] = mapped_column(JSON)
    paid_on: Mapped[date | None]
    reference: Mapped[str] = mapped_column(String(200), default="")
    __table_args__ = (UniqueConstraint("quarter_id", "member_id"),)


class Media(Base):
    __tablename__ = "media"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    purpose: Mapped[str] = mapped_column(String(20))
    width: Mapped[int]
    height: Mapped[int]
    variants: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Recap(Base):
    __tablename__ = "recaps"
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), primary_key=True)
    draft: Mapped[dict] = mapped_column(JSON, default=dict)
    published: Mapped[dict | None] = mapped_column(JSON(none_as_null=True))
    revision: Mapped[int] = mapped_column(default=1)


class BoardTerm(Base):
    __tablename__ = "board_terms"
    id: Mapped[int] = mapped_column(primary_key=True)
    label: Mapped[str] = mapped_column(String(100))
    start_year: Mapped[int] = mapped_column(unique=True)
    current: Mapped[bool] = mapped_column(default=True)
    revision: Mapped[int] = mapped_column(default=1)


class BoardEntry(Base):
    __tablename__ = "board_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    term_id: Mapped[int] = mapped_column(ForeignKey("board_terms.id"), index=True)
    member_id: Mapped[int | None] = mapped_column(ForeignKey("members.id"))
    name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(100))
    major: Mapped[str] = mapped_column(String(100), default="")
    bio: Mapped[str] = mapped_column(String(2000), default="")
    memory: Mapped[str] = mapped_column(String(1000), default="")
    instagram: Mapped[str] = mapped_column(String(300), default="")
    photo_id: Mapped[str | None] = mapped_column(ForeignKey("media.id"))
    palette: Mapped[str] = mapped_column(String(30), default="forest")
    visible: Mapped[bool] = mapped_column(default=True)
    position: Mapped[int] = mapped_column(default=0)
    revision: Mapped[int] = mapped_column(default=1)


class Audit(Base):
    __tablename__ = "audit"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("members.id"))
    action: Mapped[str] = mapped_column(String(100))
    entity: Mapped[str] = mapped_column(String(100))
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class ImportPreview(Base):
    __tablename__ = "import_previews"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("members.id"))
    request_hash: Mapped[str] = mapped_column(String(64))
    specification: Mapped[dict] = mapped_column(JSON)
    rows: Mapped[list] = mapped_column(JSON)
    issues: Mapped[list] = mapped_column(JSON)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    applied: Mapped[dict | None] = mapped_column(JSON)


class RateLimit(Base):
    __tablename__ = "rate_limits"
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    window: Mapped[int]
    count: Mapped[int] = mapped_column(default=1)
