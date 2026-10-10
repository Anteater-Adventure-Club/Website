from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from fastapi import Request


class Base(DeclarativeBase):
    pass


def make_engine(url: str):
    return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5, hide_parameters=True)


def get_db(request: Request) -> Generator[Session, None, None]:
    with request.app.state.sessions() as db:
        try:
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise


def session_factory(engine):
    return sessionmaker(engine, expire_on_commit=False)
