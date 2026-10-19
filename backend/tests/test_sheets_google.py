import json

import httpx
import pytest
from cryptography.fernet import Fernet

from app.config import Settings
from app.services.sheets_google import DRIVE, GoogleFailure, GoogleSheetsClient


def client(handler):
    key = Fernet.generate_key()
    settings = Settings(sheets_client_id="client", sheets_client_secret="secret", sheets_token_key=key.decode())
    return GoogleSheetsClient(settings, Fernet(key).encrypt(b"refresh").decode(), transport=httpx.MockTransport(handler))


def token_response():
    return httpx.Response(200, json={"access_token": "access", "expires_in": 3600})


@pytest.mark.parametrize(("status", "payload", "permanent", "reconnect", "uncertain"), [
    (429, {}, False, False, True), (503, {}, False, False, True),
    (403, {"error": {"errors": [{"reason": "userRateLimitExceeded"}]}}, False, False, False),
    (403, {}, True, False, False), (404, {}, True, False, False),
    (401, {}, False, True, False),
])
def test_google_errors_have_safe_recovery_classification(status, payload, permanent, reconnect, uncertain):
    def handler(request):
        if request.url.host == "oauth2.googleapis.com":
            return token_response()
        return httpx.Response(status, json={**payload, "private": "participant and credential detail"})
    google = client(handler)
    try:
        with pytest.raises(GoogleFailure) as caught:
            google.find_file("provision-marker")
        assert caught.value.permanent == permanent
        assert caught.value.reconnect == reconnect
        assert caught.value.uncertain == uncertain
        assert "participant" not in str(caught.value)
    finally:
        google.close()


def test_refresh_and_401_retry_only_once():
    tokens, reads = [], []
    def handler(request):
        if request.url.host == "oauth2.googleapis.com":
            tokens.append(request)
            return token_response()
        reads.append(request)
        assert request.headers["Authorization"] == "Bearer access"
        return httpx.Response(401 if len(reads) == 1 else 200, json={"files": [{"id": "file"}]})
    google = client(handler)
    try:
        assert google.find_file("unique") == "file"
        assert len(tokens) == len(reads) == 2
        assert b"refresh_token=refresh" in tokens[0].content
    finally:
        google.close()


def test_revoked_refresh_token_requires_reconnection():
    google = client(lambda request: httpx.Response(400, json={"error": "invalid_grant"}))
    try:
        with pytest.raises(GoogleFailure) as caught:
            google.find_file("unique")
        assert caught.value.reconnect
    finally:
        google.close()


def test_file_creation_marker_and_sharing_do_not_send_email():
    requests = []
    def handler(request):
        if request.url.host == "oauth2.googleapis.com":
            return token_response()
        requests.append(request)
        return httpx.Response(200, json={"id": "generated"})
    google = client(handler)
    try:
        assert google.create_file("Event", "unique") == "generated"
        assert google.share("file", "officer@example.com") == "generated"
        assert json.loads(requests[0].content) == {
            "name": "Event", "mimeType": "application/vnd.google-apps.spreadsheet",
            "appProperties": {"aac_provision": "unique"}, "writersCanShare": False,
        }
        assert requests[1].url.params["sendNotificationEmail"] == "false"
        assert json.loads(requests[1].content)["role"] == "writer"
    finally:
        google.close()


def test_missing_file_cleanup_is_idempotent():
    google = client(lambda request: token_response() if request.url.host == "oauth2.googleapis.com"
                    else httpx.Response(404))
    try:
        google.unshare("deleted-file", "permission")
        assert google.permissions("deleted-file", missing_ok=True) == []
    finally:
        google.close()


def test_snapshot_batches_literal_values_and_only_mutates_managed_tab():
    batches = []
    def handler(request):
        if request.url.host == "oauth2.googleapis.com":
            return token_response()
        if request.method == "GET":
            return httpx.Response(200, json={"sheets": [
                {"properties": {"sheetId": 42, "title": "Signups", "gridProperties": {"rowCount": 100, "columnCount": 26}}},
                {"properties": {"sheetId": 0, "title": "Notes"}},
            ]})
        assert len(request.content) < 2_000_000
        batches.append(json.loads(request.content)["requests"])
        return httpx.Response(200, json={})
    google = client(handler)
    rows = [[str(i), "=IMPORTXML(\"url\")", "Hiking\nPicnic, games", "x" * 2000] for i in range(1500)]
    try:
        google.write_snapshot("file", 42, [{"key": "name", "header": "Name"},
                                          {"key": "question:q", "header": "Plans"},
                                          {"key": "notes", "header": "Notes"}], rows)
        assert len(batches) >= 3
        updates = []
        clear_count = 0
        for batch in batches:
            for operation in batch:
                data = next(iter(operation.values()))
                position = data.get("range", data.get("start", data.get("properties")))
                assert position["sheetId"] == 42
                if "updateCells" in operation:
                    if "rows" in data:
                        updates.extend(data["rows"])
                    else:
                        clear_count += 1
        assert clear_count == 1
        values = [[cell["userEnteredValue"]["stringValue"] for cell in row["values"]] for row in updates]
        assert values == [["_signup_id", "Name", "Plans", "Notes"]] + rows
        assert "formulaValue" not in json.dumps(batches)
    finally:
        google.close()


def test_duplicate_provision_markers_stop_creation():
    google = client(lambda request: token_response() if request.url.host == "oauth2.googleapis.com"
                    else httpx.Response(200, json={"files": [{"id": "one"}, {"id": "two"}]}))
    try:
        with pytest.raises(GoogleFailure, match="Multiple files") as caught:
            google.find_file("unique")
        assert caught.value.permanent
    finally:
        google.close()


def test_network_error_on_write_is_uncertain():
    def handler(request):
        if request.url.host == "oauth2.googleapis.com":
            return token_response()
        raise httpx.ReadTimeout("payload includes a secret", request=request)
    google = client(handler)
    try:
        with pytest.raises(GoogleFailure) as caught:
            google.request("POST", DRIVE + "/files", json={})
        assert caught.value.uncertain
        assert "secret" not in str(caught.value)
    finally:
        google.close()
