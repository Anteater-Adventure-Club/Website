"""Seed or serve a loopback-only demo of the compiled AAC application."""

import os
import sys
from datetime import timedelta
from html import escape
from pathlib import Path

from fastapi import HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import select, text
from sqlalchemy.engine import make_url
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.staticfiles import StaticFiles
import uvicorn

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.auth import bootstrap  # noqa: E402
from app.config import Settings  # noqa: E402
from app.db import Base, make_engine, session_factory  # noqa: E402
from app.domain import today, utcnow  # noqa: E402
from app.gear_schemas import GearRequest, GearAssignment  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models import (  # noqa: E402
    GearItem,
    GearLine,
    GearType,
    GuestOfficerAccess,
    Marker,
    Member,
    Membership,
    Quarter,
)
from app.services.gear import create  # noqa: E402

PORT = 5178
ORIGIN = f"http://127.0.0.1:{PORT}"
settings = Settings()
url = make_url(settings.database_url)
if (
    url.host != "127.0.0.1"
    or url.database != "aac_gear_demo"
    or settings.environment != "development"
    or settings.app_url != ORIGIN
    or settings.initial_officers != "officer@uci.edu"
    or url.query
):
    sys.exit("Use the dedicated local aac_gear_demo database and demo environment in docs/development.md.")
engine = make_engine(settings.database_url)
sessions = session_factory(engine)
DIST = Path(os.environ.get("GEAR_DEMO_DIST", ROOT / "frontend/dist")).resolve()
OUTPUT = Path(os.environ.get("GEAR_DEMO_OUTPUT", ROOT / "artifacts/gear-demo"))
ROLES = {
    "member": ("Alex Rivera", "Paid member", "alex@example.test"),
    "second": ("Riley Park", "Second paid member", "riley@example.test"),
    "unpaid": ("Casey Lee", "Unpaid member", "casey@example.test"),
    "officer": ("Jamie Chen", "Full officer", "officer@uci.edu"),
    "helper": ("Quinn Lee", "Gear helper", "quinn@example.test"),
    "other": ("Robin West", "Helper without Gear", "robin@example.test"),
}
DESTINATIONS = {
    "request": ("Request gear", "/my-aac/gear"),
    "history": ("My rentals", "/my-aac/gear?tab=rentals"),
    "rentals": ("Review rentals", "/admin/gear"),
    "inventory": ("Inventory and types", "/admin/gear?tab=inventory"),
    "assign": ("Assign gear", "/admin/gear?tab=assign"),
    "overview": ("Dashboard notices", "/admin/overview"),
    "permissions": ("Guest permissions", "/admin/officers"),
}


def seed():
    with sessions.begin() as db:
        if db.get(Marker, "gear_demo"):
            tables = ",".join(f'"{name}"' for name in Base.metadata.tables)
            db.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
        elif db.scalar(select(Member.id).limit(1)):
            sys.exit("This database contains members and was not created by the demo seeder.")
    with sessions() as db:
        bootstrap(db, settings)
    with sessions.begin() as db:
        db.add(Marker(key="gear_demo"))
        names = ["Sleeping bag", "Sleeping pad", "Tent", "Portable camp toilet", "Camp stove"]
        kinds = {}
        for name in names:
            kind = db.scalar(select(GearType).where(GearType.name == name))
            if not kind:
                kind = GearType(name=name)
                db.add(kind)
            kinds[name] = kind
        q = Quarter(
            name="Adventure quarter",
            starts_on=today() - timedelta(days=60),
            ends_on=today() + timedelta(days=90),
        )
        db.add(q)
        people = {}
        for role, (name, _, email) in ROLES.items():
            person = db.scalar(select(Member).where(Member.email == email))
            if not person:
                person = Member(email=email, name=name)
                db.add(person)
            person.name = name
            people[role] = person
        db.flush()
        for role in ("member", "second", "helper", "officer"):
            db.add(
                Membership(member_id=people[role].id, quarter_id=q.id, status="approved", source="payment")
            )
        actor = people["officer"]
        for role, perm in (("helper", "gear"), ("other", "board")):
            db.add(
                GuestOfficerAccess(
                    member_id=people[role].id,
                    permissions=[perm],
                    granted_by=actor.id,
                    updated_by=actor.id,
                    expires_at=utcnow() + timedelta(days=60),
                )
            )
        gear = {}
        for kind, name, qty in (
            ("Tent", "VEVOR 4-person tent", 4),
            ("Tent", "Naturehike Cloud Up 2", 1),
            ("Sleeping bag", "Big Agnes Anthracite 20 · Regular", 2),
            ("Sleeping bag", "Big Agnes Anthracite 20 · Long", 1),
            ("Sleeping pad", "Naturehike R4.6 · Regular", 2),
            ("Camp stove", "Ozark Trail stove", 1),
            ("Tent", "Expired officer tent", 1),
            ("Portable camp toilet", "Reliance Luggable Loo", 1),
            ("Tent", "Staff expedition tent", 1),
        ):
            loan = name in ("Naturehike Cloud Up 2", "Expired officer tent")
            item = GearItem(
                type_id=kinds[kind].id,
                name=name,
                quantity=qty,
                rentable=not name.startswith("Staff"),
                ownership="officer" if loan else "club",
                owner=actor.name if loan else "",
                loan_start=today() - timedelta(days=7) if loan else None,
                loan_end=today() + timedelta(days=(-1 if name.startswith("Expired") else 30))
                if loan
                else None,
            )
            db.add(item)
            gear[name] = item
        db.flush()

        def rental(role, activity, names, offset, assigned=False):
            values = dict(
                start=today() + timedelta(days=offset),
                end=today() + timedelta(days=offset + 2),
                activity=activity,
                item_ids=[gear[n].id for n in names],
            )
            if assigned:
                return create(db, actor, GearAssignment(**values, member_id=people[role].id), assigned=True)
            return create(db, people[role], GearRequest(**values))

        rental("second", "Retreat camping", ["VEVOR 4-person tent", "Big Agnes Anthracite 20 · Long"], 0)
        mixed = rental(
            "member",
            "Backpacking in Big Bear",
            ["Naturehike Cloud Up 2", "Naturehike R4.6 · Regular"],
            6,
            True,
        )
        pad = db.scalar(
            select(GearLine).where(GearLine.rental_id == mixed.id, GearLine.type_name == "Sleeping pad")
        )
        pad.status, pad.message = "denied", "The pad needs a valve repair."
        late = rental("helper", "Stove checkout", ["Ozark Trail stove"], 0, True)
        rental("second", "Camp cooking", ["Ozark Trail stove"], 4, True)
        late.start, late.end = today() - timedelta(days=5), today() - timedelta(days=1)
        stove = db.scalar(select(GearLine).where(GearLine.rental_id == late.id))
        stove.status, stove.picked_up_at, stove.picked_up_by = (
            "picked_up",
            utcnow() - timedelta(days=5),
            actor.id,
        )


def launcher():
    groups = []
    for key, (name, label, _) in ROLES.items():
        links = ["request", "history"] if key in ("member", "second", "unpaid") else ["rentals"]
        if key in ("officer", "helper"):
            links += ["inventory", "assign"]
        if key == "officer":
            links += ["overview", "permissions"]
        forms = "".join(
            f'<form method="post" action="/demo/login/{key}/{dest}"><button>'
            f"{escape(DESTINATIONS[dest][0])}</button></form>"
            for dest in links
        )
        groups.append(f"<section><h2>{escape(label)}</h2><p>{escape(name)}</p>{forms}</section>")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    page = OUTPUT / "gear-rental.html"
    page.write_text(
        """<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AAC gear rental demo</title>
<style>*{box-sizing:border-box}body{font:1rem/1.5 system-ui;color:#20382a;background:#f4f5ee;
max-width:64rem;margin:auto;padding:clamp(1rem,4vw,3rem)}h1{font-size:clamp(2rem,6vw,3.4rem);line-height:1.1}
main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr));gap:1rem}
section{background:white;border:1px solid #cad5c9;border-radius:1rem;padding:1.25rem}h2,p{margin:0 0 .6rem}
form{display:inline}button{border:1px solid #41644c;border-radius:.5rem;background:#ecf4ec;color:#20432b;
font:inherit;min-height:44px;margin:.25rem .25rem .25rem 0;cursor:pointer;padding:.45rem .7rem}
button:focus-visible{outline:3px solid #1e6136}</style><h1>AAC gear rental demo</h1>
<p>Submit a request as Alex, approve it as Jamie, then open Alex’s rentals to see the decision.
Use your browser’s Back button or return to <a href="/demo">this launcher</a> to switch accounts.</p>
<main>"""
        + "".join(groups)
        + "</main></html>"
    )
    return page


def serve():
    if not (DIST / "index.html").is_file():
        sys.exit("Build the frontend and point GEAR_DEMO_DIST at its dist directory.")
    page = launcher()
    app = create_app(settings, engine)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1"])

    @app.get("/demo")
    def demo():
        return FileResponse(page)

    @app.post("/demo/login/{role}/{dest}")
    def login(role: str, dest: str, request: Request):
        if request.headers.get("origin") != ORIGIN or role not in ROLES or dest not in DESTINATIONS:
            raise HTTPException(403)
        with sessions() as db:
            if not db.get(Marker, "gear_demo"):
                raise HTTPException(409, "Seed the demo database first.")
            mid = db.scalar(select(Member.id).where(Member.email == ROLES[role][2]))
        if mid is None:
            raise HTTPException(404)
        request.session.clear()
        request.session.update(member_id=mid, login_at=int(utcnow().timestamp()))
        return RedirectResponse(DESTINATIONS[dest][1], status_code=303)

    for folder in ("assets", "fonts", "images", "logos"):
        app.mount("/" + folder, StaticFiles(directory=DIST / folder), name=folder)

    @app.get("/{path:path}")
    def frontend(path: str):
        if path.startswith("api/"):
            raise HTTPException(404)
        return FileResponse(DIST / "index.html")

    uvicorn.run(app, host="127.0.0.1", port=PORT)


if __name__ == "__main__":
    if sys.argv[1:] == ["seed"]:
        seed()
    elif sys.argv[1:] == ["serve"]:
        serve()
    else:
        sys.exit("Usage: gear-demo.py seed|serve")
