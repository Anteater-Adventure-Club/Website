"""Prepare the private, one-time AAC import bundle; never modifies source data."""

import argparse
import base64
import csv
import hashlib
import json
import os
import re
import subprocess
from collections import Counter, defaultdict
from datetime import datetime, time, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

PACIFIC = ZoneInfo("America/Los_Angeles")
RETREATS = {
    "F24": ("Sequoia & Kings Canyon", "2024-11-08", "2024-11-10"),
    "W25": ("Death Valley", "2025-02-14", "2025-02-16"),
    "S25": ("Zion", "2025-05-23", "2025-05-26"),
    "F25": ("Central Coast", "2025-11-21", "2025-11-23"),
    "W26": ("Joshua Tree", "2026-02-20", "2026-02-22"),
}
QUARTERS = {
    "F24": ("Fall 2024", "2024-09-23", "2024-12-13"),
    "W25": ("Winter 2025", "2025-01-06", "2025-03-21"),
    "S25": ("Spring 2025", "2025-03-31", "2025-06-13"),
    "F25": ("Fall 2025", "2025-09-20", "2025-12-12"),
}
MVP_EVENT_NAMES = {
    "Balboa Island Beach Day": "Balboa Beach Day",
    "Chino Hills Hike and Temple Visit": "Eucalyptus Trail",
    "OC Zoo and Irvine Regional Park": "OC Zoo",
    "Sturtevant Falls + Old Town Pasadena": "Sturtevant Falls",
    "Laguna Tide Pools + Heisler Park": "Laguna Tide pools",
}
STATIC_EVENT_NAMES = {
    "Hot Tub Kickback (Camino del Sol Pool)": "Hot Tub Kickback (Camino)",
    "AAC x Ocean Club: Surfing @ Newport Beach": "AAC x Ocean Club Collab",
    "OC Zoo and Irvine Regional Park Day Trip": "OC Zoo",
    "Sturtevant Falls Hike": "Sturtevant Falls",
    "Eucalyptus Trail Hike & Temple Visit": "Eucalyptus Trail",
    "Balboa Island": "Balboa Beach Day",
    "Crystal Cove Beach Walk": "Beach Day (Crystal Cove)",
}
QUESTION_FIELDS = [
    "departure_day_preference",
    "return_time_preference",
    "return_time_start_preference",
    "camping_gear_available",
    "camping_gear_to_share",
    "sleeping_gear_to_share",
    "room_assignment_preference",
    "snacks_bev_suggestions",
    "dietary_restrictions",
    "bedtime",
    "wake_time",
    "car_preference",
    "liability_waiver_signed",
    "attended_workshop",
    "filled_out_final_form",
    "ready_for_retreat",
    "emergency_contact_name",
    "emergency_contact_relation",
    "emergency_contact_phone",
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def instant(value):
    if not value:
        return None
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=PACIFIC)
    return dt.astimezone(timezone.utc).isoformat()


def date_bounds(first, last=None):
    start = datetime.combine(datetime.fromisoformat(first).date(), time.min, PACIFIC)
    end = datetime.combine(datetime.fromisoformat(last or first).date(), time.max, PACIFIC)
    return start.astimezone(timezone.utc).isoformat(), end.astimezone(timezone.utc).isoformat()


def email(value):
    value = (value or "").strip().lower()
    if value.count("@") != 1 or any(c.isspace() for c in value):
        return None
    local, domain = value.split("@")
    return value if local and "." in domain else None


def yes(value):
    value = str(value or "").strip().lower()
    return True if value in {"true", "yes", "1"} else False if value in {"false", "no", "0"} else None


def ride(row):
    meta = json.loads(row.get("metadata_json") or "{}")
    raw = str(meta.get("ride_status") or row.get("ride_situation") or row.get("ride_coordination") or "")
    text = raw.casefold()
    if yes(row.get("can_provide_rides")) is True or "provide ride" in text or "can drive" in text:
        role = "driver"
    elif "own ride" in text or "drive myself" in text or text.strip() == "no":
        role = "own"
    elif "need a ride" in text or "need ride" in text or text.startswith("yes,"):
        role = "ride"
    else:
        role = "unknown"
    seats = None if role == "driver" else 0
    if role == "driver" and row.get("seats_available"):
        seats = int(float(row["seats_available"]))
    return role, seats


def typescript_data(node, root, static):
    code = """
import ts from 'typescript';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const root = process.argv[1];
const out = {};
for (const file of ['officers','previousOfficers','pastEvents']) {
  const input = fs.readFileSync(path.join(root, 'src/data', file + '.ts'), 'utf8');
  const compiled = ts.transpileModule(input, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const sandbox = {exports:{}};
  vm.runInNewContext(compiled, sandbox);
  out[file] = sandbox.exports.default || sandbox.exports.pastEvents;
}
process.stdout.write(JSON.stringify(out));
"""
    return json.loads(
        subprocess.check_output(
            [node, "--input-type=module", "-e", code, str(static)], cwd=root / "frontend", text=True
        )
    )


def prepare(args):
    root = Path(__file__).resolve().parents[1]
    mvp_path, bi, static = args.mvp.resolve(), args.bi.resolve(), args.static.resolve()
    mvp = json.loads(mvp_path.read_text())
    csv_path = bi / "data/processed/data/processed_data.csv"
    rows = list(csv.DictReader(csv_path.open()))
    original = typescript_data(args.node, root, static)
    bundle = {
        name: []
        for name in [
            "members",
            "quarters",
            "vehicles",
            "memberships",
            "receipts",
            "events",
            "signups",
            "driver_registrations",
            "trips",
            "payouts",
            "boards",
            "recaps",
            "media",
        ]
    }
    bundle.update(
        version=1,
        manifest={
            "mvp_sha256": digest(mvp_path),
            "bi_csv_sha256": digest(csv_path),
            "static_files": {n: digest(static / f"src/data/{n}.ts") for n in original},
        },
    )
    accounting = {
        "mvp": {k: len(v) for k, v in mvp.items()},
        "bi": dict(Counter(r["record_type"] for r in rows)),
        "bi_people": 0,
        "collapsed_submissions": 0,
        "superseded_bi_reimbursements": 0,
        "malformed_contacts": [],
        "merged_members": [],
        "event_aliases": [],
    }
    bundle["accounting"] = accounting
    profiles, parent = {}, {}

    def person(key, **fields):
        parent[key] = key
        profiles[key] = fields

    def find(key):
        if parent[key] != key:
            parent[key] = find(parent[key])
        return parent[key]

    def merge(primary, secondary, reason):
        a, b = find(primary), find(secondary)
        if a != b:
            parent[b] = a
            accounting["merged_members"].append({"primary": a, "secondary": b, "reason": reason})

    current_membership = {r["participant_id"]: r for r in mvp["club_memberships"]}
    for row in sorted(mvp["club_participants"], key=lambda r: r["id"]):
        person(
            f"mvp:participant:{row['id']}",
            name=row["name"],
            email=row["email"],
            phone=row["phone"],
            discord=row["discord"],
            driving_preferences=row["driving"],
            student=current_membership.get(row["id"], {}).get("student", True),
            created_at=instant(row["created_at"]),
            aliases=[row["email"]],
        )
    for row in mvp["drivers"]:
        person(f"mvp:driver:{row['id']}", name=row["name"], email=row["email"], aliases=[row["email"]])
    for row in mvp["club_participants"]:
        if row["driver_id"]:
            merge(f"mvp:participant:{row['id']}", f"mvp:driver:{row['driver_id']}", "source foreign key")
    for driver, participant in [(12, 5), (1, 4)]:
        merge(f"mvp:participant:{participant}", f"mvp:driver:{driver}", "owner-confirmed identity")
    groups = defaultdict(list)
    for row in rows:
        groups[row["person_uuid"]].append(row)
    accounting["bi_people"] = len(groups)
    for uid, group in groups.items():
        ordered = sorted(group, key=lambda r: r["timestamp"], reverse=True)
        fields = {}
        aliases = []
        for row in ordered:
            for field, source in [
                ("name", "full_name"),
                ("phone", "phone_number"),
                ("discord", "discord_handle"),
            ]:
                if row[source] and not fields.get(field):
                    fields[field] = row[source]
            for source in ["email_address", "email_address_2"]:
                value = row[source]
                if value and not email(value):
                    accounting["malformed_contacts"].append({"person": uid, "value": value})
                if email(value) and email(value) not in aliases:
                    aliases.append(email(value))
            if "can_drive" not in fields and yes(row["willing_to_drive"]) is not None:
                fields["can_drive"] = yes(row["willing_to_drive"])
            if "student" not in fields and row["student_status"]:
                fields["student"] = row["student_status"] != "Non-UC Student/Alumni"
        preferred = next(
            (a for a in aliases if a.endswith("@uci.edu") or a.rsplit("@", 1)[1].endswith(".uci.edu")),
            aliases[0] if aliases else None,
        )
        person(f"bi:person:{uid}", **fields, email=preferred, aliases=aliases)
    seen = {}
    for key, fields in profiles.items():
        for address in fields["aliases"]:
            address = email(address)
            if not address:
                continue
            if address in seen:
                merge(seen[address], key, "normalized email")
            else:
                seen[address] = key
    combined = {}
    for key, fields in profiles.items():
        canonical = find(key)
        target = combined.setdefault(canonical, {"key": canonical, "aliases": [], "source_keys": []})
        target["source_keys"].append(key)
        for field, value in fields.items():
            if field == "aliases":
                target[field] = list(dict.fromkeys(target[field] + [email(a) for a in value if email(a)]))
            elif value is not None and value != "" and field not in target:
                target[field] = value
    for item in combined.values():
        item.setdefault("name", "Historical participant " + item["key"].rsplit(":", 1)[-1][:8])
    bundle["members"] = list(combined.values())

    quarters = {}
    for key, (name, start, end) in QUARTERS.items():
        quarters[key] = dict(
            key=key,
            name=name,
            starts_on=start,
            ends_on=end,
            reimbursement_data_available=False,
            state="archived",
            budget="0",
            driver_cap="0",
            mpg="25",
        )
    source_quarters = {}
    for row in mvp["quarters"]:
        key = row["name"][0] + row["name"][-2:]
        source_quarters[row["id"]] = key
        quarters[key] = dict(
            key=key,
            name=row["name"],
            starts_on=row["start"],
            ends_on=row["end"],
            budget=str(row["budget"]),
            driver_cap=str(row["cap"]),
            mpg=str(row["mpg"]),
            state="archived" if row["archived"] else "finalized" if row["finalized"] else "open",
            reimbursement_data_available=row["data_status"] != "no_data",
        )
    bundle["quarters"] = list(quarters.values())
    for row in mvp["club_vehicles"]:
        bundle["vehicles"].append(
            dict(
                key=f"mvp:vehicle:{row['id']}",
                member_key=find(f"mvp:participant:{row['participant_id']}"),
                **{k: row[k] for k in ["year", "make", "model", "color", "plate", "capacity"]},
                removed=not row["active"],
                source="imported",
            )
        )
    membership_index = {}
    for row in rows:
        if row["record_type"] != "membership":
            continue
        key = re.search(r"\b([FWS]\d{2})\b", row["source_file"]).group(1)
        member_key = find(f"bi:person:{row['person_uuid']}")
        record_key = f"membership:{key}:{member_key}"
        paid = row["payment_status"] == "paid"
        amount = row["payment_amount"]
        comped = paid and amount and float(amount) == 0
        membership_index[(key, member_key)] = dict(
            key=record_key,
            member_key=member_key,
            quarter_key=key,
            status="approved" if paid else "general",
            source="exception" if comped else "imported",
            student=row["student_status"] != "Non-UC Student/Alumni",
            submitted_at=instant(row["timestamp"]),
            method="other" if paid and amount and float(amount) > 0 else "",
            reason="Historical membership" if not comped else "Historical complimentary membership",
        )
        if paid and amount and float(amount) > 0:
            bundle["receipts"].append(
                dict(
                    key=f"receipt:{record_key}",
                    membership_key=record_key,
                    amount=amount,
                    paid_on=quarters[key]["ends_on"],
                    method="other",
                    reference="",
                    reason="Historical dues",
                )
            )
    for row in mvp["club_memberships"]:
        key = source_quarters[row["quarter_id"]]
        member_key = find(f"mvp:participant:{row['participant_id']}")
        membership_index[(key, member_key)] = dict(
            key=f"membership:{key}:{member_key}",
            member_key=member_key,
            quarter_key=key,
            status=row["status"],
            source="imported" if row["approval"] == "legacy" else row["approval"] or None,
            student=row["student"],
            method=row["method"],
            submitted_at=instant(row["submitted_at"]),
            reason=row["note"],
        )
    bundle["memberships"] = list(membership_index.values())
    mvp_memberships = {
        r[
            "id"
        ]: f"membership:{source_quarters[r['quarter_id']]}:{find(f'mvp:participant:{r["participant_id"]}')}"
        for r in mvp["club_memberships"]
    }
    for row in mvp["club_dues_records"]:
        membership = next(r for r in mvp["club_memberships"] if r["id"] == row["membership_id"])
        bundle["receipts"].append(
            dict(
                key=f"mvp:receipt:{row['id']}",
                membership_key=mvp_memberships[row["membership_id"]],
                amount=str(row["amount"]),
                paid_on=row["paid_on"] or quarters[source_quarters[membership["quarter_id"]]]["ends_on"],
                method=row["method"],
                reference=row["reference"],
                reason=row["note"],
                voided=row["voided"],
            )
        )

    event_index, event_lookup = {}, {}
    details = {r["event_id"]: r for r in mvp["club_event_details"]}
    for row in mvp["events"]:
        starts, ends = date_bounds(row["date"])
        detail = details.get(row["id"])
        item = dict(
            key=f"mvp:event:{row['id']}",
            quarter_key=source_quarters[row["quarter_id"]],
            name=row["name"],
            destination=row["destination"],
            kind="regular",
            starts_at=starts,
            ends_at=ends,
            state="completed",
            signups_enabled=True,
            miles=str(row["miles"]),
            rate_override=str(row["rate"]),
        )
        if detail:
            item.update(
                state=detail["state"],
                starts_at=instant(detail["meet_at"]),
                ends_at=instant(detail["return_at"]) or ends,
                arrival_at=instant(detail["meet_at"]),
                departure_at=instant(detail["depart_at"]),
                return_at=instant(detail["return_at"]),
                opens_at=instant(detail["opens_at"]),
                closes_at=instant(detail["closes_at"]),
                packing=detail["packing"],
                questions=detail["questions"],
                description=detail["description"],
                paid_cards=detail["paid_cards"],
                general_cards=detail["general_cards"],
            )
        event_index[item["key"]] = item
        event_lookup[(item["quarter_key"], row["date"], item["name"])] = item["key"]
    selected = {}
    for index, row in enumerate(rows):
        kind = row["record_type"]
        if kind == "driver_reimbursement":
            accounting["superseded_bi_reimbursements"] += 1
            continue
        if kind not in {"event", "retreat"}:
            continue
        meta = json.loads(row["metadata_json"] or "{}")
        if kind == "retreat":
            qkey = row["retreat_season"]
            name, first, last = RETREATS[qkey]
            event_key = "retreat:" + qkey
        else:
            qkey, first = meta["quarter"], meta["event_date"]
            last = first
            name = (
                MVP_EVENT_NAMES.get(meta["event_name"], meta["event_name"])
                if qkey == "W26"
                else meta["event_name"]
            )
            event_key = event_lookup.get(
                (qkey, first, name),
                "bi:event:" + hashlib.sha256(row["source_file"].encode()).hexdigest()[:16],
            )
        if event_key not in event_index:
            starts, ends = date_bounds(first, last)
            event_index[event_key] = dict(
                key=event_key,
                quarter_key=qkey,
                name=name,
                destination=name,
                kind="retreat" if kind == "retreat" else "regular",
                starts_at=starts,
                ends_at=ends,
                state="completed",
                signups_enabled=True,
            )
            event_lookup[(qkey, first, name)] = event_key
        if kind == "event" and name != meta["event_name"]:
            alias = {"source": meta["event_name"], "target": event_key}
            if alias not in accounting["event_aliases"]:
                accounting["event_aliases"].append(alias)
        pair = (event_key, find(f"bi:person:{row['person_uuid']}"))
        if pair in selected:
            accounting["collapsed_submissions"] += 1
        if pair not in selected or (row["timestamp"], index) > selected[pair][:2]:
            selected[pair] = (row["timestamp"], index, row)
    for (event_key, member_key), (_, index, row) in selected.items():
        role, seats = ride(row)
        answers = {k: row[k] for k in QUESTION_FIELDS if row.get(k)}
        event = event_index[event_key]
        if event["kind"] == "retreat":
            existing = {q["id"]: q for q in event.get("questions", [])}
            for key in answers:
                existing[key] = dict(
                    id=key, label=key.replace("_", " ").capitalize(), kind="long", required=False, options=[]
                )
            event["questions"] = list(existing.values())
        bundle["signups"].append(
            dict(
                key=f"bi:signup:{index}",
                event_key=event_key,
                member_key=member_key,
                role=role,
                seats=seats,
                joined_at=instant(row["timestamp"]),
                answers=answers,
                notes=row["comments_concerns_questions"] or row["retreat_comments_suggestions"],
                source="imported",
            )
        )
    checkins = {r["signup_id"]: r for r in mvp["club_checkins"] if not r["undone_at"]}
    for row in mvp["club_signups"]:
        bundle["signups"].append(
            dict(
                key=f"mvp:signup:{row['id']}",
                event_key=f"mvp:event:{row['event_id']}",
                member_key=find(f"mvp:participant:{row['participant_id']}"),
                role=row["role"],
                seats=row["seats"],
                vehicle_key=f"mvp:vehicle:{row['vehicle_id']}" if row["vehicle_id"] else None,
                vehicle={k: row["vehicle"].get(k) for k in ["year", "make", "model", "color", "plate", "capacity"]}
                if row["vehicle"] else None,
                joined_at=instant(row["joined_at"]),
                checked_in_at=instant(checkins.get(row["id"], {}).get("at")),
                cancelled=row["status"] != "active",
                answers=row["answers"],
                notes=row["notes"],
                extended_until=instant(row["extension_until"]),
                source="imported",
            )
        )
    for row in mvp["memberships"]:
        bundle["driver_registrations"].append(
            dict(
                key=f"mvp:registration:{row['id']}",
                quarter_key=source_quarters[row["quarter_id"]],
                member_key=find(f"mvp:driver:{row['driver_id']}"),
                eligible_override=row["eligible"],
                reason="MVP quarter eligibility",
            )
        )
    for row in mvp["trips"]:
        bundle["trips"].append(
            dict(
                key=f"mvp:trip:{row['id']}",
                member_key=find(f"mvp:driver:{row['driver_id']}"),
                event_key=f"mvp:event:{row['event_id']}",
                cost_override=str(row["override"]) if row["override"] is not None else None,
                notes=row["notes"],
                source="imported",
            )
        )
    for row in mvp["payouts"]:
        key = source_quarters[row["quarter_id"]]
        bundle["payouts"].append(
            dict(
                key=f"mvp:payout:{row['id']}",
                member_key=find(f"mvp:driver:{row['driver_id']}"),
                quarter_key=key,
                amount=str(row["amount"]),
                paid_on=row["paid_at"] or (quarters[key]["ends_on"] if row["is_paid"] else None),
                reference=row["reference"],
            )
        )

    def image(path, purpose):
        source = static / "public" / path.lstrip("/")
        key = purpose + ":" + digest(source)
        if not any(r["key"] == key for r in bundle["media"]):
            bundle["media"].append(
                dict(key=key, purpose=purpose, data=base64.b64encode(source.read_bytes()).decode())
            )
        return key

    for year, officers in [(2024, original["previousOfficers"][0]["officers"]), (2025, original["officers"])]:
        entries = []
        for position, row in enumerate(officers):
            entries.append(
                dict(
                    name=row["name"],
                    role=row["role"],
                    major=row.get("major", ""),
                    bio=row.get("whyJoined", ""),
                    memory=row.get("favoriteMemory", ""),
                    instagram=row.get("instagram", ""),
                    position=position,
                    photo_key=image(row["imagePath"], "board") if row.get("imagePath") else None,
                )
            )
        bundle["boards"].append(
            dict(
                key=f"static:board:{year}",
                label=f"{year}–{year + 1}",
                start_year=year,
                current=False,
                entries=entries,
            )
        )
    for row in original["pastEvents"]:
        first = datetime.strptime(row["date"], "%B %d, %Y").date().isoformat()
        qkey = next(k for k, q in quarters.items() if q["starts_on"] <= first <= q["ends_on"])
        name = STATIC_EVENT_NAMES.get(row["name"], row["name"])
        event_key = event_lookup.get((qkey, first, name), "static:event:" + row["id"])
        if event_key not in event_index:
            starts, ends = date_bounds(first)
            event_index[event_key] = dict(
                key=event_key,
                quarter_key=qkey,
                name=name,
                destination=name,
                starts_at=starts,
                ends_at=ends,
                state="completed",
                signups_enabled=False,
                kind="meeting" if "Fair" in name else "regular",
            )
        photo = image(row["imagePath"], "event")
        event_index[event_key]["photo_key"] = photo
        if not event_index[event_key].get("description"):
            event_index[event_key]["description"] = row["description"]
        bundle["recaps"].append(
            dict(
                key="static:recap:" + row["id"],
                event_key=event_key,
                image_key=photo,
                title=row["name"],
                caption=row["name"],
                text=row["description"],
                homepage=True,
            )
        )
    bundle["events"] = list(event_index.values())
    bundle["manifest"]["counts"] = {k: len(v) for k, v in bundle.items() if isinstance(v, list)}
    return bundle


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mvp", type=Path, required=True)
    parser.add_argument("--bi", type=Path, required=True)
    parser.add_argument("--static", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--node", default="node")
    args = parser.parse_args()
    bundle = prepare(args)
    os.umask(0o077)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(bundle, ensure_ascii=False) + "\n")
    print(json.dumps(bundle["manifest"]["counts"], sort_keys=True))


if __name__ == "__main__":
    main()
