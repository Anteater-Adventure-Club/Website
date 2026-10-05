import pytest
from sqlalchemy import func, select

from app.models import Membership
from conftest import cookie, quarter


def contact_member(api, phone=""):
    response = api.post("/api/admin/members", json={
        "name": "Returning Member", "email": "returning@uci.edu", "phone": phone, "student": False,
    })
    assert response.status_code == 201
    api.cookies.set("aac_session", cookie(response.json()["id"]))
    response = api.put("/api/me/profile", json={
        "name": "Returning Member", "phone": phone, "student": False,
        "pronouns": "they/them", "discord": "returning-member", "can_drive": True,
        "driving_preferences": "Prefer morning trips",
    })
    assert response.status_code == 200
    return response.json()


@pytest.mark.parametrize("existing_phone", ["", "9495550100"])
def test_dues_saves_contact_number_and_preserves_other_profile_fields(api, existing_phone):
    q = quarter(api)
    profile = contact_member(api, existing_phone)
    body = {"student": True, "method": "venmo", "phone": "  +1 (949) 555-0123  "}
    response = api.post(f"/api/me/memberships/{q['id']}", json=body)
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "pending"
    assert response.json()["method"] == "venmo"
    assert response.json()["student"] is True
    assert api.get("/api/me/profile").json() == {**profile, "phone": "+1 (949) 555-0123"}
    assert api.get("/api/session").json()["profile_complete"] is True
    retry = api.post(f"/api/me/memberships/{q['id']}", json=body)
    assert retry.status_code == 200
    with api.app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(Membership)) == 1


@pytest.mark.parametrize("phone", ["", " \t ", "1" * 41])
def test_invalid_contact_does_not_change_profile_or_submit_dues(api, phone):
    q = quarter(api)
    profile = contact_member(api, "9495550100")
    response = api.post(f"/api/me/memberships/{q['id']}", json={"method": "cash", "phone": phone})
    assert response.status_code == 422
    assert api.get("/api/me/profile").json() == profile
    assert api.get(f"/api/me/memberships/{q['id']}").json()["status"] == "general"
    with api.app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(Membership)) == 0


@pytest.mark.parametrize("existing_phone", ["", "9495550100"])
def test_previous_clients_can_use_saved_phone_but_cannot_submit_without_one(api, existing_phone):
    q = quarter(api)
    profile = contact_member(api, existing_phone)
    response = api.post(f"/api/me/memberships/{q['id']}", json={"method": "cash"})
    if existing_phone:
        assert response.status_code == 200
        assert response.json()["status"] == "pending"
    else:
        assert response.status_code == 422
        assert response.json()["detail"]["code"] == "phone_required"
        assert api.get(f"/api/me/memberships/{q['id']}").json()["status"] == "general"
    assert api.get("/api/me/profile").json() == profile


def test_closed_quarter_does_not_save_contact_number_without_dues(api):
    q = quarter(api)
    assert api.post(f"/api/admin/quarters/{q['id']}/finalize").status_code == 200
    profile = contact_member(api)
    response = api.post(f"/api/me/memberships/{q['id']}", json={"method": "cash", "phone": "9495550123"})
    assert response.status_code == 409
    assert api.get("/api/me/profile").json() == profile
    assert api.get(f"/api/me/memberships/{q['id']}").json()["status"] == "general"
    with api.app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(Membership)) == 0
