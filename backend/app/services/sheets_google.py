"""Small Google REST adapter. All user-provided cell values are literal strings."""
import json
import time
import httpx
from cryptography.fernet import Fernet, InvalidToken

DRIVE = "https://www.googleapis.com/drive/v3"
SHEETS = "https://sheets.googleapis.com/v4/spreadsheets"


class GoogleFailure(Exception):
    def __init__(self, message, *, permanent=False, reconnect=False, uncertain=False):
        super().__init__(message)
        self.permanent, self.reconnect, self.uncertain = permanent, reconnect, uncertain


class GoogleSheetsClient:
    def __init__(self, settings, encrypted_token, guard=lambda: None, *, transport=None, throttle=None):
        self.settings, self.guard = settings, guard
        self.http = httpx.Client(timeout=20, transport=transport)
        self.throttle = throttle or (lambda: None)
        self.access_token, self.expires_at = None, 0
        try:
            self.refresh_token = Fernet(settings.sheets_token_key.encode()).decrypt(encrypted_token.encode()).decode()
        except (InvalidToken, ValueError):
            self.http.close()
            raise GoogleFailure("The Google credential could not be decrypted. Reconnect the club account.", reconnect=True)

    def close(self):
        self.http.close()

    def refresh(self):
        self.guard()
        try:
            response = self.http.post("https://oauth2.googleapis.com/token", data={
                "client_id": self.settings.sheets_client_id, "client_secret": self.settings.sheets_client_secret,
                "refresh_token": self.refresh_token, "grant_type": "refresh_token",
            })
        except httpx.TransportError:
            raise GoogleFailure("Google could not be reached. Updates will retry automatically.") from None
        if response.status_code in (400, 401, 403):
            raise GoogleFailure("Google access expired or was revoked. Reconnect the club account.", reconnect=True)
        if response.status_code != 200:
            raise GoogleFailure("Google authorization is temporarily unavailable. Updates will retry automatically.")
        token = response.json()
        self.access_token = token["access_token"]
        self.expires_at = time.monotonic() + int(token.get("expires_in", 3600)) - 60

    def request(self, method, url, *, missing_ok=False, **kwargs):
        for attempt in range(2):
            self.guard()
            if not self.access_token or time.monotonic() >= self.expires_at:
                self.refresh()
            self.throttle()
            self.guard()
            try:
                response = self.http.request(method, url, headers={"Authorization": "Bearer " + self.access_token}, **kwargs)
            except httpx.TransportError:
                raise GoogleFailure("Google could not be reached. Updates will retry automatically.", uncertain=True) from None
            if response.status_code == 401 and attempt == 0:
                self.access_token = None
                continue
            if response.status_code == 404 and missing_ok:
                return None
            if response.status_code in (429, 500, 502, 503, 504):
                raise GoogleFailure("Google is busy or unavailable. Updates will retry automatically.", uncertain=True)
            if response.status_code == 401:
                raise GoogleFailure("Reconnect the club Google account to resume updates.", reconnect=True)
            if response.status_code == 403:
                # Google sometimes reports quota errors as 403 instead of 429.
                try:
                    reasons = [e.get("reason") for e in response.json().get("error", {}).get("errors", [])]
                except (ValueError, AttributeError):
                    reasons = []
                if any(r in {"rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded"} for r in reasons):
                    raise GoogleFailure("Google’s request limit was reached. Updates will retry automatically.")
                raise GoogleFailure("Google denied access. Check the club account’s file and sharing permissions, then sync again.",
                                    permanent=True)
            if response.status_code == 404:
                raise GoogleFailure("The spreadsheet is missing or inaccessible. Restore it in Google Drive, then sync again.",
                                    permanent=True)
            if response.is_error:
                raise GoogleFailure("Google rejected the spreadsheet update. Check its structure and permissions, then sync again.",
                                    permanent=True)
            return response.json() if response.content else {}

    def find_file(self, key):
        result = self.request("GET", DRIVE + "/files", params={
            "q": "trashed = false and appProperties has { key='aac_provision' and value='" + key + "' }",
            "fields": "files(id)", "pageSize": 100,
        })
        files = result.get("files", [])
        if len(files) > 1:
            raise GoogleFailure("Multiple files match this integration. Ask an administrator to resolve them.", permanent=True)
        return files[0]["id"] if files else None

    def create_file(self, title, key):
        return self.request("POST", DRIVE + "/files", params={"fields": "id"}, json={
            "name": title, "mimeType": "application/vnd.google-apps.spreadsheet",
            "appProperties": {"aac_provision": key}, "writersCanShare": False,
        })["id"]

    def metadata(self, file_id):
        return self.request("GET", f"{SHEETS}/{file_id}", params={
            "fields": "sheets(properties,protectedRanges(protectedRangeId,description))",
        })

    def batch(self, file_id, requests):
        return self.request("POST", f"{SHEETS}/{file_id}:batchUpdate", json={"requests": requests})

    def ensure_tabs(self, file_id, sheet_id, owner):
        sheets = self.metadata(file_id).get("sheets", [])
        managed = next((s for s in sheets if s["properties"]["sheetId"] == sheet_id), None)
        operations = []
        if not managed:
            if any(s["properties"]["title"] == "Signups" for s in sheets):
                raise GoogleFailure("A different tab is named Signups. Rename it before syncing again.", permanent=True)
            operations.append({"addSheet": {"properties": {"sheetId": sheet_id, "title": "Signups"}}})
        if not any(s["properties"]["title"] == "Notes" for s in sheets):
            blank = next((s for s in sheets if s["properties"]["title"] == "Sheet1"), None)
            if blank:
                operations.append({"updateSheetProperties": {
                    "properties": {"sheetId": blank["properties"]["sheetId"], "title": "Notes"}, "fields": "title",
                }})
            else:
                operations.append({"addSheet": {"properties": {"title": "Notes"}}})
        if not managed or not any(p.get("description") == "AAC managed signup data"
                                  for p in managed.get("protectedRanges", [])):
            operations.append({"addProtectedRange": {"protectedRange": {
                "range": {"sheetId": sheet_id}, "description": "AAC managed signup data",
                "warningOnly": False, "editors": {"users": [owner]},
            }}})
        if operations:
            self.batch(file_id, operations)

    def permissions(self, file_id, *, missing_ok=False):
        result, token = [], None
        while True:
            params = {"fields": "nextPageToken,permissions(id,emailAddress,role,type)", "pageSize": 100}
            if token:
                params["pageToken"] = token
            page = self.request("GET", f"{DRIVE}/files/{file_id}/permissions", params=params, missing_ok=missing_ok)
            if page is None:
                return []
            result.extend(page.get("permissions", []))
            token = page.get("nextPageToken")
            if not token:
                return result

    def share(self, file_id, email):
        return self.request("POST", f"{DRIVE}/files/{file_id}/permissions",
                            params={"sendNotificationEmail": "false", "fields": "id"},
                            json={"type": "user", "role": "writer", "emailAddress": email})["id"]

    def unshare(self, file_id, permission_id):
        self.request("DELETE", f"{DRIVE}/files/{file_id}/permissions/{permission_id}", missing_ok=True)

    def set_writer(self, file_id, permission_id):
        self.request("PATCH", f"{DRIVE}/files/{file_id}/permissions/{permission_id}", json={"role": "writer"})

    def write_snapshot(self, file_id, sheet_id, columns, rows):
        sheets = self.metadata(file_id).get("sheets", [])
        managed = next((s for s in sheets if s["properties"]["sheetId"] == sheet_id), None)
        if not managed:
            raise GoogleFailure("The Signups tab was deleted. Restore it in Google Sheets before syncing again.", permanent=True)
        grid = managed["properties"]["gridProperties"]
        values = [["_signup_id"] + [c["header"] for c in columns]] + rows
        row_count, col_count = max(grid["rowCount"], len(values)), max(grid["columnCount"], len(columns) + 1)
        setup = [
            {"updateSheetProperties": {"properties": {"sheetId": sheet_id, "gridProperties": {
                "rowCount": row_count, "columnCount": col_count, "frozenRowCount": 1,
            }}, "fields": "gridProperties"}},
            {"updateCells": {"range": {"sheetId": sheet_id}, "fields": "userEnteredValue"}},
            {"updateDimensionProperties": {"range": {"sheetId": sheet_id, "dimension": "COLUMNS",
                                                      "startIndex": 0, "endIndex": 1},
                                            "properties": {"hiddenByUser": True}, "fields": "hiddenByUser"}},
            {"repeatCell": {"range": {"sheetId": sheet_id}, "cell": {"userEnteredFormat": {
                "wrapStrategy": "WRAP", "verticalAlignment": "TOP", "numberFormat": {"type": "TEXT"},
            }}, "fields": "userEnteredFormat"}},
            {"repeatCell": {"range": {"sheetId": sheet_id, "startRowIndex": 0, "endRowIndex": 1},
                            "cell": {"userEnteredFormat": {"textFormat": {"bold": True}}},
                            "fields": "userEnteredFormat.textFormat"}},
        ]
        batches, batch, size, offset = [], [], 0, 0
        for row in values:
            cells = {"values": [{"userEnteredValue": {"stringValue": value}} for value in row]}
            length = len(json.dumps(cells, ensure_ascii=False).encode())
            if batch and size + length > 1_500_000:
                batches.append((offset, batch))
                offset += len(batch)
                batch, size = [], 0
            batch.append(cells)
            size += length
        if batch:
            batches.append((offset, batch))
        for index, (offset, batch) in enumerate(batches):
            update = {"updateCells": {"start": {"sheetId": sheet_id, "rowIndex": offset, "columnIndex": 0},
                                      "rows": batch, "fields": "userEnteredValue"}}
            self.batch(file_id, (setup if index == 0 else []) + [update])
