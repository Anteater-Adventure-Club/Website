# README setup validation — 2026-10-06

**Result: PASS for local development and synthetic browser previews after correcting the guide and repeating it in a second clean environment.** Live Google sign-in and a Coolify deployment were not performed.

## Environment and method

- Application revision: `2fd24b08cffc104e542661cdb2c8b24cfa0eb3dc` (`aac-rebuild`), with the candidate README, preview guide, and screenshot capture script overlaid.
- Two independent local Git clones, each with a new Python virtual environment, fresh `npm ci`, and empty PostgreSQL storage. No existing `.env`, application dependencies, data, fixture cookies, or media were reused.
- Ubuntu 24.04 browser container, Python 3.12.3, Node 24.21.0, npm 11.19.0, PostgreSQL 17.11, and the Playwright 1.63.0 browser image. Node was freshly unpacked from the already downloaded versioned distribution archive; project dependencies were installed from their lockfiles.
- Used the documented [isolated environment procedure](../local-previews.md#an-isolated-environment-when-local-ports-are-busy) because an existing host database occupied port 55432. The private pod kept the application's normal localhost ports available. Host database-creation commands followed that procedure's explicit substitutions.
- In the second attempt, API startup, frontend startup, fixture setup, and checks were extracted directly from the candidate Markdown code blocks. Temporary browser assertions verified the resulting pages and API responses.

## First attempt: changes required

Dependency installation, application migrations, API/frontend startup, public pages, the production build, and all 47 frontend tests succeeded. Backend tests returned **215 passed, 1 failed**: `test_import_preserves_accounts_dates_and_quarter_eligibility` received HTTP 503 from readiness because the new `aac_test` database lacked its Alembic revision.

The guide was corrected to migrate the separate test database before pytest:

```bash
(cd backend && DATABASE_URL="$TEST_DATABASE_URL" ../.venv/bin/alembic upgrade head)
```

The first pod and its database storage were removed. Validation restarted with another fresh checkout, virtual environment, dependency installation, and PostgreSQL instance.

## Second attempt: passed

| Check | Observed result |
| --- | --- |
| Dependency installation | Locked Python requirements and `npm ci` succeeded |
| Development database migration | Both Alembic migrations applied to an empty database |
| Startup | API on 8000 and Vite on 5173 started using the documented commands |
| API/proxy smoke checks | `/api/health/ready` and `/api/home` returned 200 through Vite; API docs returned 200 on port 8000 |
| Empty-database public browsing | Home, Events, Board, and Membership loaded in Chromium; no browser page errors; no upcoming events before seeding |
| Separate test database | Created `aac_test`, applied migrations, then **216 pytest tests passed** |
| Backend static checks | Ruff passed for `backend`, `deploy`, and `scripts` |
| Frontend checks | Production build and **47 Vitest tests passed** |
| Browser fixtures | Created and migrated `aac_browser`; the guarded seeder and matching fixture API configuration succeeded |
| Desktop/phone page-state suite | `npm run test:e2e -- --project=chromium-1440 --project=chromium-390`: **126 passed** |
| Screenshot refresh | All nine screenshots captured from the actual application; fonts/visible images loaded, no page errors or horizontal overflow, member/officer sessions verified |
| Documentation rendering | All nine images loaded in a local CommonMark/table/HTML renderer at 1280px and 390px widths; no page overflow after shortening the deployment callback sentence |
| Documentation links | Local file links, image paths, and heading anchors checked; no missing targets |
| Public website link | Read-only HTTPS HEAD request to `https://anteateradventureclub.com` returned 200 |

The test run includes existing deprecation warnings and the expected oversized-image warning from the media rejection test. No application or test source changes were needed.

## Screenshots and limits

The nine JPEGs in [the screenshot directory](../images/readme/) total approximately 789 KiB. Public captures are anonymous; portal captures use the seeder's synthetic `Member` and `officer` identities. Club photos are existing repository assets. Desktop viewports are 1440 × 900 and mobile viewports 390 × 844; About and Events are scrolled to show their relevant sections. Every image was visually reviewed.

The Markdown review used a local renderer with GitHub-like table/image styling, not a published GitHub page. Mermaid remains source for the hosting platform's renderer. Actual Google OAuth consent, a remote GitHub clone, and live deployment/rollback/backup operations were not exercised; deployment instructions were checked against the committed Dockerfiles, startup code, CI configuration, and runbook. Browser suites outside the two named viewport projects were not rerun for this documentation change.

Sanitized command output, browser results, and the screenshot manifest are retained locally under ignored `artifacts/readme-validation/`. The temporary pod, databases, and checkouts were removed after saving those records and the screenshots. Existing development containers and the unrelated untracked design work were left intact.
