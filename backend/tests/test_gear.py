from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from sqlalchemy import select
from app.domain import today, utcnow
from app.models import GearRental, Membership
from conftest import cookie, person, quarter

ADMIN = "/api/admin/gear"
OWN = "/api/me/gear-rentals"


def borrower(api, q, n):
    mid = person(api, n)["id"]
    assert api.post(
        f"/api/admin/members/{mid}/memberships/{q['id']}/decision",
        json={"category": "exception", "student": True, "reason": "Fixture"},
    ).is_success
    return mid


def headers(mid):
    return {"Cookie": f"aac_session={cookie(mid)}"}


def inventory(api, name, quantity=1, type_id=None, **extra):
    if not type_id:
        type_id = api.post(ADMIN + "/types", json={"name": name}).json()["id"]
    response = api.post(
        ADMIN + "/inventory",
        json={"type_id": type_id, "name": name, "quantity": quantity, "rentable": True, **extra},
    )
    assert response.is_success, response.text
    return response.json()


def dates(a=0, b=0):
    return {"start": str(today() + timedelta(days=a)), "end": str(today() + timedelta(days=b))}


def body(items, a=0, b=0):
    return {"item_ids": [item["id"] for item in items], "activity": "Club retreat", **dates(a, b)}


def action(api, r, verb, *indices):
    return api.post(
        f"{ADMIN}/rentals/{r['id']}/actions",
        json={
            "line_ids": [r["lines"][i]["id"] for i in indices],
            "action": verb,
            "expected_revision": r["revision"],
        },
    )


def test_member_access_follows_paid_quarters_and_keeps_existing_rentals_reachable(api):
    def access(mid):
        response = api.get("/api/me/gear-access", headers=headers(mid))
        assert response.is_success, response.text
        return response.json()

    unpaid = person(api, 1)["id"]
    assert access(unpaid) == dict(first_pickup=None, quarter_id=None, quarter_name=None, has_rentals=False)
    current = quarter(api, ends_on=dates(0, 8)["end"])
    future = quarter(api, name="Next quarter", starts_on=dates(9, 9)["start"])
    assert access(unpaid) == dict(
        first_pickup=None, quarter_id=current["id"], quarter_name=current["name"], has_rentals=False
    )
    mid = borrower(api, future, 2)
    assert access(mid)["first_pickup"] == future["starts_on"]
    assert access(mid)["quarter_id"] == future["id"]
    item = inventory(api, "Tent")
    assert api.post(OWN, json=body([item], 9, 9), headers=headers(mid)).is_success
    with api.app.state.sessions.begin() as db:
        db.scalar(select(Membership).where(Membership.member_id == mid)).status = "pending"
    assert access(mid)["first_pickup"] is None
    assert access(mid)["has_rentals"]
    assert not access(unpaid)["has_rentals"]


def test_quantities_and_type_races(api):
    q = quarter(api)
    members = [borrower(api, q, i) for i in range(7)]
    tent = inventory(api, "Tent", quantity=4)
    with ThreadPoolExecutor(max_workers=7) as pool:
        responses = list(
            pool.map(lambda mid: api.post(OWN, json=body([tent]), headers=headers(mid)), members)
        )
    assert sorted(r.status_code for r in responses) == [201] * 4 + [409] * 3
    second = inventory(api, "Two-person tent", type_id=tent["type_id"])
    member = next(m for m, r in zip(members, responses) if r.is_success)
    assert api.post(OWN, json=body([second]), headers=headers(member)).status_code == 409
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(lambda i: api.post(OWN, json=body([i], 2, 3), headers=headers(member)), [tent, second])
        )
    assert sorted(r.status_code for r in results) == [201, 409]


def test_peak_overlap_and_atomicity(api):
    q = quarter(api)
    a, b, c = [borrower(api, q, i) for i in range(3)]
    tent = inventory(api, "Tent", quantity=2)
    pad = inventory(api, "Pad", rentable=False)
    for who, day in [(a, 1), (b, 3)]:
        assert api.post(OWN, json=body([tent], day, day), headers=headers(who)).is_success
    cat = api.get("/api/gear", params=dates(1, 3), headers=headers(c)).json()
    assert [(i["id"], i["available"]) for i in cat["items"]] == [(tent["id"], 1)]
    assert api.post(OWN, json=body([tent, pad], 1, 3), headers=headers(c)).status_code == 409
    assert api.post(OWN, json=body([tent], 1, 3), headers=headers(c)).is_success


def test_custody_is_per_copy_and_follows_handoffs(api):
    q = quarter(api)
    mid = borrower(api, q, 1)
    helper = person(api, 2)["id"]
    assert api.post("/api/admin/guest-officers", json={
        "member_id": helper, "permissions": ["gear"],
        "expires_at": (utcnow() + timedelta(days=1)).isoformat(),
    }).is_success
    tent = inventory(api, "Tent", quantity=3)
    bag = inventory(api, "Bag")
    iid = tent["id"]
    custody_url = f"{ADMIN}/inventory/{iid}/custody/2"

    def state():
        data = api.get(ADMIN + "/inventory").json()
        return {(h["item_id"], h["copy_number"]): (h["kind"], h["holder_id"]) for h in data["holders"]}

    def transfer(to, rev, actor=1):
        return api.put(custody_url, headers=headers(actor), json={"expected_revision": rev, "officer_id": to})

    assert state() == {}
    assert transfer(helper, 1, mid).status_code == 403
    assert transfer(mid, 1).status_code == 422
    assert transfer(helper, 1).is_success
    assert transfer(None, 1).status_code == 409
    assert state() == {(iid, 2): ("officer", helper)}
    values = {k: v for k, v in tent.items() if k not in ("revision", "id")}
    assert api.put(ADMIN + f"/inventory/{iid}", json={
        **values, "quantity": 1, "expected_revision": 2,
    }).status_code == 409
    rental = api.post(ADMIN + "/rentals", json={**body([tent, bag]), "member_id": mid}).json()
    tent_line, bag_line = [line["id"] for line in rental["lines"]]
    url = f"{ADMIN}/rentals/{rental['id']}/actions"
    pickup = dict(action="pickup", expected_revision=1, line_ids=[tent_line, bag_line])
    assert api.post(url, json=pickup).status_code == 409
    copies = {str(tent_line): {"copy_number": 2, "expected_revision": 2},
              str(bag_line): {"copy_number": 9, "expected_revision": 1}}
    assert api.post(url, json={**pickup, "pickup_copies": copies}).status_code == 409
    assert state() == {(iid, 2): ("officer", helper)}
    copies[str(bag_line)]["copy_number"] = 1
    assert api.post(url, json={**pickup, "pickup_copies": copies}).is_success
    assert state() == {(iid, 2): ("borrower", mid), (bag["id"], 1): ("borrower", mid)}
    assert transfer(1, 3).status_code == 409
    returned = dict(action="return", line_ids=[tent_line], expected_revision=2)
    assert api.post(url, json={**returned, "return_to": mid}).status_code == 422
    assert api.post(url, json={**returned, "return_to": None}).is_success
    assert (iid, 2) not in state()
    assert api.post(url, json={**returned, "line_ids": [bag_line], "expected_revision": 3}).is_success
    assert state() == {(bag["id"], 1): ("officer", 1)}
    assert transfer(helper, 4, helper).is_success
    assert transfer(None, 5).is_success
    assert (iid, 2) not in state()


def test_partial_handoffs_and_cancellation_privacy(api):
    q = quarter(api)
    mid, other = [borrower(api, q, i) for i in range(2)]
    items = [inventory(api, n) for n in ("Tent", "Pad", "Bag")]
    rental = api.post(OWN, headers=headers(mid), json=body(items, 0, 6)).json()
    private = api.get(f"{OWN}/{rental['id']}", headers=headers(other))
    absent = api.get(f"{OWN}/{rental['id'] + 100}", headers=headers(other))
    assert private.status_code == absent.status_code == 404
    assert private.json() == absent.json()

    def cancel(who, rev):
        return api.post(
            f"{OWN}/{rental['id']}/cancel",
            headers=headers(who),
            json={"expected_revision": rev, "line_ids": [rental["lines"][0]["id"]]},
        )

    assert cancel(other, 1).status_code == 404
    approved = action(api, rental, "approve", 0, 1).json()
    assert cancel(mid, 1).status_code == 409
    denied = action(api, approved, "deny", 2).json()
    picked = action(api, denied, "pickup", 0).json()
    assert cancel(mid, picked["revision"]).status_code == 409
    returned = action(api, picked, "return", 0).json()
    assert [line["status"] for line in returned["lines"]] == ["returned", "approved", "denied"]
    assert api.post(OWN, headers=headers(other), json=body([items[0], items[2]])).is_success


def test_loan_period_membership_and_extension(api):
    q = quarter(api)
    mid = borrower(api, q, 1)
    spare = person(api, 2)["id"]
    item = inventory(
        api,
        "Loan tent",
        ownership="officer",
        owner="Sam",
        loan_start=dates()["start"],
        loan_end=dates(0, 8)["end"],
    )

    def catalog_for(mid, start, end):
        return api.get("/api/gear", params=dates(start, end), headers=headers(mid)).json()["items"]

    assert catalog_for(spare, 0, 2) == []
    assert [i["id"] for i in catalog_for(mid, 7, 8)] == [item["id"]]
    assert catalog_for(mid, 8, 9) == []
    assert catalog_for(mid, 9, 10) == []
    assert any(i["id"] == item["id"] for i in api.get(ADMIN + "/inventory").json()["items"])
    assert api.post(OWN, json=body([item]), headers=headers(spare)).status_code == 403
    assert api.post(OWN, json=body([item], 0, 7), headers=headers(mid)).status_code == 422
    assert (
        api.post(
            ADMIN + "/rentals", json={**body([item], 0, 9), "member_id": mid, "reason": "Trip"}
        ).status_code
        == 409
    )
    r = api.post(ADMIN + "/rentals", json={**body([item], 0, 7), "member_id": mid, "reason": "Trip"}).json()
    assert r["status"] == "approved"
    update = {k: v for k, v in item.items() if k not in ("revision", "id")}
    for changes in [{"quantity": 0}, {"loan_end": dates()["end"]}, {"archived": True}]:
        assert (
            api.put(
                f"{ADMIN}/inventory/{item['id']}", json={**update, **changes, "expected_revision": 1}
            ).status_code
            == 409
        )
    assert api.put(
        f"{ADMIN}/inventory/{item['id']}", json={**update, "rentable": False, "expected_revision": 1}
    ).is_success
    url = f"{ADMIN}/rentals/{r['id']}/dates"
    assert api.put(url, json={**dates(0, 8), "expected_revision": 1}).status_code == 422
    assert api.put(url, json={**dates(0, 8), "expected_revision": 1, "reason": "Approved trip"}).is_success


def test_overdue_stock_and_quarter_boundary(api):
    q = quarter(api, ends_on=str(today() + timedelta(days=1)))
    a, b = [borrower(api, q, i) for i in range(2)]
    item = inventory(api, "Stove")
    r = api.post(ADMIN + "/rentals", json={**body([item]), "member_id": a}).json()
    out = action(api, r, "pickup", 0).json()
    alternate = inventory(api, "Stove B", type_id=item["type_id"])
    next_rental = api.post(OWN, json=body([alternate], 1, 2), headers=headers(a)).json()
    detail = f"{OWN}/{next_rental['id']}"
    assert api.post(OWN, json=body([item], 1, 2), headers=headers(b)).is_success
    assert api.post(OWN, json=body([item], 2, 2), headers=headers(b)).status_code == 403
    with api.app.state.sessions() as db:
        past = db.get(GearRental, r["id"])
        past.start = past.end = today() - timedelta(days=1)
        db.commit()
    future = api.get(OWN, headers=headers(b)).json()["items"][0]
    assert future["lines"][0]["at_risk"]
    assert api.get(detail, headers=headers(a)).json()["lines"][0]["at_risk"]
    assert api.get("/api/gear", params=dates(1, 1), headers=headers(a)).json()["items"][0]["available"] == 0
    assert action(api, out, "return", 0).is_success
    assert not api.get(detail, headers=headers(a)).json()["lines"][0]["at_risk"]
    assert not api.get(OWN, headers=headers(b)).json()["items"][0]["lines"][0]["at_risk"]


def test_inventory_edit_races_request_and_gear_permission_expires(api):
    q = quarter(api)
    mid = borrower(api, q, 1)
    actor = person(api, 3)
    item = inventory(api, "Pad")
    details = {k: v for k, v in item.items() if k not in ("id", "revision")}
    update = {**details, "quantity": 0, "expected_revision": 1}
    with ThreadPoolExecutor(max_workers=2) as pool:
        request = pool.submit(api.post, OWN, json=body([item]), headers=headers(mid))
        edit = pool.submit(api.put, f"{ADMIN}/inventory/{item['id']}", json=update)
    assert sorted([request.result().is_success, edit.result().is_success]) == [False, True]
    assert 409 in (request.result().status_code, edit.result().status_code)
    assignments = {**body([item]), "member_id": mid}
    assert api.post(ADMIN + "/rentals", json=assignments, headers=headers(mid)).status_code == 403
    grant = {
        "member_id": actor["id"],
        "permissions": ["gear"],
        "expires_at": (utcnow() + timedelta(days=1)).isoformat(),
    }
    assert api.post("/api/admin/guest-officers", json=grant).is_success
    assert api.get(ADMIN + "/inventory", headers=headers(actor["id"])).is_success
    assert api.delete(f"/api/admin/guest-officers/{actor['id']}").is_success
    assert api.post(ADMIN + "/rentals", json=assignments, headers=headers(actor["id"])).status_code == 403
