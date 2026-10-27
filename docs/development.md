# Development

Follow the [local setup](../README.md#local-development) for dependencies, PostgreSQL, API, and Vite. The [project reference](../README.md#project-reference) maps source files to common changes.

## Run checks

Use the [README check commands](../README.md#checks) for pytest, Ruff, the frontend build, and unit tests. Backend tests erase their database tables: create a separate `aac_test` database, set `TEST_DATABASE_URL`, and apply Alembic migrations to that database before testing. Repeat migrations after pulling schema changes.

For API changes, [regenerate the contract and frontend types](../README.md#when-api-contracts-or-assets-change). For static images, fonts, or logos, follow [asset preparation](content.md#static-assets).

## Browser fixtures

These fixtures provide synthetic members, officers, events, and payments. The seeder **resets every table** in the disposable `aac_browser` database and requires `127.0.0.1:55432/aac_browser` in its connection URL.

Stop the ordinary development API. With the README's PostgreSQL container running, create the fixture database once, from the repository root:

```bash
export AAC_CONTAINER_ENGINE=podman  # or docker
"$AAC_CONTAINER_ENGINE" exec aac-dev-postgres createdb -U aac aac_browser
```

In the terminal that will run the fixture API, from the repository root:

```bash
export APP_ENV=development
export APP_URL=http://localhost:5173
export PUBLIC_SITE_URL=http://localhost:5173
export DATABASE_URL=postgresql+psycopg://aac:aac@127.0.0.1:55432/aac_browser
export SESSION_SECRET=aac-isolated-browser-only-session-secret-123456789
export INITIAL_OFFICER_EMAILS=officer@uci.edu
export MEDIA_ROOT=/tmp/aac-browser-media
export DUES_VENMO_HANDLE=@fixture-club
export DUES_ZELLE_CONTACT=fixture@uci.edu
export DUES_ZELLE_NAME='Fixture Recipient'

(cd backend && ../.venv/bin/alembic upgrade head)
.venv/bin/python scripts/seed-browser-fixtures.py
cd backend
../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Keep the exact fixture secret and media path; the seeder uses them to create sessions and photos. Cookies in ignored `artifacts/browser-fixtures.json` expire after eight hours. Stop the fixture API and reseed to refresh them, then restart it with the same environment.

Keep Vite running at `http://localhost:5173`, using the [README command](../README.md#4-start-the-frontend-and-verify). To browse as a fixture user, set the `aac_session` cookie to the `Member` or `officer` value from the fixture JSON, with domain `localhost` and path `/`. Reload `/my-aac` or `/admin/overview`. Clear this cookie when returning to your ordinary development database.

## Browser checks

In a separate terminal, from `frontend/`:

```bash
npx playwright install --with-deps chromium firefox webkit
export E2E_PYTHON="$(cd .. && pwd)/.venv/bin/python"
npm run test:e2e
```

Browser system dependencies may need administrator access. On an unsupported host distribution, use [deploy/browser-tests.Dockerfile](../deploy/browser-tests.Dockerfile). A test container must reach the fixture API and share its `/tmp/aac-browser-media` directory, since journey tests regenerate fixtures. `E2E_PYTHON` selects the Python interpreter used for those resets.

Choose additional suites for the affected behavior:

| Command in `frontend/` | Coverage |
| --- | --- |
| `npm run test:e2e:journeys` | Member/officer workflows in Chromium, Firefox, and WebKit |
| `npm run test:e2e:boundaries` | Narrow screens, breakpoints, orientation, focus, and simulated 200% reflow |
| `npm run test:e2e:keyboard` | Mobile forms with simulated keyboard viewport changes |
| `npm run test:e2e:search` | Officer person search |
| `npm run test:e2e:bans` | Ban creation, automatic cancellation, returning pending dues to general membership, lifting, independent scopes, accessibility, and screenshots at iPhone, iPad, and desktop sizes |
| `npx playwright test --config playwright.retreat.config.ts` | Retreat opening, reservation races, pending membership, payment instructions, and officer controls at desktop, laptop, tablet, and phone sizes |

Keyboard simulation does not replace a check on a physical phone. Test output stays in ignored `artifacts/`.

The bans suite uses the isolated browser database and reseeds it between tests.
It captures WebKit at iPhone 390 × 844 and iPad 834 × 1112, and Chromium at
desktop 1440 × 900. Review the PNGs under
`artifacts/restrictions-and-bans/screens/`; results and failure traces are stored
alongside them. These are emulated viewports, not physical-device captures.
To leave populated examples for manual review after testing, run
`.venv/bin/python scripts/seed-ban-review.py` from the repository root with the
browser-fixture environment. This resets only the guarded `aac_browser` database.
Use the `officer` cookie for `/admin/members?ban_status=active` or the `Pending`
cookie for member restriction and general-membership views; the fixture JSON includes
the example event URL under `ban_review`.

### Retreat concurrency benchmark

`scripts/benchmark-retreat.py` starts a temporary local API and tests 75 simultaneous applicants for 10 remaining retreat places, five times with logging off and five with it on. It checks the database counts, paused membership payments, and each enabled event's logged views, attempts, requests, winners, and capacity rejections. It writes `artifacts/retreat-benchmark/results.json` and `api.log`.

Use a freshly created, migrated, empty PostgreSQL database named `aac_retreat_benchmark_YYYYMMDDHHMMSS`, with a loopback connection URL. Set `DATABASE_URL` to that database, run Alembic migrations, then run `.venv/bin/python scripts/benchmark-retreat.py`. The script refuses other database names/hosts and databases containing members. Port 18001 must be free. Stop other test workloads while benchmarking. These are local API measurements, without production network, TLS, proxy, or browser rendering costs.

The Google Sheets browser test uses synthetic API responses and only needs Vite:
`npx playwright test google-sheets.spec.ts`. It covers column configuration,
pause/resume, retry messages, disconnect, accessibility, and viewport overflow.
`backend/tests/test_google_sheets.py` exercises the transactional queue, worker
recovery, sharing, and OAuth against the disposable PostgreSQL database;
`backend/tests/test_sheets_google.py` tests the Google REST adapter with mocked
HTTP responses. None of these tests contact Google. Follow the
[Google Sheets deployment steps](deployment.md#google-sheets-event-sync) for a
separate acceptance check using a test Google account.

### Production proxy checks

Social previews and page-speed checks need the production Nginx configuration and fixture API. Use the **Production HTML embeds and responsive branding** setup in the [CI workflow](../.github/workflows/checks.yml) to build the frontend and run the proxy on port 8080. Then, from `frontend/`:

```bash
E2E_URL=http://localhost:8080 E2E_SERVES_METADATA=1 npm run test:e2e:social
E2E_BASE_URL=http://localhost:8080 npm run test:e2e:speed
```

For changes to deployment scripts or asset retention, run from the repository root:

```bash
.venv/bin/python -m unittest discover -s deploy/tests -v
```

Set `AAC_ASSET_TEST_IMAGE` to a built frontend image to include the container integration test; set `AAC_CONTAINER_ENGINE=podman` when using Podman. The [CI workflow](../.github/workflows/checks.yml) includes the image build and test invocation.

## Refresh README screenshots

With the fixture API, Vite, and Playwright Chromium available, run from the repository root:

```bash
node scripts/capture-readme.mjs
```

This replaces the nine JPEGs in [assets/readme](../assets/readme/) using the local site and synthetic accounts. Review all images before committing them. The capture report stays in ignored `artifacts/readme-captures.json`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| A required port is busy | Identify the existing service before starting another. Use a separate VM or container network for simultaneous fixture environments; the seeder expects its fixed localhost database address. |
| Environment changes have no effect | Export settings in the API terminal and restart it. `.env.example` is a reference and is not loaded automatically. |
| Sign-in or mutations fail locally | Use `localhost` consistently in the browser, `APP_URL`, and the Google callback. Check the callback and test-user configuration in the README. |
| Readiness fails after pulling changes | Apply migrations to the database selected by the API, and separately to the test database. |
| Fixture views redirect to sign-in or lose photos | Check cookie age, the fixture session secret, and the shared media path; stop the API and reseed if sessions expired. |
| Build reports a stale asset manifest | Run `npm run assets:manifest` in `frontend/` after [preparing assets](content.md#static-assets). |
## External member approval previews

With the isolated browser-fixture API and Vite running, run `npm run test:e2e:approvals` from `frontend/`. The suite uses `E2E_PYTHON` (or the repository’s `.venv/bin/python`) to run the guarded `scripts/seed-approval-review.py` seeder against `aac_browser`. It checks application submission, conditional fields, word limits, both officer decisions, denial restrictions, officer-controlled reapplication with preserved history, questionnaire editing, and live status updates. It also runs accessibility and overflow checks and captures phone (390 × 844), tablet (834 × 1112), and desktop (1440 × 900) previews under `artifacts/external-member-approval/screens/`.

To leave populated examples for manual review, rerun `.venv/bin/python scripts/seed-approval-review.py` with the browser-fixture environment. The fixture JSON includes `Applicant`, `Approval pending`, `Approval denied`, `Approval approved`, and `officer` session cookies. Applicant states are at `/my-aac/application`; officer review is at `/admin/members?status=pending` and questionnaire settings are at `/admin/settings`. These fixtures reset only the guarded disposable browser database.
