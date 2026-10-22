from conftest import cookie, event, person, quarter, signup


def test_driver_passengers_are_full_names_scoped_to_car_and_event(api):
    q = quarter(api)
    first, second = event(api, q), event(api, q)
    driver, other_driver = person(api, 1), person(api, 2)
    drivers = [signup(api, first, m, "driver") for m in (driver, other_driver)]
    second_driver = signup(api, second, driver, "driver")
    riders = []
    for index, name in enumerate(("Alex Rivera", "Alex Rivera", "Zoe Chen", "Other Event Rider"), 3):
        response = api.post(
            "/api/admin/members",
            json={"name": name, "email": f"rider{index}@uci.edu", "phone": "9495550100"},
        )
        assert response.status_code == 201, response.text
        riders.append(signup(api, second if index == 6 else first, response.json()))
    own_ride = signup(api, first, person(api, 7), "own")

    api.cookies.set("aac_session", cookie(driver["id"]))
    assert api.get(f"/api/me/signups?event_id={first['id']}").json()["items"][0]["assigned_car"] is None
    api.cookies.set("aac_session", cookie(1))
    for s in [*drivers, second_driver, *riders, own_ride]:
        assert api.post(f"/api/admin/signups/{s['id']}/check-in").status_code == 200

    def own(member, eid):
        api.cookies.set("aac_session", cookie(member["id"]))
        response = api.get(f"/api/me/signups?event_id={eid}")
        assert response.status_code == 200
        api.cookies.set("aac_session", cookie(1))
        return response.json()["items"][0]

    assert own(driver, first["id"])["assigned_car"]["passengers"] == []
    for rider, target in zip(riders, [drivers[0], drivers[0], drivers[1], second_driver], strict=True):
        response = api.put(
            f"/api/admin/events/{rider['event_id']}/carpools/{rider['id']}",
            json={"driver_signup_id": target["id"]},
        )
        assert response.status_code == 200, response.text

    expected = [{"signup_id": r["id"], "name": "Alex Rivera"} for r in riders[:2]]
    result = own(driver, first["id"])
    assert result["assigned_car"]["passengers"] == expected
    assert "email" not in result and "phone" not in result
    assert own(driver, second["id"])["assigned_car"]["passengers"] == [
        {"signup_id": riders[3]["id"], "name": "Other Event Rider"}
    ]
    api.cookies.set("aac_session", cookie(riders[0]["member_id"]))
    rider_car = api.get(f"/api/me/signups?event_id={first['id']}").json()["items"][0]["assigned_car"]
    assert rider_car["driver_name"] == driver["name"]
    assert rider_car["co_riders"] == ["Alex"]
    assert rider_car["passengers"] == []
    api.cookies.set("aac_session", cookie(own_ride["member_id"]))
    assert api.get(f"/api/me/signups?event_id={first['id']}").json()["items"][0]["assigned_car"] is None
    api.cookies.clear()
    assert api.get("/api/me/signups").status_code == 401
    assert "passengers" not in api.get(f"/api/events/{first['id']}").json()

    api.cookies.set("aac_session", cookie(1))
    assert api.put(
        f"/api/admin/events/{first['id']}/carpools/{riders[1]['id']}",
        json={"driver_signup_id": drivers[1]["id"]},
    ).status_code == 200
    assert own(driver, first["id"])["assigned_car"]["passengers"] == expected[:1]
    assert own(other_driver, first["id"])["assigned_car"]["passengers"] == [
        expected[1], {"signup_id": riders[2]["id"], "name": "Zoe Chen"}
    ]
    assert api.put(
        f"/api/admin/events/{first['id']}/carpools/{riders[0]['id']}",
        json={"driver_signup_id": None},
    ).status_code == 200
    assert own(driver, first["id"])["assigned_car"]["passengers"] == []
    assert api.delete(f"/api/admin/signups/{riders[1]['id']}/check-in").status_code == 200
    assert own(other_driver, first["id"])["assigned_car"]["passengers"] == [
        {"signup_id": riders[2]["id"], "name": "Zoe Chen"}
    ]
    assert api.delete(f"/api/admin/signups/{drivers[1]['id']}/check-in").status_code == 200
    assert own(other_driver, first["id"])["assigned_car"] is None
    assert api.delete(f"/api/admin/signups/{riders[2]['id']}/check-in").status_code == 200
    assert api.delete(f"/api/admin/signups/{riders[2]['id']}").status_code == 200
    assert api.post(f"/api/admin/signups/{drivers[1]['id']}/check-in").status_code == 200
    assert own(other_driver, first["id"])["assigned_car"]["passengers"] == []
