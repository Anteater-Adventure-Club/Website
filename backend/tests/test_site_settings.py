import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from conftest import SECRET


@pytest.mark.parametrize("name", ["", "  Gabe Dodge  ", "Another recipient"])
def test_public_zelle_settings_follow_runtime_environment(engine, monkeypatch, name):
    monkeypatch.setenv("DUES_ZELLE_CONTACT", "fixture@uci.edu")
    monkeypatch.setenv("DUES_ZELLE_NAME", name)
    settings = Settings(app_url="http://testserver", session_secret=SECRET, initial_officers="")
    with TestClient(create_app(settings, engine)) as client:
        response = client.get("/api/site-settings")
    assert response.status_code == 200
    assert response.json()["zelle"] == "fixture@uci.edu"
    assert response.json()["zelle_name"] == name.strip()


def test_unconfigured_zelle_name_defaults_to_empty(monkeypatch):
    monkeypatch.delenv("DUES_ZELLE_NAME", raising=False)
    assert Settings().zelle_name == ""
