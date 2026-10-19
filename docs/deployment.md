# Deployment and recovery

Coolify builds separate web and API images from the repository. The public site is **https://anteateradventureclub.com**. See the [README](../README.md#deployment) for the initial setup sequence.

## Resources and storage

Create all three resources on the same private network:

| Resource | Build and network | Persistent storage |
| --- | --- | --- |
| Web | Root build context, [deploy/frontend.Dockerfile](../deploy/frontend.Dockerfile), public HTTPS routed to container port 8080 | Shared named volume at `/var/lib/aac/assets`, writable by UID/GID `101:101` |
| API | Root build context, [deploy/backend.Dockerfile](../deploy/backend.Dockerfile), private port 8000, stable network alias `aac-api` | Media volume at `/app/media`, writable by UID/GID `10001:10001` |
| PostgreSQL | PostgreSQL 17, private port 5432 | Durable database storage |

Keep the API and database private. Nginx proxies `/api/` and `/media/` to `aac-api:8000`. Use container ports without host port mappings for rolling updates. Mount only the shared asset directory on the web container; HTML and `/version.json` belong to each image.

Connect both applications to the same repository and deployment branch. Enable Auto Deploy with empty path filters to deploy both on each branch push. Match the branch filters in the [CI workflow](../.github/workflows/checks.yml) when changing the deployment branch. Keep preview builds separate from production secrets.

## Runtime settings

Set these in the API's Coolify runtime environment. [`.env.example`](../.env.example) lists local examples; the API reads process environment variables.

| Setting | Value or purpose |
| --- | --- |
| `APP_ENV` | `production` |
| `APP_URL` | `https://anteateradventureclub.com`; determines OAuth callbacks and allowed mutation origin |
| `PUBLIC_SITE_URL` | Public HTTPS origin for canonical links and share images, without a path; follows `APP_URL` when blank |
| `DATABASE_URL` | Private application connection using `postgresql+psycopg://` |
| `MIGRATION_DATABASE_URL` | Owner/migration connection if the application role cannot alter the schema; otherwise omitted |
| `SESSION_SECRET` | Strong random secret of at least 32 characters; retain across restarts to preserve sessions |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth Web application credentials |
| `INITIAL_OFFICER_EMAILS` | Comma-separated UCI addresses, applied once when initializing a database |
| `MEDIA_ROOT` | `/app/media` |
| `FORWARDED_ALLOW_IPS` | Trusted proxy addresses for the actual ingress network |
| `DUES_VENMO_HANDLE`, `DUES_ZELLE_CONTACT`, `DUES_ZELLE_NAME`, `DUES_CASH_INSTRUCTIONS`, `DISCORD_URL` | Verified club payment/contact settings; see [content maintenance](content.md#membership-and-links) |

Register `https://anteateradventureclub.com/api/auth/callback` with Google. For another domain, update the callback, Coolify domain, and both origin settings together. Keep credentials out of frontend variables and build arguments. Both Dockerfiles accept `SOURCE_COMMIT` to identify the deployed revision.

## Migrations and initialization

Deploy PostgreSQL, then the API, then the web application. [API startup](../deploy/start-api.py) runs Alembic under a PostgreSQL advisory lock before starting workers. It uses `MIGRATION_DATABASE_URL` when supplied and grants the application role access to the migrated tables and sequences.

Check `/api/health/ready` for database connectivity and the expected schema revision. On a new database, sign in as an initial officer and create the first quarter through the UI. After initialization, manage officer access through **Officers & Board**; changing the bootstrap email list does not rerun initialization.

## Release checks

Run the [relevant checks](development.md#run-checks) before pushing to the deployment branch. **Coolify Auto Deploy does not wait for GitHub Actions.** Markdown/docs-only pushes are excluded from the CI push workflow but still trigger deployment with empty Coolify path filters.

After deploying:

1. Confirm both Coolify resources are healthy. Check `/health` for web asset readiness and `/api/health/ready` through the public origin.
2. Compare `/version.json` and `/api/health/live` with the intended source revision.
3. Open public pages through direct links. Check sign-in, return navigation, logout, officer access, and an existing published photo.
4. For storage or proxy changes, restart the affected container and confirm records, media, and API name resolution still work.

## Google Sheets event sync

This optional integration defaults to disabled. It creates a new spreadsheet in
one connected club account's My Drive for each configured event. It has separate
OAuth settings and consent from member sign-in. Use either a dedicated OAuth
client or the existing member sign-in client with both callback URLs registered.

1. In the Google Cloud project containing the OAuth client, enable the
   **Google Sheets API** and **Google Drive API**. Use a Web application OAuth client with the authorized
   redirect URI `https://anteateradventureclub.com/api/admin/integrations/google-sheets/callback`.
   Configure consent for `openid`, `email`, and `https://www.googleapis.com/auth/drive.file`.
   Use a production consent configuration: external apps left in Testing normally
   receive refresh tokens that expire after seven days for Drive access.
   Granting OAuth consent does not enable these APIs. A `SERVICE_DISABLED` or
   `accessNotConfigured` response requires enabling the named API in the OAuth
   client's project, waiting for propagation, and choosing **Sync now**.
2. Set `GOOGLE_SHEETS_CLIENT_ID`, `GOOGLE_SHEETS_CLIENT_SECRET`, and
   `GOOGLE_SHEETS_TOKEN_KEY` on the API and worker. Generate the encryption key with
   `python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'`.
   Store it as a secret, preserve it across releases, and include it in the private
   recovery procedure. It must differ from `SESSION_SECRET`. Losing the key
   requires reconnecting the same club account.
3. Deploy the API migration before starting the worker. Add a private Coolify
   application built from the same repository, branch, root context, and
   `deploy/backend.Dockerfile`. Set **Docker Build Stage Target** to `sheets-worker`.
   This target starts `python -m app.workers.google_sheets` automatically. Leave
   the API's build target empty (the default `api` target). Give the worker the
   runtime `DATABASE_URL`,
   `APP_ENV`, `APP_URL`, `SESSION_SECRET`, and the Google Sheets secrets. No domain,
   inbound port, database-owner credential, or media volume is needed.
4. Keep the worker image's built-in health check:
   `python -m app.workers.google_sheets --health` (30-second interval, 90-second
   startup grace). Coolify [uses Dockerfile health checks ahead of dashboard
   overrides](https://coolify.io/docs/applications/configuration/health-checks),
   so selecting the worker target is required. Use automatic restart and the same
   branch auto-deploy settings as the API. Set `GOOGLE_SHEETS_ENABLED=true` on both
   services only when configured.
   Startup validates credentials and the schema revision. PostgreSQL elects one
   active worker during overlapping deployments.
5. Sign in as an officer and open an event's **Google Sheets** tab. Connect the
   **club** Google account, select columns, and create a spreadsheet. Every officer
   will receive edit access using their website email, without notification email.
   Confirm that the account can share files with UCI addresses under its Workspace
   policies. The Signups tab is protected; Notes and other tabs remain editable.

The worker coalesces updates for 30 seconds and polls every five seconds. Under
normal load, committed signups and changes arrive within one minute. Outages and
rate limits retry with backoff; signup requests never wait for Google. One elected
worker shares a 40-request/minute budget. The event tab shows last sync time,
pending age, data errors, and sharing errors separately. The connection status API
also reports worker heartbeat, pending count, and oldest pending timestamp. Monitor
worker health, growing queue age, `sheet_worker_failure` logs, and repeated errors.
Logs contain IDs and status only, never tokens or signup answers.

**Recovery:** reconnect the same Google account after token revocation. Restore a
deleted spreadsheet/tab from Google before using **Sync now**; the worker never
silently replaces missing spreadsheets. An uncertain create is recovered by a
private Drive provisioning marker. If it cannot be found, ask an administrator
to verify the account's Drive before clearing the provisioning attempt; never
blindly repeat creation. Manually granted permissions are preserved. Failed officer
access changes remain visible and retryable. Permission reconciliation continues
while data sync is paused and is checked periodically every 15 minutes.

Disconnecting the club account deletes its encrypted stored credential and stops
all jobs; files and sharing remain in Google. Reconnecting the same account queues
catch-up updates. Event deletion retains a cleanup record until integration-granted
access is removed; the owner keeps the spreadsheet. Duplicates and series dates
must each be configured explicitly. Changing the owning Google account is a
separate migration and is not supported by reconnect.

Before enabling real events, use a test event and Google account to verify
backfill, edits, cancellation/restoration, multiple-select answers, officer
grant/revoke, and preservation of a manually edited Notes tab. Verify the normal
update delay is at most 60 seconds. Never use production member data in automated
Google acceptance tests. Disabling `GOOGLE_SHEETS_ENABLED` and stopping the worker
leaves ordinary signup behavior intact; retain the additive database tables.

## Frontend asset storage

Every replacement web container must attach the same named volume at `/var/lib/aac/assets`. Startup publishes the image's hashed assets before it becomes healthy. Active releases remain available; inactive releases are retained for seven days and then cleaned up automatically. A tab using an expired release may need a refresh. Monitor volume usage and asset-related startup errors.

If adding the shared store to an installation that still serves assets from individual images:

1. Create the shared volume and seed it from the current image's `/usr/share/nginx/html/assets`, including retained older image assets if needed. Preserve filenames and set ownership to `101:101`.
2. Deploy the storage change with the same frontend asset set as the running image. Verify matching hashes before rollout, since older containers still use their local files.
3. Once all running containers use the shared store, deploy frontend changes normally. Verify both current and retained JavaScript URLs during container overlap and after the old container stops.

Do not mount the entire HTML directory. For multiple deployment servers, provide a common asset store or publish retained assets to every server before routing traffic there.

## Backups and restore

Configure Coolify's database and API media-volume backups. Check each schedule's timezone, retention, destination, and most recent successful run. Keep a recovery copy outside the application host. Media backups that stop the API briefly interrupt service.

Separate scheduled database and media backups can contain different points in time. For a matched checkpoint:

1. Stop API writes by stopping the API.
2. Run both database and media backups and confirm that both succeeded.
3. Record their identifiers together with the schema revision and application revision in the private operations record.
4. Restart the API even if a backup failed, and verify readiness.

Test restoration into disposable database and media resources using a compatible application image. Check that every database media reference has its file, then verify account bindings, event signups, dues, payouts, and published photos. Keep the restored instance isolated from the public site and real payment activity. Verify readiness before serving a recovered database.

## Rollback and monitoring

Retain compatible frontend and API revisions in Coolify. Roll back application images together when necessary; preserve the database and media volumes. Routine rollback requires migrations that remain compatible with the previous application. If restoring a matched backup is necessary, account for writes made since that backup before replacing live data.

Monitor Coolify health, API errors and readiness failures, failed or overdue backups, disk use, and memory pressure. Use container logs and release identifiers to diagnose failures; keep session cookies, secrets, member details, and payment destinations out of shared logs.
