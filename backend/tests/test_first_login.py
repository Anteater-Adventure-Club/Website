"""Exercise real Authlib state and signed OIDC claims without contacting Google."""
import base64
import json
from dataclasses import replace
from time import time
from urllib.parse import parse_qs, urlsplit

import pytest
from authlib.jose import JsonWebKey, jwt
from fastapi.testclient import TestClient
from itsdangerous import TimestampSigner
from sqlalchemy import func, select

from app.main import create_app
from app.models import Identity, Member, Officer
from conftest import SECRET


ORIGIN = "https://canonical.test"
ISSUER = "https://accounts.google.com"
EMAIL = "first-login-fixture@uci.edu"
NON_UCI_EMAIL = "first-login-fixture@gmail.com"


class GoogleFlow:
    def __init__(self, client, google, key):
        self.client = client
        self.google = google
        self.key = key
        self.authorization = {}
        self.claim_overrides = {}
        self.token_fetches = 0

    def begin(self, origin=ORIGIN, mode=None):
        params = {"return_to": "/my-aac/profile"}
        if mode is not None:
            params["mode"] = mode
        response = self.client.get(
            origin + "/api/auth/login", params=params,
            follow_redirects=False,
        )
        # A canonical-origin redirect may precede authorization (issue 2).
        if response.status_code == 303:
            response = self.client.get(response.headers["location"], follow_redirects=False)
        assert response.status_code == 302
        target = urlsplit(response.headers["location"])
        assert target.netloc == "accounts.google.com"
        self.authorization = {key: values[0] for key, values in parse_qs(target.query).items()}
        assert self.authorization["state"] and self.authorization["nonce"]
        return dict(self.authorization)

    def finish(self, authorization=None, **params):
        authorization = authorization or self.authorization
        return self.client.get(
            authorization["redirect_uri"],
            params={"code": "isolated-fixture-code", "state": authorization["state"], **params},
            follow_redirects=False,
        )

    async def fetch_access_token(self, **kwargs):
        self.token_fetches += 1
        now = int(time())
        claims = {
            "iss": ISSUER, "sub": "isolated-first-login-subject", "aud": self.google.client_id,
            "iat": now, "exp": now + 300, "nonce": self.authorization["nonce"],
            "email": EMAIL, "email_verified": True, "name": "First Login Fixture",
            **self.claim_overrides,
        }
        token = jwt.encode({"alg": "RS256", "kid": "isolated-fixture-key"}, claims, self.key)
        return {"id_token": token.decode(), "access_token": "isolated-fixture-access-token"}


@pytest.fixture
def google_flow(api, engine, monkeypatch):
    settings = replace(
        api.app.state.settings, app_url=ORIGIN,
        google_client_id="isolated-fixture-client", google_client_secret="isolated-fixture-secret",
    )
    app = create_app(settings, engine)
    google = app.state.oauth.create_client("google")
    google.server_metadata.update({
        "_loaded_at": time(), "issuer": ISSUER,
        "authorization_endpoint": ISSUER + "/o/oauth2/v2/auth",
        "token_endpoint": "https://oauth2.googleapis.com/token",
        "id_token_signing_alg_values_supported": ["RS256"],
    })
    key = JsonWebKey.generate_key("RSA", 2048, {"kid": "isolated-fixture-key"}, is_private=True)

    async def fetch_jwk_set(**kwargs):
        return {"keys": [key.as_dict(is_private=False)]}

    monkeypatch.setattr(google, "fetch_jwk_set", fetch_jwk_set)
    with TestClient(app, base_url=ORIGIN, headers={"Origin": ORIGIN}) as client:
        flow = GoogleFlow(client, google, key)
        monkeypatch.setattr(google, "fetch_access_token", flow.fetch_access_token)
        yield flow


def assert_signed_in(flow, api, email=EMAIL):
    session = flow.client.get("/api/session").json()
    assert session["member"]["email"] == email
    assert session["officer"] is False
    assert session["profile_complete"] is False
    assert flow.client.get("/api/admin/overview").status_code == 403
    with api.app.state.sessions() as db:
        user = db.scalar(select(Member).where(Member.email == email))
        assert db.scalar(select(func.count()).select_from(Identity)) == 1
        assert db.scalar(select(Identity.member_id)) == user.id
        assert db.get(Officer, user.id) is None
    return session["member"]["id"]


def assert_rejected(flow, api, response, error="oauth", email=EMAIL):
    assert response.status_code == 303
    assert response.headers["location"] == "/sign-in?error=" + error
    assert flow.client.get("/api/session").json()["member"] is None
    with api.app.state.sessions() as db:
        assert db.scalar(select(Member.id).where(Member.email == email)) is None
        assert db.scalar(select(func.count()).select_from(Identity)) == 0


def test_new_identity_commits_on_first_callback_and_reuses_member_on_retry(google_flow, api):
    google_flow.begin()
    response = google_flow.finish()
    assert response.status_code == 303
    assert response.headers["location"] == "/my-aac/profile"
    member_id = assert_signed_in(google_flow, api)
    assert google_flow.client.post("/api/auth/logout").status_code == 200
    google_flow.begin()
    assert google_flow.finish().headers["location"] == "/my-aac/profile"
    assert assert_signed_in(google_flow, api) == member_id


@pytest.mark.parametrize("read_path, status", [("/api/session", 200), ("/api/me/profile", 401)])
@pytest.mark.parametrize("mode, email", [("uci", EMAIL), ("non_uci", NON_UCI_EMAIL)])
def test_other_tab_read_during_first_login_preserves_state(google_flow, api, read_path, status, mode, email):
    google_flow.begin(mode=mode)
    google_flow.claim_overrides = {"email": email}
    # The same cookie jar models a second tab on the same host during Google consent.
    read = google_flow.client.get(read_path)
    assert read.status_code == status
    if read_path == "/api/session":
        assert read.json()["member"] is None
    response = google_flow.finish()
    assert response.headers["location"] == "/my-aac/profile"
    assert_signed_in(google_flow, api, email)


def expired_officer_cookie(flow):
    payload = base64.b64encode(json.dumps({"member_id": 1, "login_at": int(time()) - 28801}).encode())
    cookie = TimestampSigner(SECRET).sign(payload).decode()
    flow.client.cookies.set("aac_session", cookie, domain=urlsplit(ORIGIN).hostname, path="/")


@pytest.mark.parametrize("read_path, status", [("/api/session", 200), ("/api/me/profile", 401)])
@pytest.mark.parametrize("mode, email", [("uci", EMAIL), ("non_uci", NON_UCI_EMAIL)])
def test_expired_member_is_denied_without_losing_new_oauth_state(google_flow, api, read_path, status, mode, email):
    expired_officer_cookie(google_flow)
    google_flow.begin(mode=mode)
    google_flow.claim_overrides = {"email": email}
    read = google_flow.client.get(read_path)
    assert read.status_code == status
    assert google_flow.client.get("/api/session").json()["member"] is None
    assert google_flow.client.get("/api/admin/overview").status_code == 401
    assert google_flow.finish().headers["location"] == "/my-aac/profile"
    assert_signed_in(google_flow, api, email)


def test_expired_login_without_oauth_removes_authentication_cookie(google_flow):
    expired_officer_cookie(google_flow)
    assert google_flow.client.get("/api/me/profile").status_code == 401
    assert not list(google_flow.client.cookies.jar)
    assert google_flow.client.get("/api/session").json()["member"] is None


def test_existing_officer_first_login_preserves_role(google_flow):
    google_flow.begin()
    google_flow.claim_overrides = {"email": "officer@uci.edu"}
    assert google_flow.finish().headers["location"] == "/my-aac/profile"
    session = google_flow.client.get("/api/session").json()
    assert session["member"]["id"] == 1
    assert session["officer"] is True
    assert google_flow.client.get("/api/admin/overview").status_code == 200


def test_wrong_state_is_rejected_before_token_exchange(google_flow, api):
    google_flow.begin()
    response = google_flow.finish(state="unrelated-fixture-state")
    assert_rejected(google_flow, api, response)
    assert google_flow.token_fetches == 0


@pytest.mark.parametrize("mode", ["uci", "non_uci"])
def test_logout_during_pending_login_clears_oauth_state(google_flow, api, mode):
    google_flow.begin(mode=mode)
    assert google_flow.client.post("/api/auth/logout").status_code == 200
    assert_rejected(google_flow, api, google_flow.finish())
    assert google_flow.token_fetches == 0


@pytest.mark.parametrize("claims, error", [
    ({"nonce": "unrelated-fixture-nonce"}, "oauth"),
    ({"iss": "https://untrusted.test"}, "oauth"),
    ({"aud": "unrelated-fixture-client"}, "oauth"),
    ({"email_verified": False}, "uci"),
    ({"email": "first-login-fixture@example.test"}, "uci"),
])
def test_invalid_identity_is_rejected(google_flow, api, claims, error):
    google_flow.begin()
    google_flow.claim_overrides = claims
    assert_rejected(google_flow, api, google_flow.finish(), error)


def test_superseded_login_state_still_requires_fresh_attempt(google_flow, api):
    older = google_flow.begin()
    google_flow.begin()
    assert_rejected(google_flow, api, google_flow.finish(older))
    assert google_flow.token_fetches == 0
    google_flow.begin()
    assert google_flow.finish().headers["location"] == "/my-aac/profile"
    assert_signed_in(google_flow, api)


@pytest.mark.parametrize("mode", ["uci", "non_uci"])
def test_consumed_callback_state_cannot_be_reused(google_flow, api, mode):
    authorization = google_flow.begin(mode=mode)
    assert google_flow.finish().headers["location"] == "/my-aac/profile"
    assert google_flow.token_fetches == 1
    replay = google_flow.finish(authorization)
    assert replay.headers["location"] == "/sign-in?error=oauth"
    assert google_flow.token_fetches == 1
    with api.app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(Identity)) == 1


@pytest.mark.parametrize("origin", [ORIGIN, "https://public.test"])
def test_non_uci_requires_explicit_choice_and_reuses_existing_identity(google_flow, api, origin):
    authorization = google_flow.begin(origin, mode="non_uci")
    assert "hd" not in authorization
    assert authorization["prompt"] == "select_account"
    google_flow.claim_overrides = {"email": NON_UCI_EMAIL}
    assert google_flow.finish().headers["location"] == "/my-aac/profile"
    member_id = assert_signed_in(google_flow, api, NON_UCI_EMAIL)
    google_flow.client.post("/api/auth/logout")
    google_flow.begin(mode="non_uci")
    assert google_flow.finish().headers["location"] == "/my-aac/profile"
    assert assert_signed_in(google_flow, api, NON_UCI_EMAIL) == member_id
    google_flow.client.post("/api/auth/logout")
    google_flow.begin()
    # Even a returning non-UCI member must choose the exception on each attempt.
    assert google_flow.finish().headers["location"] == "/sign-in?error=uci"
    assert google_flow.client.get("/api/session").json()["member"] is None


@pytest.mark.parametrize("callback_flags", [{}, {"mode": "non_uci", "allow_non_uci": "true"}])
def test_default_login_rejects_gmail_even_with_callback_flags(google_flow, api, callback_flags):
    authorization = google_flow.begin()
    assert authorization["hd"] == "uci.edu"
    assert authorization["prompt"] == "select_account"
    google_flow.claim_overrides = {"email": NON_UCI_EMAIL}
    assert_rejected(google_flow, api, google_flow.finish(**callback_flags), "uci", NON_UCI_EMAIL)


@pytest.mark.parametrize("email", ["student@uci.edu", "student@law.uci.edu"])
def test_uci_and_subdomain_accounts_still_sign_in_by_default(google_flow, api, email):
    google_flow.begin()
    google_flow.claim_overrides = {"email": email}
    assert google_flow.finish().headers["location"] == "/my-aac/profile"
    assert_signed_in(google_flow, api, email)


@pytest.mark.parametrize("finish_older", [False, True])
def test_new_uci_attempt_cannot_reuse_non_uci_choice(google_flow, api, finish_older):
    older = google_flow.begin(mode="non_uci")
    google_flow.begin()
    google_flow.claim_overrides = {"email": NON_UCI_EMAIL}
    response = google_flow.finish(older if finish_older else None)
    assert_rejected(google_flow, api, response, "oauth" if finish_older else "uci", NON_UCI_EMAIL)
    assert google_flow.token_fetches == (0 if finish_older else 1)


@pytest.mark.parametrize("claims, error", [
    ({"nonce": "unrelated-fixture-nonce"}, "oauth"),
    ({"iss": "https://untrusted.test"}, "oauth"),
    ({"aud": "unrelated-fixture-client"}, "oauth"),
    ({"email_verified": False}, "google"),
    ({"email": None}, "google"),
    ({"email": "missing-domain@"}, "google"),
    ({"sub": ""}, "google"),
])
def test_non_uci_still_requires_valid_google_identity(google_flow, api, claims, error):
    google_flow.begin(mode="non_uci")
    google_flow.claim_overrides = {"email": NON_UCI_EMAIL, **claims}
    assert_rejected(google_flow, api, google_flow.finish(), error, NON_UCI_EMAIL)


def test_unknown_login_mode_is_rejected_before_google_redirect(google_flow):
    response = google_flow.client.get("/api/auth/login?mode=anything", follow_redirects=False)
    assert response.status_code == 422
    assert not list(google_flow.client.cookies.jar)


def test_non_uci_links_existing_member_and_can_edit_profile_without_officer_access(google_flow, api):
    existing = api.post("/api/admin/members", json={
        "name": "Existing Member", "email": NON_UCI_EMAIL, "phone": "9495550100",
    })
    assert existing.status_code == 201
    member_id = existing.json()["id"]
    google_flow.begin(mode="non_uci")
    google_flow.claim_overrides = {"email": NON_UCI_EMAIL}
    assert google_flow.finish().headers["location"] == "/my-aac/profile"
    session = google_flow.client.get("/api/session").json()
    assert session["member"]["id"] == member_id
    assert session["member"]["name"] == "Existing Member"
    assert session["member"]["phone"] == "9495550100"
    assert session["profile_complete"] is True
    updated = google_flow.client.put("/api/me/profile", json={
        "name": "Updated Member", "phone": "9495550101", "discord": "returning-member",
    })
    assert updated.status_code == 200
    assert updated.json()["id"] == member_id
    assert updated.json()["email"] == NON_UCI_EMAIL
    assert google_flow.client.get("/api/admin/overview").status_code == 403
    grant = api.post("/api/admin/officers", json={"member_id": member_id})
    assert grant.status_code == 422
    assert grant.json()["detail"]["code"] == "uci_required"
    assert google_flow.client.get("/api/session").json()["officer"] is False
    with api.app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(Member).where(Member.email == NON_UCI_EMAIL)) == 1
        assert db.scalar(select(Identity.member_id)) == member_id
