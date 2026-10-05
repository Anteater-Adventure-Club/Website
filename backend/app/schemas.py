from datetime import date, datetime, time
from decimal import Decimal
from typing import Annotated, Any, Generic, Literal, TypeVar
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

Money = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]
Text100 = Annotated[str, Field(min_length=1, max_length=100)]
T = TypeVar("T")


class DTO(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")


class Page(DTO, Generic[T]):
    items: list[T]
    total: int


class Items(DTO, Generic[T]):
    items: list[T]


class Revision(DTO):
    expected_revision: int | None = None


class MemberInput(DTO):
    name: Text100
    email: str | None = Field(default=None, max_length=254)
    phone: str = Field(default="", max_length=40)
    student: bool = True

    @field_validator("email")
    @classmethod
    def email_valid(cls, v):
        if not v:
            return None
        v = v.strip().lower()
        if v.count("@") != 1 or " " in v or not v.split("@")[0] or "." not in v.split("@")[1]:
            raise ValueError("Enter a valid email address")
        return v


class ProfileWrite(DTO):
    name: Text100
    phone: str = Field(max_length=40)
    pronouns: str = Field(default="", max_length=60)
    discord: str = Field(default="", max_length=100)
    can_drive: bool | None = None
    student: bool = True
    driving_preferences: str = Field(default="", max_length=500)


class PayoutDetailsWrite(DTO):
    payout_method: Literal["", "venmo", "zelle", "cash", "other"] = ""
    payout_destination: str = Field(default="", max_length=200)
    payout_phone_suffix: str = Field(default="", pattern=r"^\d{0,4}$")


class MemberPrivate(DTO):
    id: int
    email: str | None
    name: str
    phone: str
    pronouns: str
    discord: str
    can_drive: bool | None
    student: bool
    driving_preferences: str
    payout_method: str
    payout_destination: str
    payout_phone_suffix: str


class VehicleWrite(DTO):
    year: int = Field(ge=1900, le=2100)
    make: Annotated[str, Field(min_length=1, max_length=60)]
    model: Annotated[str, Field(min_length=1, max_length=60)]
    color: str = Field(default="", max_length=40)
    plate: str = Field(default="", max_length=20)
    capacity: int = Field(ge=1, le=50)


class VehicleView(DTO):
    id: int
    year: int | None
    make: str
    model: str
    color: str
    plate: str
    capacity: int
    source: str


class QuarterWrite(Revision):
    name: Text100
    starts_on: date
    ends_on: date
    budget: Money = Decimal(0)
    driver_cap: Money = Decimal(0)
    mpg: Annotated[Decimal, Field(gt=0, le=200, decimal_places=2)] = Decimal(25)

    @model_validator(mode="after")
    def range_valid(self):
        if self.ends_on < self.starts_on:
            raise ValueError("The quarter must end on or after its first day")
        return self


class QuarterPublic(DTO):
    id: int
    name: str
    starts_on: date
    ends_on: date
    state: str


class QuarterPrivate(QuarterPublic):
    reimbursement_data_available: bool
    budget: Decimal | None
    driver_cap: Decimal | None
    mpg: Decimal | None
    revision: int

    @model_validator(mode="after")
    def historical_financials(self):
        if not self.reimbursement_data_available:
            self.budget = self.driver_cap = self.mpg = None
        return self


class MembershipSubmit(DTO):
    student: bool = True
    method: Literal["cash", "venmo", "zelle"]
    phone: str | None = Field(default=None, min_length=1, max_length=40)

    @field_validator("phone")
    @classmethod
    def contact_phone(cls, value):
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Enter your contact phone number")
        return value


class MembershipDecision(DTO):
    category: Literal["payment", "exception", "general"]
    student: bool = True
    amount: Money | None = None
    paid_on: date | None = None
    method: Literal["cash", "venmo", "zelle", "other"] | None = None
    reference: str = Field(default="", max_length=200)
    reason: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def fields_valid(self):
        if self.category == "payment" and (not self.amount or not self.paid_on or not self.method):
            raise ValueError("Payment amount, date and method are required")
        if self.category != "payment" and not self.reason.strip():
            raise ValueError("A reason is required")
        return self


class ReceiptView(DTO):
    id: int
    amount: Decimal
    paid_on: date
    method: str
    reference: str
    correction_of: int | None
    voided: bool
    reason: str
    created_at: datetime


class MembershipView(DTO):
    quarter_id: int
    status: str
    source: str | None = None
    student: bool = True
    method: str = ""
    submitted_at: datetime | None = None
    reason: str = ""
    receipts: list[ReceiptView] = []


class Question(DTO):
    id: Annotated[str, Field(min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")]
    label: Annotated[str, Field(min_length=1, max_length=200)]
    kind: Literal["text", "long", "choice", "yes-no"] = "text"
    required: bool = False
    options: list[Annotated[str, Field(min_length=1, max_length=100)]] = Field(default=[], max_length=30)

    @model_validator(mode="after")
    def choices_valid(self):
        if self.kind == "choice" and (len(self.options) < 2 or len(set(self.options)) != len(self.options)):
            raise ValueError("Choice questions need at least two distinct options")
        return self


class EventWrite(Revision):
    quarter_id: int
    name: Annotated[str, Field(min_length=1, max_length=150)]
    kind: Literal["regular", "meeting", "picnic", "retreat"] = "regular"
    destination: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=10000)
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    signups_enabled: bool = True
    opens_at: AwareDatetime | None = None
    closes_at: AwareDatetime | None = None
    arrival_at: AwareDatetime | None = None
    departure_at: AwareDatetime | None = None
    return_at: AwareDatetime | None = None
    packing: list[Annotated[str, Field(max_length=200)]] = Field(default=[], max_length=50)
    questions: list[Question] = Field(default=[], max_length=20)
    photo_id: str | None = None
    miles: Money = Decimal(0)
    gas_price: Annotated[Decimal, Field(ge=0, le=100, decimal_places=3)] = Decimal(0)
    rate_override: Annotated[Decimal, Field(ge=0, le=100, decimal_places=6)] | None = None

    @model_validator(mode="after")
    def valid_ranges(self):
        if self.ends_at < self.starts_at:
            raise ValueError("End must follow start")
        if self.opens_at and self.closes_at and self.opens_at >= self.closes_at:
            raise ValueError("Signup opening must be before closing")
        if self.closes_at and self.closes_at > self.starts_at:
            raise ValueError("Signups must close by the event start")
        if self.arrival_at and self.departure_at and self.arrival_at > self.departure_at:
            raise ValueError("Arrival must be before departure")
        if self.departure_at and self.return_at and self.departure_at > self.return_at:
            raise ValueError("Return must follow departure")
        if len({q.id for q in self.questions}) != len(self.questions):
            raise ValueError("Question IDs must be unique")
        return self


class StateChange(Revision):
    state: Literal["draft", "published", "completed", "cancelled"]
    reason: str = Field(default="", max_length=500)


class EventPublic(DTO):
    id: int
    slug: str
    quarter_id: int
    series_id: int | None
    name: str
    kind: Literal["regular", "meeting", "picnic", "retreat"]
    destination: str
    description: str
    starts_at: datetime
    ends_at: datetime
    state: str
    signups_enabled: bool
    opens_at: datetime | None
    closes_at: datetime | None
    arrival_at: datetime | None
    departure_at: datetime | None
    return_at: datetime | None
    packing: list[str]
    questions: list[Question]
    photo_id: str | None
    cancellation_reason: str
    signup_status: str
    signup_count: int
    offered_seats: int
    paid_riders: int
    paid_ride_guaranteed: bool
    published_recap: dict[str, Any] | None = None


class EventPrivate(EventPublic):
    miles: Decimal
    gas_price: Decimal
    rate_override: Decimal | None
    revision: int
    exception: bool
    skipped: bool
    completion: dict[str, Any] | None


class SignupWrite(Revision):
    role: Literal["ride", "driver", "own"]
    vehicle_id: int | None = None
    seats: int = Field(default=0, ge=0, le=50)
    answers: dict[str, str] = Field(default_factory=dict)
    notes: str = Field(default="", max_length=1000)
    phone: str | None = Field(default=None, max_length=40)
    request_id: str | None = Field(default=None, max_length=80)


class OfficerSignup(SignupWrite):
    member_id: int


class AssignmentWrite(Revision):
    driver_signup_id: int | None = None


class ExtensionWrite(DTO):
    until: AwareDatetime
    reason: Annotated[str, Field(min_length=1, max_length=500)]


class CardsWrite(Revision):
    general_cards: int = Field(ge=0, le=10000)
    paid_cards: int = Field(ge=0, le=10000)


class CardVoid(Revision):
    category: Literal["paid", "general"]
    number: int = Field(ge=1)


class MileageWrite(Revision):
    miles: Money
    gas_price: Annotated[Decimal, Field(ge=0, le=100, decimal_places=3)]
    rate_override: Annotated[Decimal, Field(ge=0, le=100, decimal_places=6)] | None = None


class TripWrite(Revision):
    cost_override: Money | None = None
    notes: str = Field(default="", max_length=1000)


class TripCreate(TripWrite):
    member_id: int


class EligibilityWrite(DTO):
    eligible_override: bool | None = None
    reason: Annotated[str, Field(min_length=1, max_length=500)]


class PaymentWrite(DTO):
    paid_on: date
    reference: Annotated[str, Field(min_length=1, max_length=200)]


class SeriesWrite(Revision):
    event: EventWrite
    kind: Literal["weekly", "alternating"] = "weekly"
    starts_on: date
    until: date
    start_time: time
    end_time: time
    weekdays_a: list[Annotated[int, Field(ge=0, le=6)]] = Field(min_length=1, max_length=7)
    weekdays_b: list[Annotated[int, Field(ge=0, le=6)]] = Field(default=[], max_length=7)
    excluded: list[date] = Field(default=[], max_length=366)
    effective_from: date | None = None
    request_id: str = Field(min_length=1, max_length=80)


class SeriesSingleWrite(Revision):
    event: EventWrite


class RecapWrite(Revision):
    image_id: str | None = None
    title: str = Field(default="", max_length=150)
    caption: str = Field(default="", max_length=300)
    text: str = Field(default="", max_length=500)
    homepage: bool = False


class TermWrite(DTO):
    label: Text100
    start_year: int = Field(ge=2000, le=2100)


class BoardEntryWrite(Revision):
    member_id: int | None = None
    name: Text100
    role: Text100
    major: str = Field(default="", max_length=100)
    bio: str = Field(default="", max_length=2000)
    memory: str = Field(default="", max_length=1000)
    instagram: str = Field(default="", max_length=300)
    photo_id: str | None = None
    palette: Literal["forest", "rose", "sunset", "ocean", "sage", "lavender"] = "forest"
    visible: bool = True
    position: int = Field(default=0, ge=0)
    site_access: bool = False

    @field_validator("instagram")
    @classmethod
    def safe_url(cls, v):
        if (
            v
            and not v.startswith("https://www.instagram.com/")
            and not v.startswith("https://instagram.com/")
        ):
            raise ValueError("Use an HTTPS Instagram profile URL")
        return v


class OrderWrite(Revision):
    ids: list[int]


class ImportWrite(DTO):
    mode: Literal["members", "paid_members", "participants"]
    quarter_id: int
    event_id: int | None = None
    text: str = Field(max_length=1048576)
    fallback_role: Literal["ride", "driver", "own"] = "ride"


class ImportApply(DTO):
    request_hash: str


class WalkInWrite(DTO):
    member_id: int | None = None
    member: MemberInput | None = None
    vehicle: VehicleWrite | None = None
    signup: SignupWrite
    request_id: Annotated[str, Field(min_length=1, max_length=80)]


class OfficerGrant(DTO):
    member_id: int


class DuplicateWrite(DTO):
    quarter_id: int
    starts_at: AwareDatetime
    ends_at: AwareDatetime


class SessionView(DTO):
    member: MemberPrivate | None
    officer: bool
    oauth_available: bool
    profile_complete: bool


class VehicleSnapshot(DTO):
    year: int | None
    make: str
    model: str
    color: str
    plate: str
    capacity: int


class CardView(DTO):
    category: str
    number: int


class AssignedCar(DTO):
    driver_name: str
    vehicle: VehicleSnapshot | None
    co_riders: list[str]


class SignupOwn(DTO):
    id: int
    member_id: int
    event_id: int
    name: str
    role: Literal["ride", "driver", "own", "unknown"]
    vehicle_id: int | None
    vehicle: VehicleSnapshot | None
    seats: int | None
    answers: dict[str, str]
    notes: str
    cancelled: bool
    checked_in_at: datetime | None
    joined_at: datetime | None
    attendance_status: Literal["registered", "checked_in", "attended", "missed", "cancelled", "unknown"]
    extended_until: datetime | None
    released: bool
    paid: bool
    revision: int
    card: CardView | None
    assigned_car: AssignedCar | None
    estimated_trip: str | None
    driver_signup_id: int | None
    editable: bool
    event: EventPublic | None


class SignupPrivate(SignupOwn):
    email: str | None
    phone: str


class AttendanceCounts(DTO):
    registered: int
    arrived: int | None


class InventoryCard(CardView):
    signup_id: int | None
    voided: bool


class CheckInView(DTO):
    event: EventPrivate
    revision: int
    server_time: datetime
    signups: list[SignupPrivate]
    counts: dict[str, AttendanceCounts]
    next_cards: dict[str, int | None]
    inventory: dict[str, int]
    cards: list[InventoryCard]
    extension_chips: list[datetime]


class MembershipBenefitView(DTO):
    quarter: QuarterPublic | None
    reimbursement_data_available: bool
    budget: str | None
    coverage: str | None


class MemberListRow(DTO):
    member: MemberPrivate
    membership: MembershipView | None


class MemberList(DTO):
    items: list[MemberListRow]
    total: int
    quarter_id: int | None


class MemberDetail(MemberListRow):
    memberships: list[MembershipView]
    signups: list[SignupPrivate]
    officer: bool


class MyOverview(DTO):
    quarter_id: int | None
    membership: MembershipView | None
    next_event: EventPublic | None
    signups: list[SignupOwn]


class TripRow(DTO):
    id: int
    member_id: int
    name: str
    cost: str
    cost_override: str | None
    notes: str
    source: str
    revision: int


class TripDetail(DTO):
    id: int
    event_id: int
    event_name: str
    starts_at: datetime
    miles: str
    rate: str
    cost: str
    cost_override: str | None
    notes: str
    source: str
    revision: int


class DriverRow(DTO):
    member_id: int
    name: str
    email: str | None
    payout_method: str
    payout_destination: str
    payout_phone_suffix: str
    membership_approved: bool
    eligible: bool
    eligible_override: bool | None
    eligibility_reason: str
    nominal: str
    eligible_cost: str
    capped: str
    allocated: str
    payout_id: int | None
    paid_on: date | None
    reference: str
    trips: list[TripDetail]


class EventCost(DTO):
    id: int
    name: str
    starts_at: datetime
    miles: str
    rate: str
    trip_count: int
    cost: str


class QuarterReport(DTO):
    quarter_id: int
    state: str
    reimbursement_data_available: bool
    budget: str | None
    driver_cap: str | None
    coverage: str | None
    totals: dict[str, str] | None
    drivers: list[DriverRow]
    events: list[EventCost]


class MyReimbursements(DTO):
    quarter: QuarterPublic | None
    driver: DriverRow | None
    reimbursement_data_available: bool = False
    budget: str | None = None
    driver_cap: str | None = None
    coverage: str | None = None


class BoardTermView(DTO):
    id: int
    label: str
    start_year: int
    current: bool
    revision: int


class BoardEntryPublic(DTO):
    id: int
    term_id: int
    name: str
    role: str
    major: str
    bio: str
    memory: str
    instagram: str
    photo_id: str | None
    palette: str
    position: int


class BoardEntryPrivate(BoardEntryPublic):
    member_id: int | None
    visible: bool
    revision: int
    site_access: bool


class BoardView(DTO):
    term: BoardTermView | None
    entries: list[BoardEntryPublic]


class BoardPrivateView(DTO):
    term: BoardTermView
    entries: list[BoardEntryPrivate]


class RecapContent(DTO):
    image_id: str | None = None
    title: str = ""
    caption: str = ""
    text: str = ""
    homepage: bool = False
    published_at: datetime | None = None


class RecapView(DTO):
    event_id: int
    completion: dict[str, Any] | None
    draft: RecapContent
    published: RecapContent | None
    revision: int


class GalleryRow(RecapContent):
    event_id: int
    event_name: str
    starts_at: datetime
    ends_at: datetime


class HomeView(DTO):
    upcoming: list[EventPublic]
    polaroids: list[GalleryRow]


class AttentionItem(DTO):
    kind: str
    count: int
    title: str
    url: str


class AdminOverview(DTO):
    quarter_id: int | None
    reimbursement_data_available: bool = False
    statistics: dict[str, str | int | None]
    events: list[EventPrivate]
    attention: list[AttentionItem]


class MediaView(DTO):
    id: str
    width: int
    height: int
    variants: list[str]
    preview_url: str


class ImportRow(DTO):
    line: int
    action: str
    name: str
    email: str | None
    phone: str
    student: bool
    role: str | None = None
    seats: int | None = None
    joined_at: datetime | None = None


class ImportIssue(DTO):
    line: int
    message: str


class ImportView(DTO):
    id: str
    request_hash: str
    expires_at: datetime
    rows: list[ImportRow]
    issues: list[ImportIssue]
    can_apply: bool
    total: int


class ImportOutcome(DTO):
    created: int
    reused: int
    skipped: int
    total: int


class SeriesOccurrence(EventPrivate):
    participated: bool


class SeriesView(DTO):
    id: int
    revision: int
    definition: SeriesWrite
    occurrences: list[SeriesOccurrence]


class SiteSettings(DTO):
    venmo: str
    zelle: str
    zelle_name: str = ""
    cash: str
    discord: str


class OfficerView(DTO):
    member_id: int
    name: str
    email: str | None
    granted_at: datetime


class AttendanceLogRow(DTO):
    id: int
    signup_id: int
    actor: str
    name: str
    action: str
    at: datetime


class QuestionAnswerRow(DTO):
    signup_id: int
    name: str
    answers: dict[str, str]


class QuestionAnswers(DTO):
    questions: list[Question]
    items: list[QuestionAnswerRow]
    totals: dict[str, dict[str, int]]
