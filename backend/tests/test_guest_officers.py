from datetime import timedelta
from io import BytesIO

import pytest
from PIL import Image
from sqlalchemy import select

from app.auth import PERMISSIONS
from app.domain import utcnow
from app.models import Audit, GuestOfficerAccess, Member
from conftest import cookie, event, person, quarter, signup


def login(api, mid=1):
    api.cookies.set("aac_session", cookie(mid))


def grant(api, member, permissions, **extra):
    login(api)
    response = api.post("/api/admin/guest-officers", json={
        "member_id": member["id"], "permissions": permissions,
        "expires_at": (utcnow() + timedelta(days=7)).isoformat(), **extra,
    })
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.parametrize("permission", PERMISSIONS)
def test_permission_matrix(api, permission):
    q = quarter(api)
    e = event(api, q)
    helper = person(api)
    grant(api, helper, [permission])
    login(api, helper["id"])
    paths = {
        f"/api/admin/events?quarter_id={q['id']}": {"events", "participation", "reimbursements"},
        f"/api/admin/events/{e['id']}": {"events", "participation", "reimbursements"},
        f"/api/admin/events/{e['id']}/recap": {"events"},
        f"/api/admin/events/{e['id']}/signups": {"participation"},
        f"/api/admin/events/{e['id']}/check-in": {"participation"},
        f"/api/admin/events/{e['id']}/questions": {"participation"},
        f"/api/admin/events/{e['id']}/signups.csv": {"participation"},
        f"/api/admin/events/{e['id']}/check-in-log": {"participation"},
        f"/api/admin/events/{e['id']}/trips": {"reimbursements"},
        f"/api/admin/quarters/{q['id']}/reimbursements": {"reimbursements"},
        "/api/admin/quarters": {"reimbursements"},
        "/api/admin/members": {"members"},
        f"/api/admin/members/{helper['id']}": {"members"},
        f"/api/admin/members/{helper['id']}/application": {"members"},
        "/api/admin/member-lookup": {"members", "participation", "reimbursements", "board"},
        "/api/admin/board/terms": {"board"},
        "/api/admin/officers": set(),
        "/api/admin/guest-officers": set(),
        "/api/admin/audit/recent": set(),
        "/api/admin/overview": set(),
        "/api/admin/application-form": set(),
        f"/api/admin/members/{helper['id']}/bans": set(),
        "/api/admin/integrations/google-sheets": set(),
        f"/api/admin/events/{e['id']}/google-sheet": set(),
    }
    for path, required in paths.items():
        response = api.get(path)
        assert response.status_code == (200 if permission in required else 403), (path, response.text)
    writes = [
        ("POST", "/api/admin/board/terms", {"label": "Guest board", "start_year": 2027}, "board"),
        ("POST", "/api/admin/members", {"name": "New member", "email": "new@uci.edu"}, {"members", "participation"}),
        ("POST", f"/api/admin/quarters/{q['id']}/drivers", {"member_id": helper["id"]}, "reimbursements"),
        ("POST", f"/api/admin/events/{e['id']}/signups", {"member_id": helper["id"], "role": "own"}, "participation"),
        ("PUT", f"/api/admin/events/{e['id']}/recap", {"title": "Guest recap"}, "events"),
        ("POST", f"/api/admin/members/{helper['id']}/memberships/{q['id']}/decision",
         {"category": "exception", "reason": "Helper", "student": True}, "members"),
    ]
    for method, path, body, required in writes:
        response = api.request(method, path, json=body)
        allowed = permission in required if isinstance(required, set) else permission == required
        assert (200 <= response.status_code < 300) if allowed else response.status_code == 403, (path, response.text)


def test_expiry_boundary_renewal_revocation_and_existing_session(api, monkeypatch):
    helper = person(api)
    record = grant(api, helper, ["board"], expires_at=(utcnow() + timedelta(hours=1)).isoformat())
    login(api, helper["id"])
    session = api.get("/api/session").json()
    assert session["officer"] is False
    assert session["officer_access"]["kind"] == "guest"
    with api.app.state.sessions() as db:
        expires = db.get(GuestOfficerAccess, helper["id"]).expires_at
    monkeypatch.setattr("app.auth.utcnow", lambda: expires - timedelta(microseconds=1))
    assert api.get("/api/admin/board/terms").status_code == 200
    monkeypatch.setattr("app.auth.utcnow", lambda: expires)
    assert api.get("/api/admin/board/terms").status_code == 403
    assert api.post("/api/admin/board/terms", json={"label": "Expired", "start_year": 2027}).status_code == 403
    assert api.get("/api/session").json()["officer_access"]["kind"] == "none"
    assert api.get("/api/me/profile").status_code == 200
    login(api)
    renewed = api.put(f"/api/admin/guest-officers/{helper['id']}", json={
        "permissions": ["members", "board"], "expires_at": (expires + timedelta(days=7)).isoformat(),
        "expected_revision": record["revision"],
    })
    assert renewed.status_code == 200, renewed.text
    login(api, helper["id"])
    assert api.get("/api/admin/members").status_code == 200
    login(api)
    assert api.delete(f"/api/admin/guest-officers/{helper['id']}").status_code == 200
    login(api, helper["id"])
    assert api.get("/api/admin/members").status_code == 403
    with api.app.state.sessions() as db:
        actions = set(db.scalars(select(Audit.action)))
        assert {"guest.grant", "guest.update", "guest.revoke"} <= actions


@pytest.mark.parametrize("extra", [
    {"permissions": []}, {"permissions": ["admin"]}, {"expires_at": None},
    {"expires_at": "2026-01-01T00:00:00"}, {"expires_at": "2000-01-01T00:00:00Z"},
])
def test_invalid_grants(api, extra):
    helper = person(api)
    response = api.post("/api/admin/guest-officers", json={
        "member_id": helper["id"], "permissions": ["board"],
        "expires_at": (utcnow() + timedelta(days=7)).isoformat(), **extra,
    })
    assert response.status_code == 422


def test_eligibility_stale_edit_and_promotion(api):
    helper = person(api)
    with api.app.state.sessions() as db:
        m = db.get(Member, helper["id"])
        m.email = "helper@example.com"
        m.approval_status = "pending"
        db.commit()
    body = {"member_id": helper["id"], "permissions": ["board"],
            "expires_at": (utcnow() + timedelta(days=7)).isoformat()}
    assert api.post("/api/admin/guest-officers", json=body).status_code == 422
    with api.app.state.sessions() as db:
        db.get(Member, helper["id"]).approval_status = "approved"
        db.commit()
    record = grant(api, helper, ["board"])
    assert api.post("/api/admin/guest-officers", json=body).status_code == 409
    edit = {"permissions": ["members"], "expires_at": body["expires_at"], "expected_revision": record["revision"]}
    assert api.put(f"/api/admin/guest-officers/{helper['id']}", json=edit).status_code == 200
    assert api.put(f"/api/admin/guest-officers/{helper['id']}", json=edit).status_code == 409
    assert api.post("/api/admin/officers", json={"member_id": helper["id"]}).status_code == 422
    assert api.delete("/api/admin/officers/1").status_code == 409
    with api.app.state.sessions() as db:
        db.get(Member, helper["id"]).email = "helper@uci.edu"
        db.commit()
    assert api.post("/api/admin/officers", json={"member_id": helper["id"]}).status_code == 200
    assert api.get("/api/admin/guest-officers").json()["items"] == []
    login(api, helper["id"])
    assert api.get("/api/session").json()["officer_access"]["kind"] == "full"


def test_guests_cannot_escalate_or_manage_full_officer_actions(api):
    q = quarter(api)
    helper = person(api)
    grant(api, helper, list(PERMISSIONS))
    login(api, helper["id"])
    for method, path, body in [
        ("POST", "/api/admin/officers", {"member_id": helper["id"]}),
        ("DELETE", "/api/admin/officers/1", None),
        ("POST", "/api/admin/guest-officers", {"member_id": helper["id"], "permissions": ["board"], "expires_at": (utcnow() + timedelta(days=7)).isoformat()}),
        ("DELETE", f"/api/admin/guest-officers/{helper['id']}", None),
        ("POST", f"/api/admin/quarters/{q['id']}/finalize", None),
        ("POST", f"/api/admin/quarters/{q['id']}/archive", None),
        ("PUT", f"/api/admin/quarters/{q['id']}", {"name": q["name"], "starts_on": q["starts_on"], "ends_on": q["ends_on"]}),
        ("POST", f"/api/admin/members/{helper['id']}/bans", {"all_events": True, "reason": "Private", "request_id": "guest-ban"}),
        ("PUT", "/api/admin/application-form", {"expected_revision": 1, "questions": []}),
    ]:
        response = api.request(method, path, json=body)
        assert response.status_code == 403, (path, response.text)
    term = api.post("/api/admin/board/terms", json={"label": "Test board", "start_year": 2027}).json()
    profile = {"member_id": 1, "name": "Officer", "role": "President"}
    path = f"/api/admin/board/terms/{term['id']}/entries"
    for supplied in [False, True, None]:
        assert api.post(path, json={**profile, "site_access": supplied}).status_code == 403
    created = api.post(path, json=profile)
    assert created.status_code == 201, created.text
    assert created.json()["site_access"] is True
    login(api)
    assert len(api.get("/api/admin/officers").json()["items"]) == 1


def test_shared_data_redacts_payouts_and_private_bans(api):
    q = quarter(api)
    helper = person(api)
    target = person(api, 2)
    with api.app.state.sessions() as db:
        m = db.get(Member, target["id"])
        m.payout_destination = "SECRET-PAYOUT"
        m.payout_method = "zelle"
        db.commit()
    assert api.post(f"/api/admin/members/{target['id']}/bans", json={
        "membership": True, "reason": "SECRET-BAN", "request_id": "private-ban",
    }).status_code == 201
    grant(api, helper, ["members", "participation"])
    login(api, helper["id"])
    for path in ["/api/admin/member-lookup", "/api/admin/members", f"/api/admin/members/{target['id']}"]:
        response = api.get(path)
        assert response.status_code == 200
        assert "SECRET-PAYOUT" not in response.text
        assert "SECRET-BAN" not in response.text
    # Creating/reusing an existing member must not return their payout fields either.
    response = api.post("/api/admin/members", json={"name": target["name"], "email": target["email"]})
    assert response.status_code == 201
    assert "SECRET-PAYOUT" not in response.text
    # Dues still enforce the member's ban even though its private reason is hidden.
    assert api.post(f"/api/admin/members/{target['id']}/memberships/{q['id']}/decision", json={
        "category": "exception", "reason": "Guest helper", "student": True,
    }).status_code == 403


def test_import_permissions_rechecked_at_apply(api):
    q = quarter(api)
    helper = person(api)
    record = grant(api, helper, ["members"])
    login(api, helper["id"])
    preview = api.post("/api/admin/imports/preview", json={
        "quarter_id": q["id"], "mode": "members", "text": "Name,Email\nImported,imported@uci.edu",
    })
    assert preview.status_code == 200, preview.text
    login(api)
    assert api.put(f"/api/admin/guest-officers/{helper['id']}", json={
        "permissions": ["participation"], "expires_at": record["expires_at"], "expected_revision": record["revision"],
    }).status_code == 200
    login(api, helper["id"])
    response = api.post(f"/api/admin/imports/{preview.json()['id']}/apply", json={"request_hash": preview.json()["request_hash"]})
    assert response.status_code == 403


def test_media_permissions_follow_stored_purpose(api):
    image = BytesIO()
    Image.new("RGB", (10, 10), "green").save(image, format="PNG")
    image_bytes = image.getvalue()
    board_image = api.post("/api/admin/media", data={"purpose": "board"}, files={"file": ("board.png", image_bytes, "image/png")}).json()
    helper = person(api)
    grant(api, helper, ["events"])
    login(api, helper["id"])
    assert api.get(f"/api/admin/media/{board_image['id']}").status_code == 403
    assert api.delete(f"/api/admin/media/{board_image['id']}").status_code == 403
    assert api.post("/api/admin/media", data={"purpose": "board"}, files={"file": ("board.png", image_bytes, "image/png")}).status_code == 403
    assert api.post("/api/admin/media", data={"purpose": "event"}, files={"file": ("event.png", image_bytes, "image/png")}).status_code == 201


def test_participation_guest_can_finish_check_in_workflow(api):
    q = quarter(api)
    e = event(api, q)
    helper = person(api)
    target = person(api, 2)
    row = signup(api, e, target, role="own")
    grant(api, helper, ["participation"])
    login(api, helper["id"])
    path = f"/api/admin/signups/{row['id']}/check-in"
    assert api.post(path).status_code == 200
    assert api.get(f"/api/admin/events/{e['id']}/check-in-log").json()["total"] == 1
    assert api.delete(path).status_code == 200
    assert api.get(f"/api/admin/members/{target['id']}/vehicles").status_code == 200


def test_event_editor_gets_participation_flag_without_a_private_roster(api):
    q = quarter(api)
    e = event(api, q)
    target = person(api)
    row = signup(api, e, target, role="own")
    assert api.delete(f"/api/admin/signups/{row['id']}").status_code == 200
    helper = person(api, 2)
    grant(api, helper, ["events"])
    login(api, helper["id"])
    response = api.get(f"/api/admin/events/{e['id']}")
    assert response.status_code == 200
    assert response.json()["has_signups"] is True
    assert response.json()["signup_count"] == 0
    assert api.get(f"/api/admin/events/{e['id']}/signups").status_code == 403


def test_approval_changes_suspend_an_existing_guest_grant(api):
    helper = person(api)
    grant(api, helper, ["members"])
    login(api, helper["id"])
    with api.app.state.sessions() as db:
        db.get(Member, helper["id"]).approval_status = "denied"
        db.commit()
    assert api.get("/api/admin/members").status_code == 403
    assert api.get("/api/session").json()["officer_access"]["kind"] == "none"


def test_guest_can_edit_linked_board_profile_without_changing_access(api):
    term = api.post("/api/admin/board/terms", json={"label": "Board", "start_year": 2027}).json()
    profile = {"member_id": 1, "name": "Officer", "role": "President"}
    created = api.post(f"/api/admin/board/terms/{term['id']}/entries", json=profile).json()
    helper = person(api)
    grant(api, helper, ["board"])
    login(api, helper["id"])
    path = f"/api/admin/board/entries/{created['id']}"
    response = api.put(path, json={**profile, "bio": "Updated by helper", "expected_revision": created["revision"]})
    assert response.status_code == 200, response.text
    assert response.json()["site_access"] is True
    assert api.put(path, json={**profile, "site_access": False}).status_code == 403
