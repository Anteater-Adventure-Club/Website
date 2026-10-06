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

Keyboard simulation does not replace a check on a physical phone. Test output stays in ignored `artifacts/`.

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
