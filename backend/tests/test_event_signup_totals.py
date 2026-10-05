from conftest import cookie, event, person, quarter, signup


def test_public_totals_follow_active_signups_and_driver_offers(api):
    q = quarter(api)
    e = event(api, q)
    other = event(api, q, name="Another trail")

    def totals():
        data = api.get(f"/api/events/{e['id']}").json()
        assert not any(key in data for key in ("signups", "email", "phone", "answers"))
        return data["signup_count"], data["offered_seats"]

    assert totals() == (0, 0)
    people = [person(api, n) for n in range(1, 6)]
    signup(api, e, people[0])
    signup(api, e, people[1])
    signup(api, e, people[2], "own")
    signup(api, e, people[3], "driver")
    signup(api, e, people[4], "driver")
    signup(api, other, person(api, 6), "driver")
    assert totals() == (5, 6)

    api.cookies.set("aac_session", cookie(people[4]["id"]))
    assert api.delete(f"/api/events/{e['id']}/signup").status_code == 200
    api.cookies.set("aac_session", cookie(people[1]["id"]))
    assert api.delete(f"/api/events/{e['id']}/signup").status_code == 200
    assert totals() == (3, 3)
    api.cookies.set("aac_session", cookie(1))
    edit = api.post(
        f"/api/admin/events/{e['id']}/signups",
        json={"member_id": people[3]["id"], "role": "own"},
    )
    assert edit.status_code == 200
    assert totals() == (3, 0)
    signup(api, e, people[1], "own")
    assert totals() == (4, 0)
    api.cookies.clear()
    assert totals() == (4, 0)
    response = api.get(f"/api/events?from={q['starts_on']}&to={q['ends_on']}")
    assert response.status_code == 200
    public_list = response.json()["items"]
    assert next(item for item in public_list if item["id"] == e["id"])["signup_count"] == 4
