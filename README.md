# Anteater Adventure Club website

AAC's public website, member portal, and officer workspace, built with React, FastAPI, and PostgreSQL. The implementation lives on `aac-rebuild` in [Anteater-Adventure-Club/Website](https://github.com/Anteater-Adventure-Club/Website/tree/aac-rebuild). This branch replaces the site's architecture while retaining its Git history.

The internal deployment is **https://aac.internal.gdodge.dev**. Coolify builds two independent applications from repository Dockerfiles on branch pushes; PostgreSQL is a separate private resource. Deployment status and remaining acceptance work are recorded in [docs/execution-status.md](docs/execution-status.md).

## Local development

Use Python 3.12, Node 22, and PostgreSQL 17. Create a disposable local PostgreSQL instance with database/user/password `aac` on port 55432, or set `DATABASE_URL` to your own development database. Never point test or fixture commands at a durable database.

```sh
python3.12 -m venv .venv
.venv/bin/pip install -r backend/requirements-dev.txt
cp .env.example .env
```

Load the configuration into your process environment. From `backend/`, run `../.venv/bin/alembic upgrade head`, then `../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000`. From `frontend/`, run `npm ci` and `npm run dev`. Vite forwards `/api/` and `/media/` to the local API. Configure a Google OAuth client and a matching `/api/auth/callback` redirect to test actual sign-in; there is no development-login route.

## Checks

From `backend/`: `../.venv/bin/pytest -q` and `../.venv/bin/ruff check .`. Tests use the disposable `TEST_DATABASE_URL` (default local `aac`). From `frontend/`: `npm run build` and `npm test`. Run `npm run api:types` after regenerating `backend/openapi.json` when API contracts change.

Browser checks use a separate `aac_browser` database on local port 55432. Run `.venv/bin/python scripts/seed-browser-fixtures.py`, start the API with its documented synthetic session configuration, then run `npm run test:e2e` from `frontend/`. The guarded seeder refuses non-local database URLs, records fixture cookies only in ignored `artifacts/`, and provides no authentication bypass in the deployed application.

## Design and operations

- [Implementation plan](docs/implementation-plan.md): features, stack, milestones, and acceptance requirements.
- [View matrix](docs/view-matrix.md): every supplied panel and state.
- [API gap matrix](docs/api-gap-matrix.md): MVP behavior and new requirements.
- [Decisions](docs/decisions.md): accepted workflow choices.
- [Deployment plan](docs/deployment-plan.md): separate resources, OAuth, push deployment, and recovery requirements.
- [Verification](docs/verification.md): viewport, workflow, security, and performance checks.

Runtime credentials belong in Coolify or an ignored local secrets directory. Production initialization creates the clean schema and configured initial officer identity; it does not transfer old data or seed demo quarters, members, events, or payments.
