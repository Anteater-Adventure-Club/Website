import base64
import copy
import io
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal

import pytest
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import uci_email
from app.historical_import import ACTION, MARKER, ImportConflict, run_import
from app.models import Audit, Identity, Member, Officer, Payout, Quarter, Signup


def bundle():
    image = io.BytesIO()
    Image.new("RGB", (64, 48), "green").save(image, "PNG")
    return {
        "version": 1,
        "manifest": {"source": "synthetic history"},
        "members": [
            {
                "key": "owner",
                "name": "Historical name",
                "email": "officer@uci.edu",
                "phone": "old",
                "aliases": ["officer@uci.edu"],
                "source_keys": ["old:driver:1"],
            },
            {
                "key": "guest",
                "name": "Guest Driver",
                "email": "guest@example.com",
                "aliases": ["guest@example.com"],
            },
            {"key": "unknown", "name": "No Email", "email": None, "aliases": []},
        ],
        "quarters": [
            {
                "key": "W25",
                "name": "Winter 2025",
                "starts_on": "2025-01-01",
                "ends_on": "2025-03-31",
                "budget": "200",
                "driver_cap": "0",
                "mpg": "25",
                "state": "archived",
                "reimbursement_data_available": True,
            },
            {
                "key": "F24",
                "name": "Fall 2024",
                "starts_on": "2024-09-01",
                "ends_on": "2024-12-31",
                "state": "archived",
                "reimbursement_data_available": False,
            },
        ],
        "memberships": [
            {
                "key": "dues",
                "member_key": "guest",
                "quarter_key": "W25",
                "status": "approved",
                "source": "imported",
            },
        ],
        "receipts": [
            {
                "key": "receipt",
                "membership_key": "dues",
                "amount": "20",
                "paid_on": "2025-03-31",
                "method": "other",
            }
        ],
        "vehicles": [],
        "events": [
            {
                "key": "retreat",
                "quarter_key": "W25",
                "name": "Death Valley",
                "kind": "retreat",
                "state": "completed",
                "starts_at": "2025-02-14T08:00:00+00:00",
                "ends_at": "2025-02-17T07:59:59+00:00",
                "miles": "100",
                "rate_override": "0.10",
            },
            {
                "key": "hike",
                "quarter_key": "W25",
                "name": "Hike",
                "state": "completed",
                "starts_at": "2025-03-01T08:00:00+00:00",
                "ends_at": "2025-03-02T07:59:59+00:00",
                "miles": "50",
                "rate_override": "0.10",
            },
        ],
        "signups": [
            {
                "key": "s1",
                "member_key": "owner",
                "event_key": "retreat",
                "role": "unknown",
                "seats": None,
                "joined_at": None,
            },
            {
                "key": "s2",
                "member_key": "guest",
                "event_key": "retreat",
                "role": "driver",
                "seats": None,
                "joined_at": None,
            },
        ],
        "driver_registrations": [
            {"key": "registration", "member_key": "guest", "quarter_key": "W25", "eligible_override": False},
        ],
        "trips": [
            {"key": "t1", "member_key": "guest", "event_key": "retreat"},
            {"key": "t2", "member_key": "guest", "event_key": "hike"},
        ],
        "payouts": [
            {
                "key": "p1",
                "member_key": "guest",
                "quarter_key": "W25",
                "amount": "7.25",
                "paid_on": "2025-03-31",
            }
        ],
        "media": [{"key": "photo", "purpose": "board", "data": base64.b64encode(image.getvalue()).decode()}],
        "boards": [
            {
                "key": "board",
                "start_year": 2024,
                "label": "2024–2025",
                "current": False,
                "entries": [{"name": "Guest Driver", "role": "President", "photo_key": "photo"}],
            }
        ],
        "recaps": [
            {
                "key": "recap",
                "event_key": "retreat",
                "image_key": "photo",
                "title": "Death Valley",
                "caption": "Our trip",
                "text": "A weekend in the desert.",
                "homepage": True,
            }
        ],
    }


def test_import_preserves_accounts_dates_and_quarter_eligibility(api, engine, tmp_path):
    assert api.get("/api/health/ready").status_code == 200
    with Session(engine) as db:
        owner = db.get(Member, 1)
        owner.name, owner.phone = "Existing Name", "existing phone"
        db.add(Identity(member_id=1, issuer="https://accounts.google.com", subject="existing-subject"))
        db.commit()
    result = run_import(engine, bundle(), 1, tmp_path, apply=True)
    assert result["counts"]["members_reused"] == 1
    assert result["counts"]["signups"] == 2
    with Session(engine) as db:
        owner = db.get(Member, 1)
        assert (owner.name, owner.phone) == ("Existing Name", "existing phone")
        assert db.scalar(select(Identity.subject)) == "existing-subject"
        assert db.scalar(select(func.count()).select_from(Officer)) == 1
        assert db.scalar(select(Payout.amount)) == Decimal("7.25")
        assert db.scalar(select(Payout.paid_on)) == date(2025, 3, 31)
        assert (
            db.scalar(
                select(func.count()).select_from(Audit).where(Audit.action == ACTION, Audit.entity == MARKER)
            )
            == 1
        )
    qid = result["mappings"]["W25"]["id"]
    data = api.get(f"/api/admin/quarters/{qid}/reimbursements").json()
    driver = data["drivers"][0]
    assert driver["nominal"] == "15.00"
    assert driver["eligible_cost"] == "0"
    assert driver["eligible"] is False  # Approved dues cannot override this quarter's explicit decision.
    assert driver["allocated"] == "7.25"  # Preserve the approved historical payout.
    assert Decimal(data["totals"]["paid"]) == Decimal("7.25")
    history = api.get("/api/me/signups").json()["items"]
    assert history[0]["attendance_status"] == "unknown"
    assert history[0]["role"] == "unknown"
    assert history[0]["joined_at"] is None
    checkin = api.get(f"/api/admin/events/{result['mappings']['retreat']['id']}/check-in").json()
    assert checkin["counts"]["unknown"]["registered"] == 1
    assert checkin["counts"]["driver"]["arrived"] is None
    home = api.get("/api/home").json()
    assert home["polaroids"][0]["ends_at"].startswith("2025-02-17T07:59:59")
    assert uci_email("guest@example.com") is False
    assert len(list(tmp_path.glob("*.webp"))) == 3


def test_unknown_financials_are_distinct_from_zero(api, engine, tmp_path):
    result = run_import(engine, bundle(), 1, tmp_path, apply=True)
    qid = result["mappings"]["F24"]["id"]
    data = api.get(f"/api/admin/quarters/{qid}/reimbursements").json()
    assert data["reimbursement_data_available"] is False
    assert data["totals"] is None and data["budget"] is None
    assert data["drivers"] == []
    private = next(q for q in api.get("/api/admin/quarters").json()["items"] if q["id"] == qid)
    assert private["budget"] is None and private["mpg"] is None
    personal = api.get(f"/api/me/reimbursements?quarter_id={qid}").json()
    assert personal["reimbursement_data_available"] is False and personal["coverage"] is None
    benefits = api.get(f"/api/membership-benefits?quarter_id={qid}").json()
    assert benefits["budget"] is None
    assert api.get(f"/api/admin/overview?quarter_id={qid}").json()["statistics"]["budget"] is None


def test_dry_run_and_invalid_import_leave_no_records_or_media(api, engine, tmp_path):
    run_import(engine, bundle(), 1, tmp_path)
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Member)) == 1
        assert db.scalar(select(func.count()).select_from(Quarter)) == 0
    assert list(tmp_path.iterdir()) == []
    invalid = bundle()
    invalid["recaps"][0]["event_key"] = "missing-event"
    with pytest.raises(KeyError):
        run_import(engine, invalid, 1, tmp_path, apply=True)
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Signup)) == 0
        assert db.scalar(select(func.count()).select_from(Audit).where(Audit.action == ACTION)) == 0
    assert list(tmp_path.iterdir()) == []


def test_concurrent_import_applies_once(api, engine, tmp_path):
    def apply():
        try:
            run_import(engine, bundle(), 1, tmp_path, apply=True)
            return "applied"
        except ImportConflict:
            return "blocked"

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: apply(), range(2)))
    assert sorted(results) == ["applied", "blocked"]
    with pytest.raises(ImportConflict, match="already been applied"):
        run_import(engine, bundle(), 1, tmp_path, apply=True)
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Member)) == 3
        assert db.scalar(select(func.count()).select_from(Payout)) == 1


def test_import_rejects_per_trip_eligibility_and_ambiguous_accounts(api, engine, tmp_path):
    invalid = bundle()
    invalid["trips"][0]["eligible_override"] = True
    with pytest.raises(ValueError, match="never a trip"):
        run_import(engine, invalid, 1, tmp_path, apply=True)
    with Session(engine) as db:
        db.add(Member(name="Second Account", email="second@uci.edu"))
        db.commit()
    invalid = copy.deepcopy(bundle())
    invalid["members"][0]["aliases"].append("second@uci.edu")
    with pytest.raises(ImportConflict, match="Multiple destination accounts"):
        run_import(engine, invalid, 1, tmp_path, apply=True)


def test_historical_unknown_fields_do_not_relax_live_signup_validation(api):
    response = api.post("/api/admin/events/123/signups", json={"member_id": 1, "role": "unknown"})
    assert response.status_code == 422
