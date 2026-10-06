# Anteater Adventure Club 🌲

This is the GitHub repository for the **Anteater Adventure Club's (AAC) official website**. AAC is an official UCI RCO with the mission to foster a sense of community while making nature as accessible as possible for our college community!

The site centralizes event information, improves event signups, showcases past adventures in a media gallery, introduces the board members, and provides clear membership details and registration. Members can manage their signups and profiles, while officers coordinate carpools, check-in, dues, and driver reimbursements.

**[Visit the website](https://anteateradventureclub.com)**

[Previews](#page-previews) · [Tech stack](#tech-stack) · [Project reference](#project-reference) · [Local development](#local-development) · [Checks](#checks) · [Deployment](#deployment) · [More documentation](#more-documentation)

## Page previews

[![AAC homepage with adventure photos, navigation, and upcoming events](docs/images/readme/home.jpg)](docs/images/readme/home.jpg)

The homepage serves as the primary hub for AAC members, with dynamic event spotlights styled as polaroids and a direct link to the full Events page. Its **What we do!** section showcases the club's mission and core activities.

Screenshots show the actual application with synthetic events and accounts; names, memberships, and financial totals are illustrative. Click any image to view it at full size. Desktop captures use 1440 × 900; phone captures use 390 × 844.

| Explore the club | Plan an adventure |
| --- | --- |
| [![Homepage About section with hikes and activity photos](docs/images/readme/about.jpg)](docs/images/readme/about.jpg) | [![Events page with the monthly activity calendar](docs/images/readme/events.jpg)](docs/images/readme/events.jpg) |
| **About:** local hikes, city explorations, weekly potluck picnics in Aldrich Park, and quarterly weekend retreats. | **Events:** a monthly calendar to find and sign up for the next adventure, plus a past-event gallery that preserves the club's memories. |
| [![Board page with synthetic officer profiles](docs/images/readme/board.jpg)](docs/images/readme/board.jpg) | [![Public membership page explaining benefits and dues](docs/images/readme/membership.jpg)](docs/images/readme/membership.jpg) |
| **Board:** interactive polaroids introduce the student leaders behind AAC, with an archive of previous boards. | **Membership:** what it costs to join, the benefits of being a member, and how dues support club gear, trips, and events. |
| [![My AAC overview with a synthetic member's signups and membership](docs/images/readme/my-aac.jpg)](docs/images/readme/my-aac.jpg) | [![Officer dashboard with synthetic events, dues, and tasks](docs/images/readme/officer-dashboard.jpg)](docs/images/readme/officer-dashboard.jpg) |
| **My AAC:** membership, signups, profile, cars, and reimbursements. | **Officer tools:** events, members, dues approvals, carpools, check-in, and quarter finances. |

<p align="center">
  <a href="docs/images/readme/mobile-membership.jpg"><img src="docs/images/readme/mobile-membership.jpg" alt="Phone view of a synthetic member's paid membership" width="260"></a>
  <a href="docs/images/readme/mobile-check-in.jpg"><img src="docs/images/readme/mobile-check-in.jpg" alt="Phone view of the officer check-in desk with synthetic participants" width="260"></a>
</p>

Personal membership and the officer field desk adapt to phones for use on the trail. See the [browser preview guide](docs/local-previews.md) to reproduce these views locally.

## Tech stack

| Layer | Technology and purpose |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 7, React Router 7; responsive CSS and Lucide icons |
| Data and forms | TanStack Query for server state; React Hook Form and Zod for forms |
| API | Python 3.12, FastAPI, Pydantic, Uvicorn |
| Database | PostgreSQL 17, SQLAlchemy 2, Alembic migrations, Psycopg 3 |
| Authentication | Google OAuth through Authlib; signed sessions and server-side officer checks |
| Media | Persistent uploaded photos; Pillow-generated responsive image variants |
| Hosting | Coolify builds separate Docker images for Nginx and the API; PostgreSQL is private |
| Quality checks | Vitest, Testing Library, pytest, Ruff, Playwright, axe, GitHub Actions |

Node **24** is required; use the exact version in [`.node-version`](.node-version). Lockfiles and Dockerfiles record reproducible dependency versions.

## Project reference

| Location | What lives here |
| --- | --- |
| [`frontend/src/main.tsx`](frontend/src/main.tsx) | Entry point, routes, providers, and lazy-loaded pages |
| [`frontend/src/pages/`](frontend/src/pages/) | Public pages, My AAC, event management, officer tools, and check-in |
| [`frontend/src/components/`](frontend/src/components/) | Shared layout, UI primitives, forms, metadata, and carpool operations |
| [`frontend/src/lib/`](frontend/src/lib/) | API client, generated types, session/quarter context, images, and search |
| [`frontend/src/styles.css`](frontend/src/styles.css) | Styles, responsive layouts, and typography |
| [`frontend/public/`](frontend/public/) | Fonts, logos, and static club photos |
| [`backend/app/`](backend/app/) | Configuration, authentication, models, schemas, projections, and domain rules |
| [`backend/app/routers/`](backend/app/routers/) / [`services/`](backend/app/services/) | HTTP endpoints and application services |
| [`backend/alembic/`](backend/alembic/) | Versioned database migrations |
| [`backend/openapi.json`](backend/openapi.json) | Committed API contract used to generate frontend types |
| [`backend/tests/`](backend/tests/) / [`frontend/tests/e2e/`](frontend/tests/e2e/) | API/integration and browser tests; frontend unit tests sit beside their modules |
| [`scripts/`](scripts/) / [`assets/`](assets/) | Asset preparation, isolated fixtures, import tools, and asset versions |
| [`deploy/`](deploy/) / [CI workflow](.github/workflows/checks.yml) | Dockerfiles, Nginx, startup migrations, asset retention, and automated checks |
| [`docs/`](docs/) / [`design/`](design/) | Maintainer guides, verification evidence, and design references |

### Where to make common changes

| Change | Start here |
| --- | --- |
| Routes and navigation | `frontend/src/main.tsx` and `frontend/src/components/layout.tsx` |
| Buttons, dialogs, panels, and polaroids | `frontend/src/components/ui.tsx` |
| Page behavior and responsive styling | Its module in `frontend/src/pages/` and `frontend/src/styles.css` |
| Homepage activity copy/photos | `frontend/src/pages/home.tsx` and `frontend/public/images/` |
| Homepage adventure cards | In officer tools, open a completed event's **Recap** tab, add its photo/text, select **Feature in the homepage polaroid rotation**, then **Publish to Gallery**. Draft edits stay private until republished. |
| API behavior and database structure | `backend/app/routers/`, `services/`, `schemas.py`, and `models.py`; add an Alembic migration for schema changes |
| API types and static asset versions | Follow [Checks](#checks) and the [asset preparation guide](docs/page-speed.md) |

```mermaid
flowchart LR
    Browser[React in the browser] --> Proxy[Vite locally / Nginx in deployment]
    Proxy -->|/api and /media| API[FastAPI]
    API --> DB[(PostgreSQL)]
    API --> Media[Uploaded media]
    API --> Google[Google OAuth]
```

Browser API URLs are relative to the site. Vite forwards `/api` and `/media` to port 8000 locally; Nginx forwards them to the private API in deployment.

## Local development

### 1. Prerequisites and checkout

Use a Bash-compatible shell with Git, curl, Python **3.12** (including `venv`/pip), Node **24.21.0** as specified in `.node-version`, npm, and Docker or Podman. Install that Node version with your preferred version manager before `npm ci`. The examples assume ports **5173**, **8000**, and **55432** are available.

```bash
git clone --branch aac-rebuild https://github.com/Anteater-Adventure-Club/Website.git
cd Website
node --version
python3.12 --version
```

Run subsequent commands from the repository root unless shown otherwise. If another checkout is running, use the [isolated environment procedure](docs/local-previews.md#an-isolated-environment-when-local-ports-are-busy) instead of replacing its database or processes.

### 2. Install dependencies and create a local database

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-dev.txt
(cd frontend && npm ci)

export AAC_CONTAINER_ENGINE=podman  # or docker
"$AAC_CONTAINER_ENGINE" run -d --name aac-dev-postgres \
  -e POSTGRES_USER=aac -e POSTGRES_PASSWORD=aac -e POSTGRES_DB=aac \
  -p 127.0.0.1:55432:5432 \
  -v aac-dev-postgres-data:/var/lib/postgresql/data \
  docker.io/library/postgres:17
until "$AAC_CONTAINER_ENGINE" exec aac-dev-postgres pg_isready -U aac -d aac; do sleep 1; done
```

The named volume preserves local development data. On later visits, use `"$AAC_CONTAINER_ENGINE" start aac-dev-postgres` rather than repeating `run`. These database credentials are for local development only.

### 3. Configure and start the API

In your backend terminal, from the repository root:

```bash
export APP_ENV=development
export APP_URL=http://localhost:5173
export PUBLIC_SITE_URL=http://localhost:5173
export DATABASE_URL=postgresql+psycopg://aac:aac@127.0.0.1:55432/aac
export SESSION_SECRET="$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(48))')"
export INITIAL_OFFICER_EMAILS=your-name@uci.edu
export MEDIA_ROOT="$PWD/media"

cd backend
../.venv/bin/alembic upgrade head
../.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Replace `your-name@uci.edu` with your UCI Google account email before the first API startup if you intend to test officer access. Initial officer emails must belong to `uci.edu` or a subdomain; other addresses are ignored. Officer initialization runs once per database. A new database has the schema and initial officer identity; quarters, events, memberships, and payments start empty.

The backend reads **process environment variables**. [`.env.example`](.env.example) is a settings reference; copying it to `.env` does not load it. These exports work without an additional loader. Do not shell-source the example unchanged: some values contain unquoted spaces.

### 4. Start the frontend and verify

In a second terminal, from the repository root:

```bash
cd frontend
npm run dev -- --host localhost --port 5173 --strictPort
```

Open **http://localhost:5173**. Use `localhost` consistently in the browser because it matches `APP_URL` and the OAuth callback. In another terminal:

```bash
curl --fail http://localhost:5173/api/health/ready
curl --fail http://localhost:5173/api/home
```

Readiness should return HTTP 200. Home, Events, Board, and Membership should load; empty calendar and setup states are expected in a new database. API documentation is at **http://localhost:8000/api/docs**.

### Sign-in and populated previews

Public browsing does not require OAuth credentials. For real Google sign-in, configure a Google OAuth **Web application** client with `http://localhost:5173/api/auth/callback` as an authorized redirect URI. If its consent screen is in testing mode, add your account as a test user. Export `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the backend terminal, then restart the API with the same environment. These are backend settings, not `VITE_*` variables.

For populated member/officer views without Google credentials, follow [Local browser previews](docs/local-previews.md). That workflow uses a separate disposable database and signed fixture cookies; the deployed application has no development-login endpoint.

Stop the servers with Ctrl+C and stop PostgreSQL with `"$AAC_CONTAINER_ENGINE" stop aac-dev-postgres`. Its named volume remains available for next time.

## Checks

**Backend tests erase their database tables.** Create a dedicated `aac_test` database and always set `TEST_DATABASE_URL`; its implicit default otherwise points to the ordinary `aac` development database.

From the repository root, with PostgreSQL running:

```bash
export AAC_CONTAINER_ENGINE=podman  # or docker
"$AAC_CONTAINER_ENGINE" exec aac-dev-postgres createdb -U aac aac_test
export TEST_DATABASE_URL=postgresql+psycopg://aac:aac@127.0.0.1:55432/aac_test
(cd backend && DATABASE_URL="$TEST_DATABASE_URL" ../.venv/bin/alembic upgrade head)
(cd backend && ../.venv/bin/pytest -q)
.venv/bin/ruff check --config backend/pyproject.toml backend deploy scripts
(cd frontend && npm run build && npm test)
```

Create `aac_test` only once; subsequent runs reuse and reset it. Apply migrations before testing, including after pulling new migrations: readiness tests check the Alembic revision as well as the tables. Browser tests require the [browser fixture setup](docs/local-previews.md), including migrations and the matching session secret.

| Command, run from `frontend/` | Coverage |
| --- | --- |
| `npm run test:e2e` | Page states, accessibility, images, and layouts at six viewport sizes |
| `npm run test:e2e:journeys` | Member/officer workflows in Chromium, Firefox, and WebKit |
| `npm run test:e2e:boundaries` | Narrow screens, breakpoints, orientation, focus, and simulated 200% reflow |
| `npm run test:e2e:keyboard` | Mobile forms with simulated keyboard-open viewport changes |
| `npm run test:e2e:search` | Officer person search |
| `npm run test:e2e:social` / `npm run test:e2e:speed` | Production proxy/metadata and speed; see [CI setup](.github/workflows/checks.yml) and the [page-speed guide](docs/page-speed.md) |

### When API contracts or assets change

Regenerate the contract from the configured backend environment, then frontend types:

```bash
(cd backend && ../.venv/bin/python - <<'PY'
import json
from pathlib import Path
from app.main import app
Path('openapi.json').write_text(json.dumps(app.openapi(), indent=2) + '\n')
PY
)
(cd frontend && npm run api:types)
```

Commit both generated files with the API change. For photos, fonts, or logos, follow [asset preparation and versioning](docs/page-speed.md); the build checks the committed asset manifest. `scripts/prepare-fonts.py` additionally needs `fonttools[brotli]`. Load fixtures and historical-import scripts have separate prerequisites and are not ordinary startup commands.

## Deployment

Coolify builds the website from Git. The [deployment runbook](docs/deployment-plan.md#runtime-configuration-and-fresh-initialization) records **https://anteateradventureclub.com** as the public hostname and the previous internal domain as a redirect. Earlier sections retain the original internal rollout details; use the intended public origin for a new deployment's domain, `APP_URL`, and OAuth callback.

### First-time Coolify setup

Create three resources on the same private destination network:

| Resource | Build/source | Network and persistence |
| --- | --- | --- |
| `aac-web` | Root build context; `deploy/frontend.Dockerfile` | Public HTTPS domain targeting port **8080**; shared named volume at `/var/lib/aac/assets` |
| `aac-api` | Root build context; `deploy/backend.Dockerfile` | Private port **8000**, stable alias **`aac-api`**; media volume at `/app/media` |
| PostgreSQL | PostgreSQL **17** | Private port **5432**, persistent database storage; no public port |

1. Connect both applications to the Website repository's **`aac-rebuild`** branch and enable Auto Deploy. Leave path filters empty to deploy both applications on each branch push.
2. Set API runtime variables: `APP_ENV=production`, `APP_URL=https://anteateradventureclub.com`, `PUBLIC_SITE_URL` set to the same public origin, private `DATABASE_URL` using the `postgresql+psycopg://` scheme, a strong `SESSION_SECRET`, Google client ID/secret, `INITIAL_OFFICER_EMAILS`, and `MEDIA_ROOT=/app/media`. For another domain, change both origins and the Google callback together. Set `FORWARDED_ALLOW_IPS` to trusted addresses for the actual ingress network.
3. Set `MIGRATION_DATABASE_URL` to an owner/migration connection when the runtime role cannot modify the schema. API startup runs Alembic once under a PostgreSQL lock, grants runtime permissions, then starts Uvicorn. Keep secrets in Coolify runtime settings.
4. Configure `DUES_VENMO_HANDLE`, `DUES_ZELLE_CONTACT`, `DUES_ZELLE_NAME`, `DUES_CASH_INSTRUCTIONS`, and `DISCORD_URL`. The current Instagram/GitHub links are defined in frontend source.
5. Register your public origin followed by `/api/auth/callback` with Google. Deploy PostgreSQL, API, then web. Verify Nginx resolves `aac-api` and proxies `/api/` and `/media/`.
6. Ensure the frontend asset volume is writable by UID/GID `101:101`. For an existing installation, follow the [asset-retention adoption procedure](docs/deployment-plan.md#rolling-updates-and-frontend-asset-retention) before its first rollout. Inactive releases' hashed assets remain available for seven days; active releases stay protected.
7. Sign in as the initial officer and create the first quarter through the UI. Configure database and media backups using the [recovery instructions](docs/deployment-plan.md#backups-monitoring-and-rollback).

### Routine releases and recovery

Run the relevant checks, review the change, and push the approved revision to `aac-rebuild`. Coolify deploys both applications automatically. **Auto Deploy does not wait for GitHub Actions**; validate before pushing to the deployment branch. Markdown/docs-only pushes are excluded from the CI push workflow but still match the configured Coolify trigger.

Confirm both resources are healthy, `/version.json` and `/api/health/live` report the expected revision, and `/api/health/ready` succeeds through the website. Check public direct links, sign-in/return/logout, officer access, and an existing published media image.

Retain compatible frontend/API revisions for Coolify rollback. Database and media volumes survive application replacement. A database rollback needs coordinated recovery; follow the [backup/restore runbook](docs/deployment-plan.md#backups-monitoring-and-rollback), including its limits on independent database/media snapshots and same-host backups.

## More documentation

- [Local browser previews and isolated environments](docs/local-previews.md)
- [Fresh-environment README validation](docs/evidence/readme-setup-validation.md)
- [Deployment and recovery](docs/deployment-plan.md)
- [Verification and acceptance](docs/verification.md)
- [Page speed and static assets](docs/page-speed.md)
- [Branding and social previews](docs/branding-and-embeds.md)
- [Historical imports](docs/historical-import.md)
- [Implementation plan](docs/implementation-plan.md), [view matrix](docs/view-matrix.md), and [decisions](docs/decisions.md)
