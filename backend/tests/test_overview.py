from datetime import timedelta

from app.domain import today, utcnow
from app.models import Event
from conftest import event, person, quarter, signup


def test_quarter_members_count_unique_signups_independent_of_attendance_and_dues(api):
    current = quarter(api)
    other = quarter(
        api,
        name="Next quarter",
        starts_on=str(today() + timedelta(days=91)),
        ends_on=str(today() + timedelta(days=180)),
    )
    empty = quarter(
        api,
        name="Empty quarter",
        starts_on=str(today() + timedelta(days=181)),
        ends_on=str(today() + timedelta(days=270)),
    )
    members = [person(api, i) for i in range(1, 9)]
    upcoming = event(api, current)
    completed = event(api, current, name="Completed event")
    cancelled_event = event(api, current, name="Cancelled event")
    skipped = event(api, current, name="Skipped occurrence")
    future_start = utcnow() + timedelta(days=100)
    next_event = event(
        api,
        other,
        starts_at=future_start.isoformat(),
        ends_at=(future_start + timedelta(hours=5)).isoformat(),
        departure_at=future_start.isoformat(),
    )

    # Multiple events and cancellation/re-registration still represent one member.
    repeat = signup(api, upcoming, members[0])
    signup(api, completed, members[0], "own")
    assert api.delete(f"/api/admin/signups/{repeat['id']}").status_code == 200
    cancelled = signup(api, upcoming, members[1])
    assert api.delete(f"/api/admin/signups/{cancelled['id']}").status_code == 200

    # A no-show and an attendee both count; neither needs a paid membership.
    signup(api, completed, members[2], "own")
    arrived = signup(api, completed, members[3], "own")
    assert api.post(f"/api/admin/signups/{arrived['id']}/check-in").status_code == 200
    assert (
        api.post(f"/api/admin/events/{completed['id']}/state", json={"state": "completed"}).status_code
        == 200
    )

    signup(api, cancelled_event, members[4])
    assert (
        api.post(
            f"/api/admin/events/{cancelled_event['id']}/state",
            json={"state": "cancelled", "reason": "Weather"},
        ).status_code
        == 200
    )
    signup(api, skipped, members[5])
    with api.app.state.sessions() as db:
        db.get(Event, skipped["id"]).skipped = True
        db.commit()

    assert (
        api.post(
            f"/api/admin/members/{members[6]['id']}/memberships/{current['id']}/decision",
            json={"category": "exception", "reason": "Membership without a signup"},
        ).status_code
        == 200
    )
    signup(api, next_event, members[7])

    def statistics(q):
        response = api.get(f"/api/admin/overview?quarter_id={q['id']}")
        assert response.status_code == 200, response.text
        return response.json()["statistics"]

    # Lifetime includes the officer and all eight people, independent of selected quarter.
    for q, expected in ((current, 6), (other, 1), (empty, 0)):
        stats = statistics(q)
        assert stats["quarter_members"] == expected
        assert stats["members"] == 9
    restored = signup(api, upcoming, members[0])
    assert restored["id"] == repeat["id"]
    assert statistics(current)["quarter_members"] == 6
