import json
from datetime import timedelta

import pytest
from sqlalchemy import select

from app.domain import utcnow
from app.models import Event, Membership, Signup
from app.schemas import EventWrite, SignupWrite
from app.services.event_activity import logger
from app.services.participation import save_signup
from conftest import cookie, event, person, quarter
from test_signup_capacity import edit_caps


def reserve(api, e, m, **body):
    return api.put(f"/api/events/{e['id']}/signup", json={"role": "ride", **body},
                   headers={"Cookie": f"aac_session={cookie(m['id'])}"})


def test_scheduled_opening_paid_access_and_membership_pause(api, monkeypatch):
    now = utcnow()
    q = quarter(api)
    assert api.put(f"/api/admin/quarters/{q['id']}/membership-signups", json={
        "membership_pause_starts_at": (now - timedelta(hours=1)).isoformat(),
        "membership_pause_ends_at": (now + timedelta(hours=2)).isoformat(),
    }).status_code == 200
    e = event(api, q, kind="retreat", general_signup_opens_at=(now + timedelta(hours=1)).isoformat())
    general, approved = person(api, 1), person(api, 2)
    with api.app.state.sessions() as db:
        db.add(Membership(member_id=approved['id'], quarter_id=q['id'], status="approved"))
        db.commit()
    assert reserve(api, e, approved).status_code == 200
    assert reserve(api, e, general).status_code == 403
    assert not api.get(f"/api/events/{e['id']}").json()['general_signup_available']
    monkeypatch.setattr("app.projections.utcnow", lambda: now + timedelta(hours=1))
    assert api.get(f"/api/events/{e['id']}").json()['general_signup_available']
    assert reserve(api, e, general).status_code == 200
    api.cookies.set("aac_session", cookie(general['id']))
    assert api.get(f"/api/me/memberships/{q['id']}").json()['retreat_membership_required']
    assert api.post(f"/api/me/memberships/{q['id']}", json={"student": True, "method": "zelle", "phone": "9495550100"}).status_code == 409
    monkeypatch.setattr("app.projections.utcnow", lambda: now + timedelta(hours=26))
    assert api.get(f"/api/me/signups?event_id={e['id']}").json()['items'][0]['cancelled'] is False


def test_existing_reservation_survives_mode_off_but_restore_needs_eligibility(api):
    e = event(api, quarter(api), kind="retreat", general_signup_opens_at=(utcnow()-timedelta(minutes=1)).isoformat(), signup_cap_total=1)
    a, b = person(api, 1), person(api, 2)
    assert reserve(api, e, a).status_code == 200
    assert reserve(api, e, b).status_code == 409
    e = edit_caps(api, e, general_signup_opens_at=None)
    assert reserve(api, e, a, notes="Edit after mode off").status_code == 200
    api.cookies.set("aac_session", cookie(a['id']))
    assert api.delete(f"/api/events/{e['id']}/signup").status_code == 200
    assert reserve(api, e, a).status_code == 403
    api.cookies.set("aac_session", cookie(1))
    e = edit_caps(api, e, general_signup_opens_at=(utcnow()-timedelta(minutes=1)).isoformat())
    assert reserve(api, e, b).status_code == 200
    assert reserve(api, e, a).status_code == 409


def test_settings_defaults_validation_preservation_and_duplicate(api):
    q = quarter(api)
    e = event(api, q, kind="retreat", activity_logging=True, general_signup_opens_at=utcnow().isoformat())
    fields = {k: v for k, v in e.items() if k in EventWrite.model_fields and k not in {'general_signup_opens_at', 'activity_logging'}}
    edited = api.put(f"/api/admin/events/{e['id']}", json=fields).json()
    assert edited['activity_logging'] and edited['general_signup_opens_at'] == e['general_signup_opens_at']
    shifted = utcnow()+timedelta(days=5)
    copied = api.post(f"/api/admin/events/{e['id']}/duplicate", json={"quarter_id": q['id'], "starts_at": shifted.isoformat(), "ends_at": (shifted+timedelta(hours=3)).isoformat()}).json()
    from datetime import datetime
    assert datetime.fromisoformat(copied['general_signup_opens_at']) - datetime.fromisoformat(e['general_signup_opens_at']) == shifted - datetime.fromisoformat(e['starts_at'])
    assert copied['activity_logging']
    for kind in ['regular', 'meeting', 'picnic']:
        assert event(api, q, kind=kind, activity_logging=True)['activity_logging']
        assert api.post('/api/admin/events', json={**fields, 'kind': kind, 'general_signup_opens_at': utcnow().isoformat()}).status_code == 422
    assert event(api, q)['activity_logging'] is False


def test_series_settings_survive_older_editors(api):
    from test_event_rules import series_input
    q = quarter(api)
    value = series_input(q)
    value['event'].update(kind='retreat', activity_logging=True, general_signup_opens_at=value['event'].get('opens_at'))
    # Give the first occurrence a relative general opening if the fixture has no opening.
    value['event']['general_signup_opens_at'] = value['event']['general_signup_opens_at'] or utcnow().isoformat()
    result = api.post('/api/admin/series', json=value)
    assert result.status_code == 201, result.text
    original = result.json()
    del value['event']['activity_logging']
    del value['event']['general_signup_opens_at']
    result = api.put(f"/api/admin/series/{original['id']}", json=value)
    assert result.status_code == 200, result.text
    assert all(e['activity_logging'] and e['general_signup_opens_at'] for e in result.json()['occurrences'])


@pytest.fixture
def activity(monkeypatch):
    records = []
    monkeypatch.setattr(logger, "info", lambda message: records.append(json.loads(message)))
    return records


def test_logging_flow_identity_reasons_and_committed_results(api, activity):
    e = event(api, quarter(api), kind="retreat", general_signup_opens_at=utcnow().isoformat(), activity_logging=True, signup_cap_total=1)
    a, b = person(api, 1), person(api, 2)
    api.cookies.set("aac_session", cookie(a['id']))
    url = f"/api/events/{e['id']}/activity"
    for action in ['page_view', 'signup_attempt', 'validation_failed']:
        assert api.post(url, json={'action': action}).status_code == 204
    assert reserve(api, e, a, notes='DO NOT LOG THIS').status_code == 200
    assert reserve(api, e, b).status_code == 409
    assert reserve(api, e, a, notes='private edit').status_code == 200
    assert api.delete(f"/api/events/{e['id']}/signup").status_code == 200
    assert reserve(api, e, a).status_code == 200
    actions = [r['action'] for r in activity]
    assert all('browser.'+a in actions for a in ['page_view', 'signup_attempt', 'validation_failed'])
    assert actions.count('signup.created') == 1
    assert actions.count('signup.updated') == 1
    assert actions.count('signup.cancelled') == 1
    assert actions.count('signup.restored') == 1
    rejection = next(r for r in activity if r['action'] == 'signup.rejected')
    assert rejection['reason'] == 'signup_capacity' and rejection['member_id'] == b['id']
    winner = next(r for r in activity if r['action'] == 'signup.created')
    assert winner['authoritative'] and winner['member_name'] == a['name'] and winner['request_id']
    assert 'DO NOT LOG' not in json.dumps(activity) and a['email'] not in json.dumps(activity)
    api.cookies.clear()
    assert api.post(url, json={'action':'page_view'}).status_code == 204
    assert activity[-1]['member_id'] is None
    assert api.put(f"/api/events/{e['id']}/signup", json={'role':'ride'}).status_code == 401
    assert activity[-1]['reason'] == 'sign_in_required'
    api.cookies.set('aac_session', cookie(a['id']))
    assert reserve(api, e, a, role='invalid').status_code == 422
    assert activity[-1]['reason'] == 'validation_failed'


def test_logging_off_and_rollback_never_report_winners(api, activity):
    e = event(api, quarter(api))
    a = person(api)
    assert reserve(api, e, a).status_code == 200
    assert api.post(f"/api/events/{e['id']}/activity", json={'action':'page_view'}).status_code == 204
    assert not activity
    e = edit_caps(api, e, activity_logging=True)
    with api.app.state.sessions() as db:
        from app.models import Member
        save_signup(db, db.get(Event, e['id']), db.get(Member, a['id']), SignupWrite(role='own'))
        assert not activity
        db.rollback()
        db.commit()
    assert not activity
    with api.app.state.sessions() as db:
        assert db.scalar(select(Signup).where(Signup.event_id == e['id'])).role == 'ride'
