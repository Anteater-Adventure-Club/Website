"""75 simultaneous HTTP applicants for 10 remaining places on an isolated local API.

Requires a newly migrated, empty aac_retreat_benchmark_<timestamp> database.
Starts one Uvicorn process on loopback, writes synthetic logs and a JSON report.
"""
import asyncio
import base64
import json
import math
import os
import platform
import re
import subprocess
import sys
import time
from contextlib import AsyncExitStack
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

import httpx
from itsdangerous import TimestampSigner
from sqlalchemy import func, select
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.db import make_engine, session_factory  # noqa: E402
from app.domain import today, utcnow  # noqa: E402
from app.models import Event, Member, Membership, Quarter, Signup  # noqa: E402

BASE = "http://127.0.0.1:18001"
SECRET = "aac-retreat-benchmark-only-secret-12345678901234567890"


def stats(values):
    values = sorted(values)
    return {"requests": len(values), "p50_ms": round(values[math.ceil(len(values)*.5)-1], 2),
            "p95_ms": round(values[math.ceil(len(values)*.95)-1], 2), "max_ms": round(values[-1], 2)}


def cookie(mid):
    payload = base64.b64encode(json.dumps({"member_id": mid, "login_at": int(time.time())}).encode())
    return TimestampSigner(SECRET).sign(payload).decode()


async def benchmark(sessions, people, quarter_id):
    results = []
    async with AsyncExitStack() as stack:
        client = await stack.enter_async_context(httpx.AsyncClient(base_url=BASE, timeout=60))
        # Separate connection pools model separate browsers and avoid contention
        # in one shared 225-connection client pool. Expire idle sockets before
        # Uvicorn's default five-second keep-alive timeout.
        clients = {mid: await stack.enter_async_context(httpx.AsyncClient(
            base_url=BASE, timeout=60,
            limits=httpx.Limits(max_connections=6, max_keepalive_connections=6, keepalive_expiry=2),
        )) for mid in people[38:]}
        for _ in range(100):
            try:
                if (await client.get('/api/health/ready')).status_code == 200:
                    break
            except httpx.HTTPError:
                pass
            await asyncio.sleep(.1)
        else:
            raise RuntimeError("Benchmark API did not become ready")
        for repeat in range(5):
            for enabled in [False, True]:
                with sessions() as db:
                    start = utcnow() + timedelta(days=2)
                    e = Event(quarter_id=quarter_id, name=f"Synthetic retreat {repeat} logging={enabled}",
                              kind="retreat", state="published", starts_at=start, ends_at=start+timedelta(days=2),
                              general_signup_opens_at=utcnow()-timedelta(minutes=1), signup_cap_total=48,
                              activity_logging=enabled)
                    db.add(e)
                    db.flush()
                    eid = e.id
                    db.add_all(Signup(event_id=eid, member_id=p, role="own") for p in people[:38])
                    db.commit()
                applicants = people[38:]
                attempts = {mid: str(uuid4()) for mid in applicants}

                def headers(mid):
                    return {"Cookie": "aac_session="+cookie(mid), "Origin": BASE, "X-AAC-Attempt-ID": attempts[mid]}

                async def view(mid):
                    started = time.perf_counter()
                    client = clients[mid]
                    responses = await asyncio.gather(*(
                        client.get(url, headers=headers(mid)) for url in [
                            f'/api/events/{eid}', f'/api/me/signups?event_id={eid}',
                            f'/api/me/memberships/{quarter_id}',
                        ]
                    ))
                    for response in responses:
                        response.raise_for_status()
                    if enabled:
                        r = await client.post(f'/api/events/{eid}/activity', headers=headers(mid), json={"action":"page_view"})
                        r.raise_for_status()
                    return (time.perf_counter()-started)*1000

                page_times = await asyncio.gather(*(view(mid) for mid in applicants))

                async def apply(mid):
                    started = time.perf_counter()
                    client = clients[mid]
                    signal = asyncio.create_task(client.post(f'/api/events/{eid}/activity', headers=headers(mid),
                        json={"action":"signup_attempt", "attempt_id":attempts[mid]})) if enabled else None
                    response = await client.put(f'/api/events/{eid}/signup', headers=headers(mid), json={"role":"ride"})
                    elapsed = (time.perf_counter()-started)*1000
                    if signal:
                        assert (await signal).status_code == 204
                    return {"member_id":mid, "status":response.status_code, "ms":elapsed,
                            "code":response.json().get('detail',{}).get('code')}

                started = time.perf_counter()
                responses = await asyncio.gather(*(apply(mid) for mid in applicants))
                duration = time.perf_counter()-started
                winners = [r['member_id'] for r in responses if r['status'] == 200]
                losers = [r['member_id'] for r in responses if r['status'] == 409 and r['code'] == 'signup_capacity']
                assert len(winners) == 10 and len(losers) == 65, responses
                with sessions() as db:
                    active = list(db.scalars(select(Signup.member_id).where(Signup.event_id == eid, Signup.cancelled.is_(False))))
                    assert len(active) == 48 and set(active)-set(people[:38]) == set(winners)
                    assert db.scalar(select(func.count()).select_from(Membership)) == 0
                for mid in [winners[0], losers[0]]:
                    r = await clients[mid].post(f'/api/me/memberships/{quarter_id}', headers=headers(mid), json={"method":"zelle", "student":True, "phone":"9495550100"})
                    assert r.status_code == 409 and r.json()['detail']['code'] == 'membership_signups_paused'
                result = {"repeat":repeat+1, "logging":enabled, "event_id":eid, "applicants":75, "remaining_places":10,
                          "winners":len(winners), "capacity_rejections":len(losers), "unexpected_errors":0,
                          "database_active_signups":48, "burst_seconds":round(duration,3),
                          "signup_latency":stats([r['ms'] for r in responses]), "page_flow_latency":stats(page_times),
                          "signup_latency_samples_ms":[round(r['ms'], 2) for r in responses],
                          "winner_ids":winners}
                results.append(result)
                print(json.dumps(result), flush=True)
    return results


def main():
    url = os.environ.get('DATABASE_URL', '')
    parsed = make_url(url)
    if parsed.host != '127.0.0.1' or not re.fullmatch(r'aac_retreat_benchmark_\d{14}', parsed.database or ''):
        raise SystemExit('Refusing to benchmark outside a freshly named local disposable database')
    engine = make_engine(url)
    sessions = session_factory(engine)
    with sessions() as db:
        if db.scalar(select(func.count()).select_from(Member)):
            raise SystemExit('Benchmark database must be empty')
        q = Quarter(name='Synthetic retreat benchmark', starts_on=today()-timedelta(days=1), ends_on=today()+timedelta(days=90),
                    membership_pause_starts_at=utcnow()-timedelta(hours=1), membership_pause_ends_at=utcnow()+timedelta(hours=2),
                    membership_pause_message='Synthetic benchmark pause')
        db.add(q)
        members = [Member(name=f'Benchmark Member {i}', email=f'bench{i}@example.com', phone='9495550100') for i in range(113)]
        db.add_all(members)
        db.flush()
        qid, people = q.id, [m.id for m in members]
        db.commit()
    output = ROOT/'artifacts'/'retreat-benchmark'
    output.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, 'APP_URL':BASE, 'PUBLIC_SITE_URL':BASE, 'SESSION_SECRET':SECRET,
           'INITIAL_OFFICER_EMAILS':'', 'APP_ENV':'development', 'PYTHONPATH':str(ROOT/'backend')}
    with (output/'api.log').open('w') as log:
        server = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '18001', '--no-access-log'],
                                  cwd=ROOT/'backend', env=env, stdout=log, stderr=log)
        try:
            results = asyncio.run(benchmark(sessions, people, qid))
        finally:
            server.terminate()
            server.wait(timeout=20)
    records = []
    for line in (output/'api.log').read_text().splitlines():
        if line.startswith('{'):
            record = json.loads(line)
            if record.get('type') == 'event_activity':
                records.append(record)
    for result in results:
        rows = [r for r in records if r['event_id'] == result['event_id']]
        if result['logging']:
            counts = {action:sum(r['action'] == action for r in rows) for action in ['browser.page_view','browser.signup_attempt','signup.request','signup.created','signup.rejected']}
            assert list(counts.values()) == [75,75,75,10,65], counts
            assert {r['member_id'] for r in rows if r['action'] == 'signup.created'} == set(result['winner_ids'])
            requests = {r['attempt_id']:r for r in rows if r['action'] == 'signup.request'}
            assert len(requests) == 75 and None not in requests
            for record in rows:
                if record['action'] in {'signup.created', 'signup.rejected'}:
                    original = requests[record['attempt_id']]
                    assert original['request_id'] == record['request_id'] and original['member_id'] == record['member_id']
                if record['action'] == 'signup.rejected':
                    assert record['reason'] == 'signup_capacity'
            result['verified_log_counts'] = counts
        else:
            assert not rows
    report = {'environment':{'scope':'Local loopback HTTP; one Uvicorn worker; PostgreSQL 17; no production traffic, TLS, or proxy',
                            'python':platform.python_version(), 'platform':platform.platform(), 'pool_size':5, 'max_overflow':5,
                            'request_concurrency_limit':8,
                            'client_connections':'One independent pool per applicant; max six connections, two-second idle expiry',
                            'page_flow':'75 concurrent event, own-signups, and membership reads; page-view signal when enabled',
                            'signup_flow':'75 concurrent signup requests, with concurrent browser-attempt signals when enabled'},
              'aggregate':{str(enabled).lower():stats([v for r in results if r['logging'] == enabled
                                                      for v in r['signup_latency_samples_ms']]) for enabled in [False, True]},
              'runs':results}
    (output/'results.json').write_text(json.dumps(report, indent=2)+'\n')
    engine.dispose()


if __name__ == '__main__':
    main()
