import logging
import json
import sys
import time
import asyncio
from pathlib import Path
from uuid import uuid4
from contextlib import asynccontextmanager
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from starlette.middleware.sessions import SessionMiddleware
from .auth import bootstrap, make_oauth, router as auth_router
from .config import Settings
from .db import make_engine, session_factory
from .schemas import SiteSettings
from .routers import editorial, events, finance, imports, members, overview, participation, social

logger = logging.getLogger("aac.http")
if not logger.handlers:
    logger.addHandler(logging.StreamHandler(sys.stdout))
logger.setLevel(logging.INFO)
logger.propagate = False


def create_app(settings=None, engine=None):
    settings = (settings or Settings()).validate()
    migration_config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    schema_head = ScriptDirectory.from_config(migration_config).get_current_head()
    engine = engine or make_engine(settings.database_url)
    sessions = session_factory(engine)

    @asynccontextmanager
    async def lifespan(app):
        # Keep synchronous authentication/handlers below the ten-connection
        # pool capacity so waiting dependencies cannot exhaust worker threads.
        app.state.request_limit = asyncio.Semaphore(8)
        with sessions() as db:
            bootstrap(db, settings)
        yield
        engine.dispose()

    app = FastAPI(
        title="Anteater Adventure Club",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None if settings.environment == "production" else "/api/docs",
        openapi_url="/api/openapi.json",
    )
    app.state.settings, app.state.sessions, app.state.oauth = settings, sessions, make_oauth(settings)
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret,
        session_cookie="aac_session",
        max_age=28800,
        same_site="lax",
        https_only=settings.app_url.startswith("https://"),
    )

    @app.middleware("http")
    async def boundaries(request: Request, call_next):
        start = time.monotonic()
        request_id = uuid4().hex
        response = None
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            origin = request.headers.get("origin")
            if (origin and origin != settings.app_url) or (request.cookies.get("aac_session") and not origin):
                response = JSONResponse(
                    {"detail": {"code": "origin_rejected", "message": "Reload this page before submitting."}},
                    status_code=403,
                )
        if response is None:
            async with request.app.state.request_limit:
                response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        sharing_image = (request.url.path.startswith("/api/share-images/")
                         and request.method in {"GET", "HEAD"} and response.status_code in {200, 304})
        if request.url.path.startswith("/api/") and not request.url.path.startswith("/api/health/") and not sharing_image:
            response.headers["Cache-Control"] = "no-store"
        logger.info(
            json.dumps({"request_id": request_id, "method": request.method,
                        "route": getattr(request.scope.get("route"), "path", request.url.path),
                        "status": response.status_code, "duration_ms": round((time.monotonic() - start) * 1000, 1),
                        "release_sha": settings.release_sha}),
        )
        return response

    @app.exception_handler(IntegrityError)
    async def conflict(request, exc):
        return JSONResponse(
            {
                "detail": {
                    "code": "record_conflict",
                    "message": "This record changed or already exists. Refresh and try again.",
                }
            },
            status_code=409,
        )

    @app.get("/api/health/live")
    def live():
        return {"status": "ok", "release_sha": settings.release_sha}

    @app.get("/api/health/ready")
    def ready():
        try:
            with engine.connect() as connection:
                actual = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
                if actual != schema_head:
                    raise RuntimeError("Unexpected schema revision")
            return {"status": "ok", "release_sha": settings.release_sha}
        except Exception:
            return JSONResponse({"status": "unavailable"}, status_code=503)

    @app.get("/api/site-settings", response_model=SiteSettings)
    def site_settings():
        return {
            "venmo": settings.venmo,
            "zelle": settings.zelle,
            "zelle_name": settings.zelle_name,
            "cash": settings.cash,
            "discord": settings.discord,
        }

    for router in (
        auth_router,
        events.router,
        members.router,
        participation.router,
        finance.router,
        editorial.router,
        imports.router,
        overview.router,
        social.router,
    ):
        app.include_router(router)
    return app


app = create_app()
