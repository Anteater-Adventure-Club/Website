from collections.abc import Generator
import re
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from fastapi import Request


class Base(DeclarativeBase):
    pass


def make_engine(url: str):
    return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5, hide_parameters=True)


def get_db(request: Request) -> Generator[Session, None, None]:
    with request.app.state.sessions() as db:
        db.info["request_id"] = getattr(request.state, "request_id", None)
        try:
            if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
                from .services.restrictions import restriction_lock

                exclusive = bool(re.fullmatch(r"/api/admin/members/[^/]+/bans(?:/[^/]+/lift)?", request.url.path))
                restriction_lock(db, exclusive=exclusive)
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise


def session_factory(engine):
    from .services.sheets_queue import install_hooks

    install_hooks()
    return sessionmaker(engine, expire_on_commit=False)
