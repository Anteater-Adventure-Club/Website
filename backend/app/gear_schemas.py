from datetime import date, datetime
from typing import Annotated, Literal
from pydantic import Field, StringConstraints, model_validator
from .schemas import DTO

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
Ownership = Literal["club", "officer"]
Status = Literal["pending", "approved", "denied", "picked_up", "returned", "cancelled"]


class GearTypeWrite(DTO):
    name: Name


class GearTypeView(GearTypeWrite):
    id: int
    revision: int


class GearEdit(DTO):
    expected_revision: int = Field(ge=1)


class GearTypeEdit(GearTypeWrite, GearEdit):
    pass


class GearItemWrite(DTO):
    type_id: int
    name: Name
    description: Description = ""
    quantity: int = Field(ge=0, le=100000)
    rentable: bool = False
    archived: bool = False
    ownership: Ownership = "club"
    owner: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] = ""
    loan_start: date | None = None
    loan_end: date | None = None

    @model_validator(mode="after")
    def loan_window(self):
        if self.ownership == "officer":
            if not self.owner or not self.loan_start or not self.loan_end or self.loan_end < self.loan_start:
                raise ValueError("Enter the owner and a valid loan period.")
        elif self.owner or self.loan_start or self.loan_end:
            raise ValueError("Only officer-owned equipment has a lender or loan period.")
        return self


class GearItemEdit(GearItemWrite, GearEdit):
    pass


class GearItemView(GearItemWrite):
    id: int
    revision: int


class GearInventory(DTO):
    types: list[GearTypeView]
    items: list[GearItemView]


class GearChoice(DTO):
    id: int
    type_id: int
    type_name: str
    name: str
    description: str
    ownership: Ownership
    available: int
    type_reserved: bool


class GearCatalog(DTO):
    quarter_id: int | None
    quarter_name: str | None
    eligible: bool
    items: list[GearChoice]


class GearAccess(DTO):
    first_pickup: date | None
    quarter_id: int | None
    quarter_name: str | None
    has_rentals: bool


class GearDates(DTO):
    start: date
    end: date


class GearRequest(GearDates):
    activity: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    comments: Description = ""
    item_ids: list[int] = Field(min_length=1, max_length=100)


class GearAssignment(GearRequest):
    member_id: int
    reason: Description = ""


class GearReschedule(GearDates, GearEdit):
    reason: Description = ""


class GearSelection(GearEdit):
    line_ids: list[int] = Field(min_length=1, max_length=100)


class GearAction(GearSelection):
    action: Literal["approve", "deny", "cancel", "pickup", "return"]
    message: Description = ""


class GearLineView(DTO):
    id: int
    item_id: int
    name: str
    type_name: str
    ownership: Ownership
    status: Status
    message: str
    overdue: bool
    missed: bool
    at_risk: bool


class GearRentalView(GearDates):
    id: int
    member_id: int
    member_name: str
    activity: str
    comments: str
    created_at: datetime
    revision: int
    status: str
    lines: list[GearLineView]
