"""One-time private AAC history import: python -m app.historical_import --help."""

import argparse
import base64
import hashlib
import io
import json
import os
import shutil
import sys
import tempfile
from collections import Counter
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from PIL import Image, ImageOps
from sqlalchemy import Date, DateTime, Numeric, String, select
from sqlalchemy.orm import Session

from .config import Settings
from .db import make_engine
from .domain import PACIFIC, advisory, utcnow
from .models import (
    Audit,
    BoardEntry,
    BoardTerm,
    DriverRegistration,
    Event,
    Media,
    Member,
    Membership,
    Officer,
    Payout,
    Quarter,
    Receipt,
    Recap,
    Signup,
    Trip,
    Vehicle,
)
from .schemas import MemberInput, Question, VehicleSnapshot
from .services.finance import report

MARKER = "aac-historical-import-v1"
ACTION = "history.import"


class ImportConflict(ValueError):
    pass


def values(model, row, excluded=()):
    """Normalize adapter values against the actual destination column types."""
    result = {}
    columns = model.__table__.columns
    for key, value in row.items():
        if key in excluded or key not in columns or key == "id":
            continue
        column = columns[key]
        if value is not None:
            if isinstance(column.type, DateTime):
                value = value if isinstance(value, datetime) else datetime.fromisoformat(value)
                if value.tzinfo is None:
                    raise ValueError(f"{model.__tablename__}.{key} needs a timezone")
            elif isinstance(column.type, Date):
                value = value if isinstance(value, date) else date.fromisoformat(value)
            elif isinstance(column.type, Numeric):
                value = Decimal(str(value))
            elif isinstance(column.type, String):
                value = str(value)
                if column.type.length and len(value) > column.type.length:
                    raise ValueError(f"{model.__tablename__}.{key} exceeds its column length")
        result[key] = value
    return result


def load_records(db, bundle, actor, stage):
    mappings = {}
    counts = Counter()
    preserved = []

    def remember(key, record, kind):
        db.flush()
        mappings[key] = record
        counts[kind] += 1
        return record

    existing_members = list(db.scalars(select(Member)))
    by_email = {m.email: m for m in existing_members if m.email}
    used_members = set()
    for row in bundle["members"]:
        incoming = values(Member, row)
        MemberInput(name=incoming["name"], email=incoming.get("email"), phone=incoming.get("phone", ""))
        aliases = set(row.get("aliases", [])) | {incoming.get("email")}
        matches = {by_email[a].id: by_email[a] for a in aliases if a in by_email}
        if len(matches) > 1:
            raise ImportConflict(f"Multiple destination accounts match {row['key']}")
        if matches:
            member = next(iter(matches.values()))
            if member.id in used_members:
                raise ImportConflict(f"Separate source people match one destination account: {row['key']}")
            used_members.add(member.id)
            preserved.append(member.id)
            counts["members_reused"] += 1
            for field in [
                "name",
                "phone",
                "discord",
                "pronouns",
                "driving_preferences",
                "payout_method",
                "payout_destination",
                "payout_phone_suffix",
            ]:
                if not getattr(member, field) and incoming.get(field):
                    setattr(member, field, incoming[field])
            if member.can_drive is None and incoming.get("can_drive") is not None:
                member.can_drive = incoming["can_drive"]
        else:
            member = Member(**incoming)
            db.add(member)
            counts["members_created"] += 1
        remember(row["key"], member, "members")
        for key in row.get("source_keys", []):
            mappings[key] = member

    existing_quarters = list(db.scalars(select(Quarter)))
    for row in bundle["quarters"]:
        incoming = values(Quarter, row)
        if any(
            q.starts_on <= incoming["ends_on"] and q.ends_on >= incoming["starts_on"]
            for q in existing_quarters
        ):
            raise ImportConflict(f"Destination already contains an overlapping quarter: {row['key']}")
        quarter = Quarter(**incoming)
        db.add(quarter)
        remember(row["key"], quarter, "quarters")
        existing_quarters.append(quarter)

    for row in bundle["media"]:
        if row["purpose"] not in {"board", "event"}:
            raise ValueError("Unsupported media purpose")
        with Image.open(io.BytesIO(base64.b64decode(row["data"], validate=True))) as source:
            if source.format not in {"JPEG", "PNG", "WEBP"} or source.width * source.height > 40_000_000:
                raise ValueError("Unsupported historical image")
            source.load()
            image = ImageOps.exif_transpose(source).convert("RGB")
        mid = uuid4().hex
        variants = {}
        for label, width in [("small", 320), ("medium", 640), ("large", 1280)]:
            height = width if row["purpose"] == "board" else width * 3 // 4
            thumbnail = ImageOps.fit(image, (width, height), Image.Resampling.LANCZOS)
            name = f"{mid}-{label}.webp"
            thumbnail.save(stage / name, "WEBP", quality=85, method=6)
            variants[label] = name
        media = Media(
            id=mid, purpose=row["purpose"], width=image.width, height=image.height, variants=variants
        )
        db.add(media)
        remember(row["key"], media, "media")

    for row in bundle["vehicles"]:
        incoming = values(Vehicle, row)
        VehicleSnapshot(
            **{k: incoming.get(k) for k in ["year", "make", "model", "color", "plate", "capacity"]}
        )
        vehicle = Vehicle(**incoming, member_id=mappings[row["member_key"]].id)
        db.add(vehicle)
        remember(row["key"], vehicle, "vehicles")

    seen_memberships = set()
    for row in bundle["memberships"]:
        member, quarter = mappings[row["member_key"]], mappings[row["quarter_key"]]
        pair = (member.id, quarter.id)
        if pair in seen_memberships:
            raise ImportConflict("Duplicate destination membership")
        seen_memberships.add(pair)
        membership = Membership(**values(Membership, row), member_id=member.id, quarter_id=quarter.id)
        db.add(membership)
        remember(row["key"], membership, "memberships")
    for row in bundle["receipts"]:
        incoming = values(Receipt, row)
        if incoming["amount"] <= 0:
            raise ValueError("Historical receipts must represent positive known payments")
        receipt = Receipt(**incoming, membership_id=mappings[row["membership_key"]].id, actor_id=actor.id)
        db.add(receipt)
        remember(row["key"], receipt, "receipts")

    for row in bundle["events"]:
        incoming = values(Event, row)
        quarter = mappings[row["quarter_key"]]
        first = incoming["starts_at"].astimezone(PACIFIC).date()
        last = incoming["ends_at"].astimezone(PACIFIC).date()
        if not quarter.starts_on <= first <= last <= quarter.ends_on:
            raise ValueError(f"Event outside its quarter: {row['key']}")
        for question in incoming.get("questions", []):
            Question.model_validate(question)
        event = Event(
            **incoming,
            quarter_id=quarter.id,
            photo_id=mappings[row["photo_key"]].id if row.get("photo_key") else None,
        )
        db.add(event)
        remember(row["key"], event, "events")

    seen_signups = set()
    for row in bundle["signups"]:
        event, member = mappings[row["event_key"]], mappings[row["member_key"]]
        pair = (member.id, event.id)
        if pair in seen_signups:
            raise ImportConflict("Duplicate destination signup")
        seen_signups.add(pair)
        incoming = values(Signup, row)
        if incoming.get("vehicle"):
            VehicleSnapshot.model_validate(incoming["vehicle"])
        if event.state == "published" and (
            incoming["role"] == "unknown"
            or incoming.get("joined_at") is None
            or (incoming["role"] == "driver" and (not row.get("vehicle_key") or not incoming.get("seats")))
        ):
            raise ValueError("Active signups require complete operational details")
        signup = Signup(
            **incoming,
            member_id=member.id,
            event_id=event.id,
            vehicle_id=mappings[row["vehicle_key"]].id if row.get("vehicle_key") else None,
        )
        db.add(signup)
        remember(row["key"], signup, "signups")

    for row in bundle["driver_registrations"]:
        registration = DriverRegistration(
            **values(DriverRegistration, row),
            member_id=mappings[row["member_key"]].id,
            quarter_id=mappings[row["quarter_key"]].id,
        )
        db.add(registration)
        remember(row["key"], registration, "driver_registrations")
    for row in bundle["trips"]:
        if "eligible_override" in row or "eligible" in row:
            raise ValueError("Reimbursement eligibility belongs to the quarter, never a trip")
        trip = Trip(
            **values(Trip, row),
            member_id=mappings[row["member_key"]].id,
            event_id=mappings[row["event_key"]].id,
        )
        db.add(trip)
        remember(row["key"], trip, "trips")
    reports = {qkey: report(db, mappings[qkey]) for qkey in {p["quarter_key"] for p in bundle["payouts"]}}
    for row in bundle["payouts"]:
        member, quarter = mappings[row["member_key"]], mappings[row["quarter_key"]]
        driver = next(
            (d for d in reports[row["quarter_key"]]["drivers"] if d["member_id"] == member.id), None
        )
        if driver is None:
            raise ValueError("Payout has no quarter driver registration")
        snapshot = {k: driver[k] for k in ["eligible", "nominal", "eligible_cost", "capped", "trips"]}
        payout = Payout(**values(Payout, row), snapshot=snapshot, member_id=member.id, quarter_id=quarter.id)
        db.add(payout)
        remember(row["key"], payout, "payouts")

    for row in bundle["boards"]:
        if row.get("current") or row["start_year"] >= 2026:
            raise ValueError("The current board must be configured manually")
        if db.scalar(select(BoardTerm.id).where(BoardTerm.start_year == row["start_year"])):
            raise ImportConflict("Destination already contains this historical board")
        term = BoardTerm(**values(BoardTerm, row))
        db.add(term)
        remember(row["key"], term, "board_terms")
        for position, entry in enumerate(row["entries"]):
            board_entry = BoardEntry(
                **values(BoardEntry, entry),
                term_id=term.id,
                photo_id=mappings[entry["photo_key"]].id if entry.get("photo_key") else None,
            )
            db.add(board_entry)
            remember(f"{row['key']}:{position}", board_entry, "board_entries")
    for row in bundle["recaps"]:
        event = mappings[row["event_key"]]
        if event.state != "completed":
            raise ValueError("A historical recap requires a completed event")
        content = {k: row[k] for k in ["title", "caption", "text", "homepage"]}
        content.update(image_id=mappings[row["image_key"]].id, published_at=utcnow().isoformat())
        recap = Recap(event_id=event.id, draft=content, published=content.copy())
        db.add(recap)
        # Recaps use event_id rather than id as their primary key.
        db.flush()
        mappings[row["key"]] = recap
        counts["recaps"] += 1
    db.flush()
    financials = {q.name: report(db, q) for q in mappings.values() if isinstance(q, Quarter)}
    return {
        "marker": MARKER,
        "counts": dict(counts),
        "preserved_member_ids": preserved,
        "manifest": bundle.get("manifest", {}),
        "source_accounting": bundle.get("accounting", {}),
        "mappings": {
            key: {"table": obj.__tablename__, "id": obj.event_id if isinstance(obj, Recap) else obj.id}
            for key, obj in mappings.items()
        },
        "financials": {
            name: {"available": data["reimbursement_data_available"], "totals": data["totals"]}
            for name, data in financials.items()
        },
    }


def run_import(engine, bundle, actor_id, media_root, *, apply=False):
    if bundle.get("version") != 1:
        raise ValueError("Unsupported import bundle version")
    fingerprint = hashlib.sha256(json.dumps(bundle, sort_keys=True).encode()).hexdigest()
    media_root = Path(media_root)
    installed = []
    with tempfile.TemporaryDirectory(prefix="aac-history-") as temporary, Session(engine) as db:
        try:
            advisory(db, 712)
            if db.scalar(select(Audit.id).where(Audit.action == ACTION, Audit.entity == MARKER)):
                raise ImportConflict("This one-time historical import has already been applied")
            actor = db.get(Member, actor_id)
            if actor is None or db.get(Officer, actor_id) is None:
                raise ImportConflict("Import actor must be an existing officer")
            result = load_records(db, bundle, actor, Path(temporary))
            result.update(fingerprint=fingerprint, mode="apply" if apply else "dry-run")
            if apply:
                media_root.mkdir(parents=True, exist_ok=True)
                for source in Path(temporary).iterdir():
                    target = media_root / source.name
                    if target.exists():
                        raise ImportConflict("Import image path already exists")
                    with target.open("xb") as output:
                        installed.append(target)
                        with source.open("rb") as input_file:
                            shutil.copyfileobj(input_file, output)
                db.add(
                    Audit(
                        actor_id=actor_id,
                        action=ACTION,
                        entity=MARKER,
                        data={
                            "fingerprint": fingerprint,
                            "manifest": result["manifest"],
                            "counts": result["counts"],
                        },
                    )
                )
                db.commit()
            else:
                db.rollback()
            return result
        except BaseException:
            db.rollback()
            for path in installed:
                path.unlink(missing_ok=True)
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Private bundle path, or - for stdin")
    parser.add_argument("--report", required=True, help="Private report path, or - for stdout")
    parser.add_argument("--actor-id", type=int, required=True)
    parser.add_argument(
        "--apply", action="store_true", help="Commit the import; otherwise roll back the rehearsal"
    )
    args = parser.parse_args()
    bundle = json.load(sys.stdin) if args.input == "-" else json.loads(Path(args.input).read_text())
    settings = Settings()
    engine = make_engine(settings.database_url)
    try:
        result = run_import(engine, bundle, args.actor_id, settings.media_root, apply=args.apply)
    finally:
        engine.dispose()
    if args.report == "-":
        print(json.dumps(result))
    else:
        os.umask(0o077)
        Path(args.report).write_text(json.dumps(result, indent=2) + "\n")
        print(
            json.dumps(
                {"mode": result["mode"], "counts": result["counts"], "financials": result["financials"]}
            )
        )


if __name__ == "__main__":
    main()
