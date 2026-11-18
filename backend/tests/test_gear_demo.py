"""Exercise seed recovery without writing to either running demo."""

from pathlib import Path
import runpy
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import func, select, text
from sqlalchemy.orm import sessionmaker

from app.models import GearRental, Marker, Member


def test_seed_is_atomic_on_first_run_and_reseed(engine, monkeypatch):
    root = Path(__file__).resolve().parents[2]
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://aac:aac@127.0.0.1:55432/aac_gear_demo_test")
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("APP_URL", "http://127.0.0.1:5179")
    monkeypatch.setenv("GEAR_DEMO_PORT", "5179")
    monkeypatch.setenv("INITIAL_OFFICER_EMAILS", "officer@uci.edu")
    seed = runpy.run_path(str(root / "scripts/gear-demo.py"))["seed"]
    with engine.connect() as connection:
        schema = "gear_seed_" + uuid4().hex
        connection.execute(text(f"CREATE SCHEMA {schema}"))
        connection.execute(text(f"SET LOCAL search_path TO {schema}"))
        config = Config(str(root / "backend/alembic.ini"))
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
        sessions = sessionmaker(bind=connection, join_transaction_mode="create_savepoint")
        monkeypatch.setitem(seed.__globals__, "sessions", sessions)

        def interrupt(*args):
            raise RuntimeError("interrupted during fixture creation")

        with monkeypatch.context() as failure:
            failure.setitem(seed.__globals__, "seed_previous_quarter_rental", interrupt)
            with pytest.raises(RuntimeError, match="interrupted"):
                seed()
        assert connection.scalar(select(func.count()).select_from(Member)) == 0
        seed()
        with sessions.begin() as db:
            existing = db.scalar(select(GearRental).limit(1))
            existing.activity = "Preserve this trip"
        with monkeypatch.context() as failure:
            failure.setitem(seed.__globals__, "seed_previous_quarter_rental", interrupt)
            with pytest.raises(RuntimeError, match="interrupted"):
                seed()
        assert connection.scalar(select(GearRental.id).where(GearRental.activity == "Preserve this trip"))
        seed()
        assert not connection.scalar(select(GearRental.id).where(GearRental.activity == "Preserve this trip"))
        with sessions.begin() as db:
            db.delete(db.get(Marker, "gear_demo"))
        with pytest.raises(SystemExit, match="not created by the demo seeder"):
            seed()
