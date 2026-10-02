"""Paced HTTP acceptance against an isolated, loopback-only load application."""
import argparse
import asyncio
import json
import math
import time
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

import httpx

BASE = "http://127.0.0.1:18001"


def metrics(values):
    values = sorted(values)
    return {"requests": len(values), "p50_ms": round(values[math.ceil(len(values) * .5) - 1], 1), "p95_ms": round(values[math.ceil(len(values) * .95) - 1], 1), "max_ms": round(values[-1], 1)} if values else {"requests": 0}


async def phase(client, fixture, users, seconds):
    samples = defaultdict(list)
    errors = []
    writes = set()
    end = time.monotonic() + seconds
    events = fixture["events"][1:]

    async def send(person, route, method="GET", body=None, desk=False):
        started = time.monotonic()
        category = "mutation" if method != "GET" else "read"
        try:
            response = await client.request(method, route, json=body, headers={"Cookie": "aac_session=" + person["cookie"], "Origin": BASE})
            if response.status_code >= 400:
                errors.append({"status": response.status_code, "method": method, "route": route})
            elif category == "mutation":
                data = response.json()
                if data["member_id"] != person["id"]:
                    errors.append({"status": "identity_mismatch", "method": method, "route": route})
                else:
                    writes.add((person["id"], data["event_id"]))
        except httpx.HTTPError as error:
            errors.append({"status": type(error).__name__, "method": method, "route": route})
        elapsed = (time.monotonic() - started) * 1000
        samples[category].append(elapsed)
        if desk:
            samples["desk"].append(elapsed)

    async def browse(index):
        person = fixture["members"][200 + index if users == 50 else 300 + index]
        iteration = 0
        await asyncio.sleep(index / users)
        while time.monotonic() < end:
            started = time.monotonic()
            event_id = events[(iteration // 6 + index) % len(events)]
            choices = ["/api/home", f"/api/events?from={fixture['from']}&to={fixture['to']}&limit=100", f"/api/events/{event_id}", "/api/me/signups?limit=200", f"/api/me/memberships/{fixture['quarter']}"]
            step = iteration % 6
            if step == 5:
                await send(person, f"/api/events/{event_id}/signup", "PUT", {"role": "ride", "request_id": f"load-{users}-{index}-{iteration}"})
            else:
                await send(person, choices[step])
            iteration += 1
            await asyncio.sleep(max(0, 1 - (time.monotonic() - started)))

    async def desk(index):
        person = fixture["members"][index]
        await asyncio.sleep(index / 10)
        while time.monotonic() < end:
            started = time.monotonic()
            await send(person, f"/api/admin/events/{fixture['field_event']}/check-in", desk=True)
            await asyncio.sleep(max(0, 2 - (time.monotonic() - started)))

    started = time.monotonic()
    await asyncio.gather(*(browse(index) for index in range(users)), *(desk(index) for index in range(10)))
    result = {"users": users, "desks": 10, "duration_seconds": round(time.monotonic() - started, 1), "pacing_seconds": {"users": 1, "desks": 2}, "metrics": {category: metrics(values) for category, values in samples.items()}, "unexpected_errors": len(errors), "error_examples": errors[:10], "successful_signup_pairs": sorted(writes)}
    total = len(samples["read"]) + len(samples["mutation"])
    result["error_rate"] = len(errors) / total
    result["targets_pass"] = result["error_rate"] < .01 and result["metrics"]["read"]["p95_ms"] < 300 and result["metrics"]["mutation"]["p95_ms"] < 750
    print(json.dumps({key: value for key, value in result.items() if key != "successful_signup_pairs"}), flush=True)
    return result


async def main(args):
    fixture = json.loads(args.fixture.read_text())
    limits = httpx.Limits(max_connections=150, max_keepalive_connections=150)
    async with httpx.AsyncClient(base_url=BASE, timeout=15, limits=limits, trust_env=False) as client:
        ready = await client.get("/api/health/ready")
        ready.raise_for_status()
        report = {"started_at": datetime.now(UTC).isoformat(), "base_url": BASE, "release": ready.json(), "fixtures": fixture["counts"], "measurement": "HTTP over SSH loopback tunnel to isolated Docker API on lab0-apps; external OAuth and TLS excluded", "phases": []}
        for users, seconds in [(50, args.steady_seconds), (100, args.burst_seconds)]:
            report["phases"].append(await phase(client, fixture, users, seconds))
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    if not all(phase["targets_pass"] for phase in report["phases"]):
        raise SystemExit("One or more load acceptance targets failed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixture", type=Path, default=Path("artifacts/load-fixtures.json"))
    parser.add_argument("--output", type=Path, default=Path("artifacts/load-results.json"))
    parser.add_argument("--steady-seconds", type=int, default=300)
    parser.add_argument("--burst-seconds", type=int, default=60)
    args = parser.parse_args()
    if args.steady_seconds < 10 or args.burst_seconds < 10:
        parser.error("Each phase must run for at least ten seconds")
    asyncio.run(main(args))
