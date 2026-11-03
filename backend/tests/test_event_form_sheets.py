from datetime import timedelta
from sqlalchemy import select

from app.domain import utcnow
from app.models import EventForm, EventFormSheet, EventSheet, Signup
from app.services.sheets_worker import claim, process_job
from app.services.sheets_export import form_column_catalog, form_rows
from test_google_sheets import FakeGoogle, configure, due, sheets, target  # noqa: F401
from test_event_forms import setup, url, respond, edit
from conftest import cookie, signup, person


class FormGoogle(FakeGoogle):
    def __init__(self):
        super().__init__()
        self.tabs = {}
        self.form_snapshots = {}

    def ensure_form_tab(self, file_id, sheet_id, title, owner):
        self.guard()
        self.tabs[(file_id, sheet_id)] = title

    def write_snapshot(self, file_id, sheet_id, columns, rows):
        super().write_snapshot(file_id, sheet_id, columns, rows)
        self.form_snapshots[(file_id, sheet_id)] = {"columns": columns, "rows": rows}


def enable(api, e, f):
    endpoint = url(e, f, True) + "/google-sheet"
    view = api.get(endpoint).json()
    result = api.put(endpoint, json={"columns": view["columns"], "expected_revision": view["revision"]})
    assert result.status_code == 200, result.text
    return result.json()


def sync(api, google):
    due(api)
    job = claim(api.app.state.sessions)
    assert job
    process_job(api.app.state.sessions, api.app.state.settings, job, client_factory=google)


def test_form_tabs_response_updates_and_pause(sheets):  # noqa: F811 — imported pytest fixture
    api = sheets
    e, m, s, f = setup(api)
    configure(api, e)
    config = enable(api, e, f)
    google = FormGoogle()
    sync(api, google)
    assert len(google.tabs) == 1
    assert len(google.form_snapshots) == 2  # existing Signups plus form
    tab_id = next(iter(google.tabs))
    assert "Awaiting response" in google.form_snapshots[tab_id]["rows"][0]
    api.cookies.set("aac_session", cookie(m["id"]))
    assert respond(api, e, f).status_code == 200
    api.cookies.set("aac_session", cookie(1))
    queued = target(api, e)
    assert queued.requested > queued.completed
    sync(api, google)
    assert "Responded" in google.form_snapshots[tab_id]["rows"][0]
    endpoint = url(e, f, True) + "/google-sheet"
    assert api.put(endpoint, json={"columns": config["columns"], "enabled": False,
                                   "expected_revision": config["revision"]}).status_code == 200
    before = google.form_snapshots[tab_id]
    api.delete(f"/api/admin/signups/{s['id']}")
    sync(api, google)
    assert google.form_snapshots[tab_id] == before
    config = api.get(endpoint).json()
    assert api.put(endpoint, json={"columns": config["columns"], "enabled": True,
                                   "expected_revision": config["revision"]}).status_code == 200
    sync(api, google)
    assert "Cancelled" in google.form_snapshots[tab_id]["rows"][0]
    assert len(google.tabs) == 1


def test_deadline_transition_enqueues_without_new_response(sheets):  # noqa: F811 — imported pytest fixture
    api = sheets
    e, m, s, f = setup(api)
    configure(api, e)
    enable(api, e, f)
    google = FormGoogle()
    sync(api, google)
    with api.app.state.sessions.begin() as db:
        form = db.get(EventForm, f["id"])
        form.closes_at = utcnow() + timedelta(hours=1)
    sync(api, google)
    # Move the recorded deadline in SQL without the application hooks, simulating time passing.
    with api.app.state.sessions.begin() as db:
        past = utcnow() - timedelta(seconds=1)
        db.execute(EventForm.__table__.update().where(EventForm.id == f["id"]).values(closes_at=past))
        db.execute(EventSheet.__table__.update().values(next_form_transition_at=past))
        db.get(Signup, s["id"]).registered_at = utcnow() - timedelta(days=1)
    # The signup timestamp update also queued a change; mark it completed so only the clock can trigger a job.
    with api.app.state.sessions.begin() as db:
        db.execute(EventSheet.__table__.update().values(completed=EventSheet.requested, due_at=None))
    job = claim(api.app.state.sessions)
    assert job
    process_job(api.app.state.sessions, api.app.state.settings, job, client_factory=google)
    assert "No Response" in google.form_snapshots[next(iter(google.tabs))]["rows"][0]
    with api.app.state.sessions() as db:
        assert db.scalar(select(EventSheet)).next_form_transition_at is None


def test_columns_exemptions_and_metadata_changes(sheets):  # noqa: F811 — imported pytest fixture
    api = sheets
    e, m, s, f = setup(api, closes_at=(utcnow() - timedelta(minutes=5)).isoformat())
    configure(api, e)
    config = enable(api, e, f)
    with api.app.state.sessions() as db:
        form = db.get(EventForm, f["id"])
        assert "Not required" in list(form_rows(db, form, form_column_catalog(form)))[0]
    endpoint = url(e, f, True) + "/google-sheet"
    assert api.put(endpoint, json={"expected_revision": config["revision"], "columns": [
        c for c in config["columns"] if c["key"] != "response_status"
    ]}).status_code == 422
    assert edit(api, e, f, questions=[f["questions"][0]]).status_code == 200
    with api.app.state.sessions() as db:
        assert not any(c["key"] == "question:gear" for c in db.get(EventFormSheet, f["id"]).columns)
    s2 = signup(api, e, person(api, 2))
    api.delete(f"/api/admin/signups/{s2['id']}")
    google = FormGoogle()
    sync(api, google)
    assert len(google.form_snapshots[next(iter(google.tabs))]["rows"]) == 2
