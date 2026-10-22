"""Spreadsheet rows: headerless name/email/phone TSV, or CSV/TSV with headers."""

import csv
import io
from datetime import datetime, timezone
from fastapi import HTTPException
from ..domain import local_instant


HEADER_ALIASES = {
    "uci email": "email",
    "phone number": "phone",
    "discord handle": "discord",
    "ride situation?": "ride_situation",
    "for drivers: how many passengers are you willing to take?": "seats",
}
RIDE_RESPONSES = {
    "i need a ride!": "ride",
    "i have my own ride and can provide rides to others! (thank you!!)": "driver",
    "i have my own ride!": "own",
}


def event_fields(raw, default_role):
    response = " ".join(raw.get("ride_situation", "").lower().split())
    role = RIDE_RESPONSES.get(response, response or default_role)
    if role not in {"ride", "driver", "own"}:
        raise ValueError("Unknown ride situation; choose needs a ride, driving others, or own ride")
    seats = 0
    if role == "driver":
        value = raw.get("seats", "")
        if not value.isascii() or not value.isdecimal() or not 1 <= int(value) <= 50:
            raise ValueError("Drivers need a whole passenger count from 1 to 50, excluding the driver")
        seats = int(value)
    joined_at = None
    if raw.get("timestamp"):
        try:
            parsed = datetime.strptime(raw["timestamp"], "%m/%d/%Y %H:%M:%S")
            local = local_instant(parsed.date(), parsed.time())
            joined_at = local.astimezone(timezone.utc)
            if joined_at.astimezone(local.tzinfo).replace(tzinfo=None) != local.replace(tzinfo=None):
                raise ValueError("Nonexistent local time")
        except ValueError:
            raise ValueError("Timestamp must be a valid Pacific time in M/D/YYYY H:mm:ss format")
    return {"role": role, "seats": seats, "joined_at": joined_at}


def read_rows(content):
    content = content.lstrip("\ufeff")
    first = next((line for line in content.splitlines() if line.strip()), "")
    if not first:
        raise HTTPException(422, "Paste or upload at least one row")
    delimiter = "\t" if "\t" in first else ","
    reader = csv.reader(io.StringIO(content), delimiter=delimiter, strict=True)
    rows = []
    headers = None
    seen_first = False
    try:
        for values in reader:
            if not values or not any(v.strip() for v in values):
                continue
            values = [v.strip() for v in values]
            if not seen_first:
                seen_first = True
                normalized = [HEADER_ALIASES.get(v.lower(), v.lower()) for v in values]
                if {"name", "email"} <= set(normalized):
                    if len(set(normalized)) != len(normalized):
                        raise HTTPException(422, "Column headers must be unique")
                    headers = normalized
                    continue
                headers = ["name", "email", "phone"]
            if len(rows) >= 1000:
                raise HTTPException(422, "Import at most 1000 people at a time")
            if len(values) != len(headers):
                rows.append((reader.line_num, None))
                continue
            rows.append((reader.line_num, dict(zip(headers, values))))
    except csv.Error:
        raise HTTPException(422, "Invalid CSV or tab-separated format")
    if not rows:
        raise HTTPException(422, "Include at least one person below the header")
    return rows
