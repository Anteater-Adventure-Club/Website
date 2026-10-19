"""Run with python -m app.workers.google_sheets; use --health for the container probe."""
import logging
import signal
import sys
import threading
import time
from datetime import timedelta
from pathlib import Path
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from ..config import Settings
from ..db import make_engine, session_factory
from ..domain import utcnow
from ..models import EventSheet, SheetsConnection
from ..services.sheets_queue import enqueue_access
from ..services.sheets_worker import RateLimiter, claim, heartbeat, process_job

logger = logging.getLogger("aac.sheets")


def main():
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    settings = Settings().validate()
    if not settings.sheets_enabled:
        raise SystemExit("Google Sheets worker is disabled; configure GOOGLE_SHEETS_ENABLED and its credentials.")
    engine = make_engine(settings.database_url)
    sessions = session_factory(engine)
    if "--health" in sys.argv:
        with sessions() as db:
            connection = db.get(SheetsConnection, 1)
            healthy = connection and connection.worker_seen_at and connection.worker_seen_at > utcnow() - timedelta(seconds=90)
        engine.dispose()
        raise SystemExit(0 if healthy else 1)
    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    expected = ScriptDirectory.from_config(config).get_current_head()
    with engine.connect() as db:
        if db.execute(text("SELECT version_num FROM alembic_version")).scalar_one() != expected:
            raise SystemExit("Apply the API database migration before starting the Google Sheets worker.")
    stopped = threading.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: stopped.set())
    throttle = RateLimiter()
    # A session advisory lock also serializes old/new worker containers during deployment.
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as leader:
        while not stopped.is_set() and not leader.execute(text("SELECT pg_try_advisory_lock(720)")).scalar_one():
            stopped.wait(5)
        if stopped.is_set():
            return

        def leader_check():
            if not leader.execute(text(
                "SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype='advisory' "
                "AND pid=pg_backend_pid() AND objid=720 AND granted)"
            )).scalar_one():
                raise RuntimeError("Google Sheets worker leadership was lost")

        next_reconcile = time.monotonic() + 900
        while not stopped.is_set():
            leader_check()
            heartbeat(sessions)
            if time.monotonic() >= next_reconcile:
                with sessions.begin() as db:
                    enqueue_access(db.connection(), EventSheet.access_requested == EventSheet.access_completed)
                next_reconcile = time.monotonic() + 900
            job = claim(sessions)
            if job:
                started = time.monotonic()
                try:
                    process_job(sessions, settings, job, throttle=throttle, leader_check=leader_check)
                    with sessions() as db:
                        target = db.get(EventSheet, job[0])
                        logger.info("sheet_job target=%s pending=%s sharing_pending=%s error=%s duration_seconds=%.1f",
                                    target.id, target.requested > target.completed,
                                    target.access_requested > target.access_completed,
                                    bool(target.error or target.access_error), time.monotonic() - started)
                except Exception as error:
                    # Never log Google payloads, OAuth credentials, or participant data.
                    logger.error("sheet_worker_failure type=%s", type(error).__name__)
                    leader_check()
                    stopped.wait(5)
            else:
                stopped.wait(5)
        leader.execute(text("SELECT pg_advisory_unlock(720)"))
    engine.dispose()


if __name__ == "__main__":
    main()
