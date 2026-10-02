"""One locked schema initialization before workers start, using the migration role."""
import os

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

url = os.environ.pop("MIGRATION_DATABASE_URL", os.environ["DATABASE_URL"])
engine = create_engine(url, hide_parameters=True, pool_pre_ping=True)
with engine.connect() as connection:
    connection.execute(text("SELECT pg_advisory_lock(710)"))
    config = Config("alembic.ini")
    config.attributes["connection"] = connection
    command.upgrade(config, "head")
    runtime_role = make_url(os.environ["DATABASE_URL"]).username
    if runtime_role != make_url(url).username:
        identifier = connection.dialect.identifier_preparer.quote(runtime_role)
        connection.execute(text(f"GRANT USAGE ON SCHEMA public TO {identifier}"))
        connection.execute(text(f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {identifier}"))
        connection.execute(text(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {identifier}"))
        connection.execute(text(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {identifier}"))
        connection.execute(text(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO {identifier}"))
    connection.commit()
    connection.execute(text("SELECT pg_advisory_unlock(710)"))
engine.dispose()
os.execvp("uvicorn", ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", os.environ.get("PORT", "8000"), "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", os.environ.get("FORWARDED_ALLOW_IPS", "127.0.0.1"), "--no-access-log"])
