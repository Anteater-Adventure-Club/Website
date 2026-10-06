# Local browser previews

Use the [README setup](../README.md#local-development) first. These previews use **synthetic data** in a separate local PostgreSQL database named `aac_browser`. The seeder resets its tables, so this database must be disposable. It refuses URLs outside `127.0.0.1:55432/aac_browser`.

## Prepare the fixture database

Stop the ordinary development API with Ctrl+C. From the repository root, create the fixture database once:

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
export E2E_PYTHON="$PWD/.venv/bin/python"

(cd backend && ../.venv/bin/alembic upgrade head)
.venv/bin/python scripts/seed-browser-fixtures.py
cd backend
../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Use the exact fixture secret and media path: they match the seeder. Its generated cookies are stored in ignored `artifacts/browser-fixtures.json` and expire after eight hours. Rerun the seeder to refresh them, with the fixture API stopped. This resets synthetic data; keep it separate from normal development and never use these settings in deployment.

The existing Vite server can keep running. Otherwise start it in another terminal:

```bash
cd frontend
npm run dev -- --host localhost --port 5173 --strictPort
```

## Browser checks and screenshot refresh

From `frontend/`, install browser binaries and their Linux system dependencies, then run the checks:

```bash
npx playwright install --with-deps chromium firefox webkit
export E2E_PYTHON="$(cd .. && pwd)/.venv/bin/python"
npm run test:e2e
```

System dependency installation may require administrator access. On unsupported host distributions, use the isolated Linux environment below or the repository's `deploy/browser-tests.Dockerfile`. When a test container talks to an API outside it, share `/tmp/aac-browser-media` between both processes. The journey tests reset fixtures and use `E2E_PYTHON` to find the interpreter.

To refresh just the README's nine images, from the repository root:

```bash
node docs/images/readme/capture.mjs
```

The capture script uses the installed Playwright package, fresh browser contexts, the fixture cookies, and the real local API. It waits for fonts, visible images, and page content, checks for page errors/overflow, and captures JPEGs directly from the browser. It accepts only the local origin `http://localhost:5173`. Review every image before committing it; no cookie values or database exports belong in documentation.

For an interactive signed-in view, open `http://localhost:5173` and use your browser's cookie editor to set `aac_session` to the relevant value from `artifacts/browser-fixtures.json` (`Member` or `officer`). Set domain `localhost` and path `/`, then reload `/my-aac` or `/admin/overview`. Clear the cookie when returning to your ordinary development database. This is a local fixture workflow, not an authentication endpoint.

## An isolated environment when local ports are busy

This optional **Linux x86-64 / Podman** procedure puts the database, API, frontend, and headless browser in a private network namespace. The host's existing services are unaffected. All following application commands run inside the shell container, where the README's standard localhost ports are available. The browser is inside that same environment; the site is not exposed on the host.

On the host, with Podman, Git, curl, tar, and xz installed:

```bash
export AAC_LAB_ROOT="$(mktemp -d /tmp/aac-readme-XXXXXX)"
git clone --branch aac-rebuild https://github.com/Anteater-Adventure-Club/Website.git "$AAC_LAB_ROOT/Website"
mkdir "$AAC_LAB_ROOT/node"
AAC_NODE_VERSION="$(cat "$AAC_LAB_ROOT/Website/.node-version")"
curl --fail --location "https://nodejs.org/dist/v${AAC_NODE_VERSION}/node-v${AAC_NODE_VERSION}-linux-x64.tar.xz" \
  --output "$AAC_LAB_ROOT/node.tar.xz"
tar -xJf "$AAC_LAB_ROOT/node.tar.xz" --strip-components=1 -C "$AAC_LAB_ROOT/node"

podman pod create --name aac-readme-lab
podman run -d --pod aac-readme-lab --name aac-readme-postgres \
  --tmpfs /var/lib/postgresql/data:rw \
  -e POSTGRES_USER=aac -e POSTGRES_PASSWORD=aac -e POSTGRES_DB=aac \
  docker.io/library/postgres:17 -p 55432
until podman exec aac-readme-postgres pg_isready -U aac -d aac -p 55432; do sleep 1; done
podman run -d --pod aac-readme-lab --name aac-readme-shell \
  --security-opt label=disable -v "$AAC_LAB_ROOT:/work" -w /work/Website \
  -e PATH=/work/node/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  mcr.microsoft.com/playwright:v1.63.0-noble sleep infinity
podman exec aac-readme-shell bash -c 'apt-get update && apt-get install -y python3.12-venv'
podman exec -it aac-readme-shell bash
```

Inside the container, follow the README's dependency installation, environment exports, migrations, API startup, and frontend startup. Skip its database-container creation because the pod already provides a fresh database. Open each additional terminal with `podman exec -it aac-readme-shell bash` from the host. Run the dependency install even though browser binaries are already available in the image; the app's `.venv` and `node_modules` must be new.

Database administration replaces the README's host container commands with these host commands (once each):

```bash
podman exec aac-readme-postgres createdb -U aac -p 55432 aac_test
podman exec aac-readme-postgres createdb -U aac -p 55432 aac_browser
```

The application URLs remain unchanged. Run README checks and the fixture commands inside the shell container. The matching browser image already provides Playwright browsers/system libraries; installing them again is unnecessary. View generated screenshot files under `$AAC_LAB_ROOT/Website/docs/images/readme/` on the host.

If validating uncommitted documentation, clone the local source repository instead and copy only the candidate documentation into the fresh checkout. Do not copy `.venv`, `node_modules`, `.env`, database storage, or `artifacts`. Record the source revision and any host prerequisites separately from application setup results.

After saving the validation results and screenshots, stop and remove only the temporary pod and its containers:

```bash
podman pod rm -f aac-readme-lab
```

Its database storage is ephemeral. Remove the temporary checkout separately when it is no longer needed. Leave other containers and volumes alone.
