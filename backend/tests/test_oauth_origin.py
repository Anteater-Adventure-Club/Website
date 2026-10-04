"""OAuth state must be created on the configured callback origin."""
from dataclasses import replace
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.responses import RedirectResponse
from app.models import Member


class GoogleStub:
    def __init__(self, email="officer@uci.edu"):
        self.email = email
        self.initiations = 0

    async def authorize_redirect(self, request, redirect_uri):
        self.initiations += 1
        request.session["oauth_state"] = "test-state"
        return RedirectResponse("https://accounts.google.com/test", status_code=302)

    async def authorize_access_token(self, request):
        if request.session.get("oauth_state") != "test-state":
            raise ValueError("Missing OAuth state")
        return {"userinfo": {"email": self.email, "email_verified": True,
                            "sub": "test-subject", "iss": "https://accounts.google.com"}}


def configure(api, google):
    # Use HTTP for TestClient's session middleware, configured by the fixture.
    api.app.state.settings = replace(api.app.state.settings, app_url="http://internal.test")
    api.app.state.oauth.create_client = lambda name: google
    api.cookies.clear()


def test_public_login_moves_to_callback_origin_before_creating_state(api):
    google = GoogleStub()
    configure(api, google)
    result = api.get("http://public.test/api/auth/login?return_to=%2Fofficer%3Ftab%3Dmembers", follow_redirects=False)
    assert result.status_code == 303
    location = urlsplit(result.headers["location"])
    assert location.netloc == "internal.test"
    assert parse_qs(location.query)["return_to"] == ["/officer?tab=members"]
    assert google.initiations == 0
    assert "set-cookie" not in result.headers
    initiated = api.get(result.headers["location"], follow_redirects=False)
    assert initiated.status_code == 302
    assert google.initiations == 1
    assert api.cookies.get("aac_session", domain="internal.test")
    assert not any(cookie.domain == "public.test" for cookie in api.cookies.jar)
    completed = api.get("http://internal.test/api/auth/callback", follow_redirects=False)
    assert completed.status_code == 303
    assert completed.headers["location"] == "/officer?tab=members"
    session = api.get("http://internal.test/api/session").json()
    assert session["member"]["email"] == "officer@uci.edu"
    assert session["officer"] is True


@pytest.mark.parametrize("return_to", ["//evil.test", "https://evil.test", "/\\evil.test"])
def test_canonical_redirect_sanitizes_return_path(api, return_to):
    google = GoogleStub()
    configure(api, google)
    response = api.get("http://public.test/api/auth/login", params={"return_to": return_to}, follow_redirects=False)
    assert parse_qs(urlsplit(response.headers["location"]).query)["return_to"] == ["/my-aac"]


def test_existing_nonofficer_can_sign_in_without_receiving_officer_role(api):
    with api.app.state.sessions() as db:
        db.add(Member(email="member@uci.edu", name="Member"))
        db.commit()
    configure(api, GoogleStub("member@uci.edu"))
    api.get("http://internal.test/api/auth/login", follow_redirects=False)
    response = api.get("http://internal.test/api/auth/callback", follow_redirects=False)
    assert response.status_code == 303
    assert api.get("http://internal.test/api/session").json()["officer"] is False
    assert api.get("http://internal.test/api/admin/overview").status_code == 403


def test_public_canonical_origin_preserves_mutation_origin_checks(api, engine):
    from fastapi.testclient import TestClient
    from app.main import create_app

    settings = replace(api.app.state.settings, app_url="http://public.test")
    app = create_app(settings, engine)
    app.state.oauth.create_client = lambda name: GoogleStub()
    with TestClient(app) as client:
        response = client.get("http://internal.test/api/auth/login", follow_redirects=False)
        assert urlsplit(response.headers["location"]).netloc == "public.test"
        client.get(response.headers["location"], follow_redirects=False)
        client.get("http://public.test/api/auth/callback", follow_redirects=False)
        rejected = client.post("http://public.test/api/auth/logout", headers={"Origin": "http://internal.test"})
        assert rejected.status_code == 403
        assert rejected.json()["detail"]["code"] == "origin_rejected"
        accepted = client.post("http://public.test/api/auth/logout", headers={"Origin": "http://public.test"})
        assert accepted.status_code == 200
