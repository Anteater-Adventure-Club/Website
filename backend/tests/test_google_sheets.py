import hashlib
from dataclasses import replace
from datetime import timedelta
from types import SimpleNamespace
from time import time
from urllib.parse import parse_qs, urlsplit

import pytest
from authlib.jose import JsonWebKey, jwt
from cryptography.fernet import Fernet
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from app.domain import utcnow
from app.models import Event, EventSheet, Member, SheetPermission, SheetsConnection, SheetsOAuthFlow, Signup
from app.routers.google_sheets import DRIVE_SCOPE, make_sheets_oauth
from app.services.sheets_google import GoogleFailure
from app.services.sheets_export import column_catalog
from app.services.sheets_worker import claim, heartbeat, process_job
from conftest import cookie, event, person, quarter, signup

CONNECTION = "/api/admin/integrations/google-sheets"
QUESTION = {"id": "activities", "label": "Activities", "kind": "multiple-select",
            "options": ["Hiking", "Picnic, games"], "required": False}


@pytest.fixture
def sheets(api):
    settings = replace(api.app.state.settings, sheets_enabled=True, sheets_client_id="client",
                       sheets_client_secret="secret", sheets_token_key=Fernet.generate_key().decode())
    api.app.state.settings = settings
    with api.app.state.sessions.begin() as db:
        db.add(SheetsConnection(id=1, subject="club-subject", email="club@example.com", generation=1,
                               refresh_token=Fernet(settings.sheets_token_key.encode()).encrypt(b"refresh-secret").decode()))
    return api


def sheet_url(e):
    return f"/api/admin/events/{e['id']}/google-sheet"


def configure(api, e, **extra):
    view = api.get(sheet_url(e)).json()
    response = api.put(sheet_url(e), json={"columns": view["columns"], "expected_revision": view["revision"], **extra})
    assert response.status_code == 200, response.text
    return response.json()


def target(api, e=None):
    with api.app.state.sessions() as db:
        query = select(EventSheet)
        if e:
            query = query.where(EventSheet.event_id == e["id"])
        return db.scalar(query)


def due(api):
    with api.app.state.sessions.begin() as db:
        for row in db.scalars(select(EventSheet)):
            row.due_at = row.access_due_at = utcnow() - timedelta(seconds=1)


class FakeGoogle:
    """Persistent remote state survives job retries and worker restarts."""
    def __init__(self):
        self.files, self.grants, self.snapshots = {}, {}, {}
        self.created, self.writes = 0, 0
        self.on_write = None
        self.create_error = self.write_error = self.share_error = None

    def __call__(self, settings, encrypted_token, guard, **kwargs):
        self.guard = guard
        return self

    def close(self):
        pass

    def find_file(self, key):
        self.guard()
        return self.files.get(key)

    def create_file(self, title, key):
        self.guard()
        self.created += 1
        self.files[key] = f"file-{self.created}"
        if self.create_error:
            error, self.create_error = self.create_error, None
            raise error
        return self.files[key]

    def ensure_tabs(self, *args):
        self.guard()

    def permissions(self, file_id, **kwargs):
        self.guard()
        return list(self.grants.values())

    def share(self, file_id, email):
        self.guard()
        pid = f"permission-{email}"
        self.grants[email] = {"id": pid, "emailAddress": email, "role": "writer", "type": "user"}
        if self.share_error:
            error, self.share_error = self.share_error, None
            raise error
        return pid

    def unshare(self, file_id, pid):
        self.guard()
        self.grants = {email: p for email, p in self.grants.items() if p["id"] != pid}

    def set_writer(self, file_id, pid):
        self.guard()
        next(p for p in self.grants.values() if p["id"] == pid)["role"] = "writer"

    def write_snapshot(self, file_id, sheet_id, columns, rows):
        self.guard()
        self.writes += 1
        if self.write_error:
            raise self.write_error
        self.snapshots[file_id] = {"columns": columns, "rows": rows}
        if self.on_write:
            action, self.on_write = self.on_write, None
            action()


def run(api, google, *, force=True):
    if force:
        due(api)
    job = claim(api.app.state.sessions)
    assert job is not None
    process_job(api.app.state.sessions, api.app.state.settings, job, client_factory=google)


def test_disabled_and_officer_only(api):
    e = event(api, quarter(api))
    view = api.get(sheet_url(e)).json()
    assert api.get(CONNECTION).json()["available"] is False
    assert api.put(sheet_url(e), json={"columns": view["columns"]}).status_code == 503
    p = person(api)
    api.cookies.set("aac_session", cookie(p["id"]))
    assert api.get(sheet_url(e)).status_code == 403
    assert api.get(CONNECTION).status_code == 403


def test_configuration_validates_columns_and_stale_edits(sheets):
    e = event(sheets, quarter(sheets), questions=[QUESTION])
    for columns in [[{"key": "name", "header": "Name"}],
                    [{"key": "status", "header": "Same"}, {"key": "email", "header": "same"}],
                    [{"key": "status", "header": "Status"}, {"key": "dues", "header": "Dues"}]]:
        assert sheets.put(sheet_url(e), json={"columns": columns}).status_code == 422
    view = configure(sheets, e, columns=[{"key": "status", "header": "Registration"},
                                        {"key": "question:activities", "header": "Plans"}])
    assert view["revision"] == 1
    assert sheets.put(sheet_url(e), json={"columns": view["columns"], "expected_revision": 0}).status_code == 409
    assert sheets.post(sheet_url(e) + "/sync", json={"expected_revision": 0}).status_code == 409
    assert target(sheets).requested == 1


def test_backfill_updates_cancel_restore_and_literal_answers(sheets):
    e = event(sheets, quarter(sheets), questions=[QUESTION])
    p = person(sheets)
    s = signup(sheets, e, p, answers={"activities": ["Hiking", "Picnic, games"]}, notes="=SUM(A1:A5)")
    configure(sheets, e)
    remote = FakeGoogle()
    run(sheets, remote)
    row = remote.snapshots["file-1"]["rows"][0]
    assert row == [str(s["id"]), p["name"], p["email"], p["phone"], "Needs a ride", row[5],
                   "Active", "=SUM(A1:A5)", "Hiking\nPicnic, games"]
    assert row[5].endswith(("PDT", "PST"))
    assert target(sheets).requested == target(sheets).completed
    assert claim(sheets.app.state.sessions) is None
    assert sheets.delete(f"/api/admin/signups/{s['id']}").status_code == 200
    queued = target(sheets)
    assert queued.due_at <= utcnow() + timedelta(seconds=31)
    assert queued.requested > queued.completed
    run(sheets, remote)
    assert remote.snapshots["file-1"]["rows"][0][6] == "Cancelled"
    restored = signup(sheets, e, p, answers={"activities": []})
    assert restored["id"] == s["id"]
    run(sheets, remote)
    assert len(remote.snapshots["file-1"]["rows"]) == 1
    assert remote.snapshots["file-1"]["rows"][0][6] == "Active"
    assert remote.snapshots["file-1"]["rows"][0][-1] == ""
    assert remote.created == 1


def test_transactional_profile_fanout_and_question_removal(sheets):
    q = quarter(sheets)
    events = [event(sheets, q, questions=[QUESTION]), event(sheets, q, name="Second event")]
    p = person(sheets)
    for e in events:
        signup(sheets, e, p)
        configure(sheets, e)
    sessions = sheets.app.state.sessions
    before = [target(sheets, e).requested for e in events]
    with sessions() as db:
        db.get(Member, p["id"]).name = "Rolled back"
        db.flush()
        db.rollback()
    assert [target(sheets, e).requested for e in events] == before
    with sessions.begin() as db:
        db.get(Member, p["id"]).name = "Changed name"
    assert [target(sheets, e).requested for e in events] == [v + 1 for v in before]
    with sessions.begin() as db:
        db.get(Event, events[0]["id"]).questions = []
    updated = target(sheets, events[0])
    assert updated.revision == 2
    assert all(c["key"] != "question:activities" for c in updated.columns)
    with sessions.begin() as db:
        db.get(Event, events[0]["id"]).questions = [QUESTION]
    assert all(c["key"] != "question:activities" for c in target(sheets, events[0]).columns)


def test_changes_during_sync_remain_pending_and_claims_expire(sheets):
    e = event(sheets, quarter(sheets))
    p = person(sheets)
    configure(sheets, e)
    remote = FakeGoogle()
    remote.on_write = lambda: signup(sheets, e, p)
    run(sheets, remote)
    assert target(sheets).requested > target(sheets).completed
    assert remote.snapshots["file-1"]["rows"] == []
    due(sheets)
    abandoned = claim(sheets.app.state.sessions)
    assert abandoned
    assert claim(sheets.app.state.sessions) is None
    with sheets.app.state.sessions.begin() as db:
        db.get(EventSheet, abandoned[0]).claimed_until = utcnow() - timedelta(seconds=1)
    run(sheets, remote)
    assert len(remote.snapshots["file-1"]["rows"]) == 1
    assert target(sheets).completed == target(sheets).requested


def test_pause_supersedes_job_and_resume_reuses_file(sheets):
    e = event(sheets, quarter(sheets))
    configure(sheets, e)
    remote = FakeGoogle()
    remote.on_write = lambda: configure(sheets, e, enabled=False)
    run(sheets, remote)
    paused = target(sheets)
    assert paused.enabled is False
    assert paused.completed == 0
    # Sharing continues while data is paused.
    p = person(sheets)
    assert sheets.post("/api/admin/officers", json={"member_id": p["id"]}).status_code == 200
    run(sheets, remote)
    assert p["email"] in remote.grants
    assert remote.writes == 1
    configure(sheets, e, enabled=True)
    run(sheets, remote)
    assert remote.created == 1
    assert target(sheets).completed == target(sheets).requested


@pytest.mark.parametrize("error", [GoogleFailure("Busy"), GoogleFailure("File missing", permanent=True),
                                   GoogleFailure("Reconnect", reconnect=True)])
def test_failures_do_not_lose_signups_and_sync_can_retry(sheets, error):
    e = event(sheets, quarter(sheets))
    configure(sheets, e)
    remote = FakeGoogle()
    remote.write_error = error
    run(sheets, remote)
    row = target(sheets)
    assert row.error == str(error) and row.completed == 0
    assert row.blocked == (error.permanent or error.reconnect)
    assert claim(sheets.app.state.sessions) is None
    saved = signup(sheets, e, person(sheets))
    with sheets.app.state.sessions() as db:
        assert db.get(Signup, saved["id"]) is not None
    if error.reconnect:
        assert sheets.get(CONNECTION).json()["connected"] is False
    else:
        remote.write_error = None
        assert sheets.post(sheet_url(e) + "/sync", json={"expected_revision": row.revision}).status_code == 200
        run(sheets, remote)
        assert len(remote.snapshots["file-1"]["rows"]) == 1
        assert target(sheets).error == ""


def test_uncertain_create_and_share_are_recovered_without_duplicates(sheets):
    e = event(sheets, quarter(sheets))
    configure(sheets, e)
    remote = FakeGoogle()
    remote.create_error = GoogleFailure("Response lost", uncertain=True)
    run(sheets, remote)
    assert target(sheets).provision_started_at is not None
    assert target(sheets).spreadsheet_id is None
    remote.share_error = GoogleFailure("Share response lost", uncertain=True)
    run(sheets, remote)
    assert target(sheets).access_error
    run(sheets, remote)
    assert remote.created == 1
    assert target(sheets).access_error == ""
    with sheets.app.state.sessions() as db:
        records = list(db.scalars(select(SheetPermission)))
        assert len(records) == 1
        assert records[0].permission_id == remote.grants["officer@uci.edu"]["id"]


def test_ambiguous_missing_create_requires_attention_without_recreating(sheets):
    e = event(sheets, quarter(sheets))
    configure(sheets, e)
    with sheets.app.state.sessions.begin() as db:
        db.get(EventSheet, target(sheets).id).provision_started_at = utcnow()
    remote = FakeGoogle()
    run(sheets, remote)
    assert target(sheets).blocked
    assert target(sheets).access_blocked
    assert remote.created == 0


def test_officer_revoke_and_event_deletion_preserve_manual_grants(sheets):
    e = event(sheets, quarter(sheets))
    configure(sheets, e)
    remote = FakeGoogle()
    remote.grants["manual@example.com"] = {"id": "manual", "emailAddress": "manual@example.com",
                                          "type": "user", "role": "writer"}
    run(sheets, remote)
    p = person(sheets)
    assert sheets.post("/api/admin/officers", json={"member_id": p["id"]}).status_code == 200
    run(sheets, remote)
    assert p["email"] in remote.grants
    assert sheets.delete(f"/api/admin/officers/{p['id']}").status_code == 200
    run(sheets, remote)
    assert p["email"] not in remote.grants
    assert "manual@example.com" in remote.grants
    response = sheets.post(f"/api/admin/events/{e['id']}/state", json={"state": "cancelled", "reason": "Cleanup"})
    assert response.status_code == 200
    response = sheets.request("DELETE", f"/api/admin/events/{e['id']}",
                              json={"expected_revision": response.json()["revision"]})
    assert response.status_code == 200, response.text
    assert target(sheets).event_id is None
    run(sheets, remote)
    assert set(remote.grants) == {"manual@example.com"}
    assert remote.created == 1 and remote.files
    assert target(sheets).access_completed == target(sheets).access_requested


def test_disconnect_stops_jobs_retains_files_and_heartbeat(sheets):
    e = event(sheets, quarter(sheets))
    configure(sheets, e)
    remote = FakeGoogle()
    run(sheets, remote)
    heartbeat(sheets.app.state.sessions)
    assert sheets.get(CONNECTION).json()["worker_healthy"]
    assert sheets.delete(CONNECTION).status_code == 200
    signup(sheets, e, person(sheets))
    due(sheets)
    assert claim(sheets.app.state.sessions) is None
    assert target(sheets).spreadsheet_id == "file-1"
    assert remote.grants
    with sheets.app.state.sessions() as db:
        c = db.get(SheetsConnection, 1)
        assert c.refresh_token is None and c.subject == "club-subject"


class OAuthStub:
    def __init__(self, token):
        self.token = token
        self.calls = 0

    async def authorize_redirect(self, request, callback, **kwargs):
        self.kwargs, self.callback = kwargs, callback
        return RedirectResponse("https://accounts.google.com/o/oauth2/auth?state=" + kwargs["state"])

    async def authorize_access_token(self, request):
        self.calls += 1
        return self.token


def oauth_setup(api, **token_updates):
    oauth = OAuthStub({"userinfo": {"sub": "club-subject", "email": "club@example.com", "email_verified": True},
                       "scope": f"openid email {DRIVE_SCOPE}", "refresh_token": "new-refresh", **token_updates})
    api.app.state.sheets_oauth = SimpleNamespace(create_client=lambda name: oauth)
    e = event(api, quarter(api))
    response = api.post(CONNECTION + "/connect", json={"event_id": e["id"]})
    assert response.status_code == 200, response.text
    assert oauth.kwargs["access_type"] == "offline"
    return oauth, e, oauth.kwargs["state"]


def test_oauth_encrypts_token_consumes_state_and_preserves_login(sheets):
    oauth, e, state = oauth_setup(sheets)
    with sheets.app.state.sessions() as db:
        assert db.get(SheetsOAuthFlow, hashlib.sha256(state.encode()).hexdigest()).officer_id == 1
    response = sheets.get(CONNECTION + "/callback", params={"state": state, "code": "code"}, follow_redirects=False)
    assert response.status_code == 303
    assert response.headers["location"].endswith(f"/{e['id']}?tab=google-sheets")
    with sheets.app.state.sessions() as db:
        c = db.get(SheetsConnection, 1)
        assert c.refresh_token != "new-refresh"
        assert Fernet(sheets.app.state.settings.sheets_token_key.encode()).decrypt(c.refresh_token.encode()) == b"new-refresh"
        assert db.get(Member, 1).email == "officer@uci.edu"
    assert sheets.get(CONNECTION + "/callback", params={"state": state}).status_code == 400
    assert oauth.calls == 1
    assert "refresh" not in sheets.get(CONNECTION).text


@pytest.mark.parametrize(("updates", "code"), [
    ({"scope": "openid email"}, "missing_scope"),
    ({"refresh_token": None}, "offline_access"),
    ({"userinfo": {"sub": "different", "email": "else@example.com", "email_verified": True}}, "wrong_account"),
    ({"userinfo": {"sub": "club-subject", "email": "club@example.com", "email_verified": False}}, "connection_failed"),
])
def test_oauth_rejects_wrong_account_scope_or_missing_offline_access(sheets, updates, code):
    _, _, state = oauth_setup(sheets, **updates)
    response = sheets.get(CONNECTION + "/callback", params={"state": state}, follow_redirects=False)
    assert response.headers["location"].endswith("sheets_error=" + code)
    with sheets.app.state.sessions() as db:
        assert db.get(SheetsConnection, 1).generation == 1


def test_oauth_state_is_bound_to_initiating_officer(sheets):
    oauth, _, state = oauth_setup(sheets)
    p = person(sheets)
    assert sheets.post("/api/admin/officers", json={"member_id": p["id"]}).status_code == 200
    sheets.cookies.set("aac_session", cookie(p["id"]))
    assert sheets.get(CONNECTION + "/callback", params={"state": state}).status_code == 400
    assert oauth.calls == 0


@pytest.mark.parametrize("nonce_case", ["valid", "wrong", "wrong-with-opt-out", "missing-with-opt-out"])
def test_real_authlib_state_pkce_and_signed_google_identity(sheets, monkeypatch, nonce_case):
    valid_nonce = nonce_case == "valid"
    sheets.app.state.sheets_oauth = make_sheets_oauth(sheets.app.state.settings)
    google = sheets.app.state.sheets_oauth.create_client("sheets")
    google.server_metadata.update({
        "_loaded_at": time(), "issuer": "https://accounts.google.com",
        "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_endpoint": "https://oauth2.googleapis.com/token",
        "id_token_signing_alg_values_supported": ["RS256"], "code_challenge_methods_supported": ["S256"],
    })
    key = JsonWebKey.generate_key("RSA", 2048, {"kid": "sheets-test"}, is_private=True)

    async def jwks(**kwargs):
        return {"keys": [key.as_dict(is_private=False)]}

    monkeypatch.setattr(google, "fetch_jwk_set", jwks)
    e = event(sheets, quarter(sheets))
    response = sheets.post(CONNECTION + "/connect", json={"event_id": e["id"]})
    assert response.status_code == 200
    authorization = {k: v[0] for k, v in parse_qs(urlsplit(response.json()["url"]).query).items()}
    assert authorization["scope"] == f"openid email {DRIVE_SCOPE}"
    assert authorization["code_challenge_method"] == "S256"

    async def exchange(**kwargs):
        assert kwargs["code_verifier"]
        claims = {"iss": "https://accounts.google.com", "sub": "club-subject", "aud": google.client_id,
                  "iat": int(time()), "exp": int(time()) + 300, "email": "club@example.com", "email_verified": True,
                  "nonce": authorization["nonce"] if valid_nonce else "wrong-nonce"}
        if nonce_case.endswith("with-opt-out"):
            claims["nonce_supported"] = False
        if nonce_case == "missing-with-opt-out":
            claims.pop("nonce")
        signed = jwt.encode({"alg": "RS256", "kid": "sheets-test"}, claims, key).decode()
        return {"id_token": signed, "access_token": "test-access", "refresh_token": "offline-secret",
                "scope": authorization["scope"]}

    monkeypatch.setattr(google, "fetch_access_token", exchange)
    response = sheets.get(CONNECTION + "/callback", params={"state": authorization["state"], "code": "test-code"},
                          follow_redirects=False)
    assert response.status_code == 303
    assert ("sheets_error=" not in response.headers["location"]) == valid_nonce
    assert sheets.get("/api/session").json()["member"]["id"] == 1
    with sheets.app.state.sessions() as db:
        assert db.get(SheetsConnection, 1).generation == (2 if valid_nonce else 1)


def test_disconnect_during_oauth_exchange_is_not_undone(sheets, monkeypatch):
    oauth, _, state = oauth_setup(sheets)

    async def exchange(request):
        with sheets.app.state.sessions.begin() as db:
            connection = db.get(SheetsConnection, 1)
            connection.generation += 1
            connection.refresh_token = None
        return oauth.token

    monkeypatch.setattr(oauth, "authorize_access_token", exchange)
    response = sheets.get(CONNECTION + "/callback", params={"state": state}, follow_redirects=False)
    assert response.headers["location"].endswith("sheets_error=connection_failed")
    assert sheets.get(CONNECTION).json()["connected"] is False


def test_imported_signups_queue_once_applied_and_duplicates_start_unconfigured(sheets):
    q = quarter(sheets)
    e = event(sheets, q)
    configure(sheets, e)
    remote = FakeGoogle()
    run(sheets, remote)
    preview = sheets.post("/api/admin/imports/preview", json={
        "mode": "participants", "quarter_id": q["id"], "event_id": e["id"],
        "fallback_role": "own", "text": "Name,Email,Phone\nImported,imported@uci.edu,9495550100",
    }).json()
    assert preview["can_apply"]
    response = sheets.post(f"/api/admin/imports/{preview['id']}/apply", json={"request_hash": preview["request_hash"]})
    assert response.status_code == 200, response.text
    assert target(sheets).requested > target(sheets).completed
    run(sheets, remote)
    assert remote.snapshots["file-1"]["rows"][0][1:3] == ["Imported", "imported@uci.edu"]
    response = sheets.post(f"/api/admin/events/{e['id']}/duplicate", json={
        "quarter_id": q["id"], "starts_at": (utcnow() + timedelta(days=3)).isoformat(),
        "ends_at": (utcnow() + timedelta(days=3, hours=2)).isoformat(),
    })
    assert response.status_code == 200, response.text
    assert sheets.get(sheet_url(response.json())).json()["configured"] is False


def test_officer_changes_retry_previously_blocked_sharing(sheets):
    e = event(sheets, quarter(sheets))
    configure(sheets, e)
    remote = FakeGoogle()
    remote.share_error = GoogleFailure("Sharing denied", permanent=True)
    run(sheets, remote)
    assert target(sheets).access_blocked
    p = person(sheets)
    assert sheets.post("/api/admin/officers", json={"member_id": p["id"]}).status_code == 200
    assert target(sheets).access_blocked is False
    run(sheets, remote)
    assert p["email"] in remote.grants
    assert target(sheets).access_completed == target(sheets).access_requested


def test_first_connection_before_worker_has_started(sheets):
    with sheets.app.state.sessions.begin() as db:
        db.delete(db.get(SheetsConnection, 1))
    _, _, state = oauth_setup(sheets)
    response = sheets.get(CONNECTION + "/callback", params={"state": state}, follow_redirects=False)
    assert "sheets_error" not in response.headers["location"]
    assert sheets.get(CONNECTION).json()["connected"] is True
    heartbeat(sheets.app.state.sessions)
    assert sheets.get(CONNECTION).json()["connected"] is True


def test_existing_question_labels_produce_valid_distinct_default_headings():
    catalog = column_catalog(SimpleNamespace(questions=[
        {"id": "blank", "label": " "}, {"id": "name", "label": " Name "},
        {"id": "another", "label": "name"},
    ]))
    assert catalog[-3:] == [{"key": "question:blank", "header": "Question blank"},
                            {"key": "question:name", "header": "Name (2)"},
                            {"key": "question:another", "header": "name (3)"}]
