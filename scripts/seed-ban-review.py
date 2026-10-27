"""Reset the guarded local browser database and leave populated ban review examples."""
import json
from datetime import timedelta
from pathlib import Path
import runpy
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
# Reuse the existing local-only database guard, synthetic accounts and sessions.
base = runpy.run_path(str(ROOT / "scripts/seed-browser-fixtures.py"))
fixtures = base["fixtures"]
now = base["utcnow"]()

with base["TestClient"](
    base["create_app"](base["settings"], base["engine"]), headers={"Origin": "http://localhost:5173"}
) as api:
    api.cookies.set("aac_session", fixtures["cookies"]["officer"])

    def post(url, body):
        response = api.post(url, json=body)
        response.raise_for_status()
        return response.json()

    events = []
    for name, days, kind in [("Coastal Camping Retreat", 2, "retreat"),
                             ("Next Month Retreat", 20, "retreat"),
                             ("Saturday Trail Walk", 3, "regular")]:
        start = now + timedelta(days=days)
        event = post("/api/admin/events", {
            "quarter_id": fixtures["quarter"]["id"], "name": name, "kind": kind,
            "starts_at": start.isoformat(), "ends_at": (start + timedelta(days=1)).isoformat(),
            **({"general_signup_opens_at": (now - timedelta(minutes=1)).isoformat()} if kind == "retreat" else {}),
        })
        event = post(f"/api/admin/events/{event['id']}/state", {"state": "published"})
        events.append(event)
        post(f"/api/admin/events/{event['id']}/signups", {
            "member_id": fixtures["people"]["Pending"]["id"], "role": "own",
        })
    for label, scope in [
        ("Pending", {"event_kinds": ["retreat"], "membership": True,
                     "expires_at": (now + timedelta(days=7)).isoformat()}),
        ("Member", {"event_ids": [events[2]["id"]]}),
        ("General Rider", {"membership": True}),
    ]:
        post(f"/api/admin/members/{fixtures['people'][label]['id']}/bans", {
            **scope, "reason": "Synthetic officer-only review example.",
            "message": "Please contact the officer team to discuss your signup restriction.",
            "request_id": uuid4().hex,
        })
    post(f"/api/admin/members/{fixtures['people']['Pending']['id']}/memberships/{fixtures['quarter']['id']}/decision", {
        "category": "general", "reason": "Pending submission returned to general membership.",
    })
    fixtures["ban_review"] = {
        "events": events,
        "officer_path": "/admin/members?ban_status=active",
        "member_role": "Pending",
        "event_path": f"/events/{events[0]['slug']}/{events[0]['id']}",
        "membership_path": "/my-aac/membership",
    }
    (ROOT / "artifacts/browser-fixtures.json").write_text(json.dumps(fixtures, indent=2) + "\n")
    print("Ban review fixtures ready: three scoped bans, dues returned to general membership, and retained later signups.")
