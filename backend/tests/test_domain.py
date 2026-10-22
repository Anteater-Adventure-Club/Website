from datetime import date, time, timedelta
from decimal import Decimal
import pytest
from fastapi import HTTPException
from app.auth import safe_return, uci_email
from app.domain import allocate, expand_series, local_instant, utcnow
from app.models import Event
from app.schemas import EventWrite, SeriesWrite
from app.services.participation import extension_chips


@pytest.mark.parametrize(
    "value,expected",
    [
        ("gdodge@uci.edu", True),
        ("a@law.uci.edu", True),
        ("a@uci.edu.evil.org", False),
        ("@uci.edu", False),
        (None, False),
    ],
)
def test_uci(value, expected):
    assert uci_email(value) == expected


@pytest.mark.parametrize(
    "value,expected",
    [
        ("/admin/events?tab=trips", "/admin/events?tab=trips"),
        ("//evil.org", "/my-aac"),
        ("/\\evil.org", "/my-aac"),
        ("https://evil.org", "/my-aac"),
        ("/\nattack", "/my-aac"),
    ],
)
def test_return(value, expected):
    assert safe_return(value) == expected


def test_largest_remainder_cap_and_zero():
    assert allocate({3: Decimal(10), 2: Decimal(10), 1: Decimal(10)}, Decimal("0.02")) == {
        3: Decimal(0),
        2: Decimal(".01"),
        1: Decimal(".01"),
    }
    assert sum(allocate({1: Decimal(120), 2: Decimal(10)}, Decimal(100), Decimal(50)).values()) == Decimal(60)
    assert allocate({1: Decimal(0)}, Decimal(10)) == {1: Decimal(0)}


@pytest.mark.parametrize("budget", [Decimal("0"), Decimal(".01"), Decimal("17.23"), Decimal("500")])
def test_allocation_invariants(budget):
    costs = {i: Decimal(i * 11) / 7 for i in range(1, 51)}
    result = allocate(costs, budget, Decimal(30))
    assert sum(result.values()) == min(budget, sum(min(v, Decimal(30)) for v in costs.values())).quantize(
        Decimal(".01")
    )
    assert all(v >= 0 and v <= Decimal(30) for v in result.values())
    assert result == allocate(dict(reversed(list(costs.items()))), budget, Decimal(30))


@pytest.mark.parametrize("day,clock", [(date(2026, 3, 8), time(2, 30)), (date(2026, 11, 1), time(1, 30))])
def test_dst_rejects_invalid_and_ambiguous(day, clock):
    with pytest.raises(HTTPException):
        local_instant(day, clock)


def test_fortnightly_calendar_not_elapsed_hours():
    first = local_instant(date(2026, 10, 26), time(18))
    e = EventWrite(
        quarter_id=1,
        name="Meetings",
        starts_at=first,
        ends_at=first + timedelta(hours=1),
        signups_enabled=False,
    )
    value = SeriesWrite(
        event=e,
        starts_on=date(2026, 10, 26),
        until=date(2026, 11, 30),
        start_time=time(18),
        end_time=time(19),
        weekdays_a=[0],
        weekdays_b=[],
        kind="alternating",
        request_id="test",
    )
    rows = expand_series(value)
    assert [r["date"] for r in rows] == [date(2026, 10, 26), date(2026, 11, 9), date(2026, 11, 23)]
    assert all(r["starts_at"].hour == 18 for r in rows)
    assert rows[0]["starts_at"].utcoffset() != rows[1]["starts_at"].utcoffset()


@pytest.mark.parametrize("minutes", [-61, -5, -1, 0, 2, 60])
def test_quick_chips_always_two_future(minutes):
    e = Event(departure_at=utcnow() + timedelta(minutes=minutes), starts_at=utcnow())
    chips = extension_chips(e)
    assert len(chips) == 2 and chips[0] < chips[1] and all(c > utcnow() for c in chips)
