# Coolify deployment and recovery

This is the execution specification for milestone M7. Initial planning discovery was read-only. Implementation has now created the separate resources, configured runtime settings, and pushed the rebuild branch. Resource handles are recorded in `docs/evidence/deployment-resources.json`; the owner’s existing site remains separate.

## Verified environment

| Item | Observed value / source |
|---|---|
| Application server | `root@192.168.4.77`, hostname `lab0-apps`, x86_64; reached using the existing dedicated `~/.ssh/id_ed25519_abacus` key. |
| Capacity snapshot | 6 CPU threads; 9,682 MiB RAM, about 6,006 MiB available at inspection; 74 GiB disk available. Other applications already run here. Recheck before allocating. |
| Coolify control plane | `https://coolify.internal.gdodge.dev`, resolves to `192.168.4.78`; API reports **4.3.23**. |
| Target Coolify server | `lab0-apps`, UUID `qd6at0pkjdbcefaa3z15onu5`, IP verified as `192.168.4.77`. Do not deploy to the control plane's `localhost` entry. |
| API credential | Workspace `.secrets/coolify_key.txt`; read directly at runtime and never print/store in repo, build args, logs, screenshots, or command history. |
| Repository | `git@github.com:Anteater-Adventure-Club/Website.git`; implementation branch `aac-rebuild`, based on existing `main` at `8fd1fd7ed937ddc02c6cfc26b49a57754ac90b20`. Existing history remains the parent of the rebuild; deployment follows only this branch. |
| Organization GitHub source | Owner calls it `aac`; current API name `aac-deployment-hook`, source ID **2**, UUID **ovykddu0mo65gmnsujvzd64g**, installation **167115636**. Installation repository lookup verified access to `Anteater-Adventure-Club/Website` during the branch switch. Resolve by UUID/repository access, not a transient display name. |
| Working hostname | `https://aac.internal.gdodge.dev`; existing wildcard DNS routes to `192.168.4.78`; owner confirms working routing and automatic TLS. |
| Push delivery | The working existing GitHub App uses `https://captain-hook.gdodge.dev/webhooks/source/github/events`. Delivery diagnostics found the new AAC App still pointed to an unreachable IP/port; its URL was corrected to that existing working endpoint without changing DNS or the other App. Actual branch pushes/redelivery now queue both services with `is_webhook=true`. |

The existing `AAC Driver Reimbursements` project and database are separate applications, regardless of old README history. Leave them untouched. Create a new `AAC Website` project and `production` environment for the requested working site. “Production” here names the durable Coolify environment; the hostname is initially internal.

## Resource layout

| Resource | Source/image | Exposure and persistence | Initial runtime limit |
|---|---|---|---|
| `aac-web` | Repository root context; `deploy/frontend.Dockerfile`; Node build -> unprivileged Nginx static runtime | Container 8080, domain `https://aac.internal.gdodge.dev:8080` in Coolify's target-port notation where required; public browser URL has no explicit port. No host port mapping. Shared named volume `frontend-assets` at `/var/lib/aac/assets`; configure it as described below before deploying the asset-retention fix. | 0.5 CPU, 256 MiB |
| `aac-api` | Same repository root; `deploy/backend.Dockerfile`; Python/Uvicorn, two workers | Internal 8000; no public domain/host port; media volume at `/app/media`; stable network alias `aac-api` via supported Coolify network-alias configuration. | 2 CPU, 1,024 MiB |
| `aac-postgres` | Coolify standalone PostgreSQL resource; pinned supported PostgreSQL 17 image | Private 5432, persistent database storage; no public port. Use Coolify's internal URL. | 1 CPU, 1,024 MiB |

Use the server's shared standalone Coolify destination network. Record its actual destination UUID when creating resources rather than copying an unrelated application's configuration. Set the API's supported custom network alias to `aac-api`; verify DNS from the web container. Configure the web proxy to re-resolve the alias using Docker DNS, so replacing the API container does not require rebuilding or manually restarting the frontend. Never hard-code a container IP or deployment-suffixed name.

Coolify documents private communication over the shared network and internal service names/aliases. No public database endpoint or Compose stack is required. [Coolify networking](https://coolify.io/docs/core/networking-in-coolify)

Route `/api/` and `/media/` through Nginx to the API without dropping the path prefix. Preserve the request's host and HTTPS-forwarding information. Trust proxy headers only from the actual ingress network. Browser API URLs remain relative, so cookies and OAuth stay same-origin without broad CORS rules. Serve hashed frontend assets with immutable caching, index HTML with revalidation, private API responses with no-store, and published image derivatives with immutable versioned URLs. SPA fallback must not turn missing API/media routes into HTML.

Run API as a non-root user owning only its media directory, not with SSH root privileges. Database storage must be outside replaceable containers. Limit connection pools across both workers (5 connections + 5 overflow each; PostgreSQL maximum 50 initially). Sequentialize image builds to avoid competing with the host's other applications; runtime limits are initial values, to be validated with the stated workload.

## Repository and build configuration

Use `aac-website-current` as the rebuild working tree on `aac-rebuild`, with the existing Website repository as its remote. Base the branch on the existing `main` history and commit the complete replacement source/docs/Dockerfiles/lockfiles. Do not merge or push to the existing main branch as part of the internal deployment. Do not add the parent workspace, MVP checkout, local credentials, browser artifacts, or environment files. Retain designs as reference sources but exclude them from Docker contexts with explicit `.dockerignore` rules.

Use multistage committed Dockerfiles. The frontend build runs `npm ci` and a production Vite build; its final image contains static assets, Nginx configuration, and the startup asset publisher. The backend installs locked production dependencies and runs Uvicorn without development reload. Place liveness/readiness commands in the images so they match local container tests and Coolify checks. [Vite production build](https://vite.dev/guide/build), [FastAPI containers](https://fastapi.tiangolo.com/deployment/docker/)

Create both application resources from the verified organization GitHub source and repository, not inline Dockerfile contents. Configure `aac-rebuild`, root build context, and the appropriate Dockerfile location. Enable native Auto Deploy on both and leave path filters empty so both applications deploy every push to `aac-rebuild`. Bake the selected source commit SHA into a web `/version.json` response and the API liveness response. Database deployment is independent and does not restart on application-source pushes.

Use the owner's configured GitHub App and deployment-hook routing. Do not create another Actions runner, replace the webhook hostname, or modify wildcard DNS because the DNS target is private. Coolify's GitHub App integration can trigger deployment on pushes. [Coolify auto-deploy](https://coolify.io/docs/applications/sources/github/auto-deploy)

CI runs type/build, unit, PostgreSQL integration and required E2E checks on pull requests. Run these checks on `aac-rebuild` and require them before a later reviewed merge into `main`. Branch protection for the existing site requires separate coordination; do not change it during this branch switch. Native push-triggered deploys do not inherently wait for a separate CI workflow; merge only passing revisions. Disable preview deployments initially, keeping production secrets away from pull-request builds.

No application files are copied over SSH/SCP, no tarballs/base64 source are injected into inline Dockerfiles, and no manually uploaded image replaces a Git revision. Operational commands may configure Coolify, inspect health, run the committed database initialization/backup tasks, and restore backups.

## Rolling updates and frontend asset retention

Inspection on 2026-10-05 confirmed that `aac-web` uses Dockerfile rolling updates, has a `/health` check, and has no host port mapping or consistent container name. The two latest deployment logs report `Rolling update started`, `New container is healthy`, `Removing old containers`, and `Rolling update completed`, with about one minute of container overlap. The observed application had no persistent storage mounts. Through the internal ingress for the public hostname, the current build's `/assets/index-BUna0T9A.js` returned 200 and the previous build's `/assets/index-DihY9kU5.js` returned 404.

With per-container assets, HTML from release A can request a hashed entry or lazy chunk from release B, which has no such file. Even an instantaneous routing switch leaves a race between fetching HTML and fetching its JS; existing tabs can request old lazy chunks after A is removed. HTML already has `Cache-Control: no-cache`, so changing cache headers alone cannot preserve those files. [Coolify rolling updates](https://next.coolify.io/docs/applications/deployments/rolling-updates), [Vite load error handling](https://vite.dev/guide/build#load-error-handling).

The corrected image runs `deploy/publish-assets.sh` before Nginx starts. Its Python asset manager appends the build's hashed `/assets/` files to `/var/lib/aac/assets`, using atomic file publication and refusing to overwrite an existing URL with different bytes. Publication and cleanup share a filesystem lock. Nginx serves `/assets/` from this shared store. Publication and the retention worker's first heartbeat must finish before `/health` can succeed, so both old and new fixed containers can serve the candidate's assets before it receives traffic. Earlier hashes remain available for seven days after a release stops running. HTML, `/version.json`, and non-hashed public files remain local to each image.

Activate this on the existing single deployment server:

1. In `aac-web` **Configuration > Persistent Storage**, add a **Volume Mount** named `frontend-assets`, leave **Source Path** empty, and set **Destination Path** to `/var/lib/aac/assets`. All replacement containers must attach the same named volume. Keep the current Dockerfile deployment, health check, and rolling-update settings. Coolify prefixes the actual Docker volume name with the application UUID; inspect the configured name instead of guessing it. [Coolify volume mounts](https://coolify.io/docs/core/persistent-storage/storage-mounts/volume-mounts).
2. Before the first fixed rollout, seed that volume from the currently running frontend image's `/usr/share/nginx/html/assets` and any retained older frontend images whose tabs should still work. Copy only build assets, preserve existing filenames, and set the volume's ownership to UID/GID `101:101`. This uses existing Git-built images on the server and does not upload source or replace the deployed revision. The image initializes a fresh named volume with this ownership, but manually created or bind-mounted directories may need it set explicitly.
3. Deploy this infrastructure fix through Coolify as a separate release with the frontend source and lockfile unchanged. Verify that its built asset filenames match the currently running release before the first replacement: legacy containers still serve their local assets, so this initial rollout must use the same asset set. The fix-only image built from `e366227` was verified to emit the current `index-BUna0T9A.js`. Once every running container uses the shared store, subsequent frontend changes can safely introduce new hashes during normal rolling updates. Do not combine the initial adoption with unrelated frontend changes.
4. Verify the storage mount, UID/GID permissions, `/health`, and both current and retained JS URLs. Then perform another normal frontend deployment while requesting each release's entry and lazy chunks through both overlapping containers. Confirm the old URLs still return their original JS after the old container is removed.

Do not mount the entire HTML directory. `deploy/asset-store.py` keeps release manifests under the volume's private `.retention/` directory, which Nginx rejects. Each running container renews its own release once a minute; this protects long-lived releases and both instances during rolling updates. `deploy/retain-assets.sh` starts this worker with Nginx, and cleanup runs at startup and once an hour without another deployment or host cron job. A stopped release becomes eligible for expiry seven days after its last heartbeat, plus five minutes of heartbeat grace; the next hourly sweep removes its manifest and files unreferenced by every retained release. Shared chunks remain as long as any retained release uses them. Tabs using an expired release may need a refresh. An older image can still roll back because startup republishes its complete asset set before serving traffic.

When enabling retention on the previously untracked asset store, existing files become one legacy manifest with a full seven-day migration grace period. The current build also receives its own active manifest, so its files survive expiry of that legacy group. The HTTP health endpoint becomes unavailable if the retention worker exits; the image health command additionally checks heartbeat freshness. Continue monitoring the volume's disk usage. The volume is local to this server; moving to multiple servers requires a common asset store or publishing every retained asset set to every server before routing traffic.

The deployment checks run `python3 -m unittest discover -s deploy/tests -v`. Set `AAC_ASSET_TEST_IMAGE` to the built frontend image and, for Podman, `AAC_CONTAINER_ENGINE=podman` to include the real two-container test. Checks cover publication/cleanup races, URL immutability, expiry boundaries, shared chunks, long-lived active releases, rollbacks, migration grace, and hourly cleanup without a deployment. The container test checks old/new entry and lazy chunks, HTML/version caching, nonexistent assets, metadata privacy, expired chunks, and HTTP readiness after the retention worker is killed. CI builds the production image and runs the complete test.

## Runtime configuration and fresh initialization

| Resource | Configuration |
|---|---|
| API | `APP_URL=https://aac.internal.gdodge.dev`, private `DATABASE_URL`, generated `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `INITIAL_OFFICER_EMAILS`, `MEDIA_ROOT=/app/media`, environment flag `production`, release SHA. |
| Club presentation | `DUES_VENMO_HANDLE`, `DUES_ZELLE_CONTACT`, `DUES_ZELLE_NAME`, cash instructions, Discord/Instagram/GitHub URLs. Enter verified club destinations; mockup values are not authoritative credentials/payment settings. |
| Web | Internal API origin/alias, release SHA; no OAuth, session, database, or Coolify secrets. |
| Database | Unique database/user credentials. Use a scoped runtime application role; use an owner/migration role only for initialization/schema changes. |

Google's callback for this working domain is `https://aac.internal.gdodge.dev/api/auth/callback`. Verify or add it in the owner's OAuth client configuration before acceptance. The test-login bypass is disabled/absent on this deployment.

Run the repository's Alembic baseline once before starting the first API. For deployment-time schema changes, run the committed migration command once under a PostgreSQL advisory lock, not independently in every worker. No old migration script, data copy, legacy backfill, or hard-coded financial quarter is run. Apply the initial officer bootstrap once and create the first real quarter through the UI. Verify blank-database public and officer setup states before adding any operational content.

Use Coolify runtime secrets, not frontend Vite variables or Docker build args. Record resource UUIDs, configured paths, and non-secret operational settings in the runbook; store tokens/passwords only in the existing private credential location or Coolify.

`DUES_ZELLE_NAME` is the API runtime setting for the recipient name displayed beneath Zelle instructions. Its configured website value is `Gabe Dodge`; the existing `DUES_ZELLE_CONTACT` remains unchanged. The public `/api/site-settings` response exposes the name as `zelle_name`. An unset or blank name omits the recipient line. Changing the name requires restarting/redeploying the API and refetching browser settings, without rebuilding the frontend. The current public website is `https://anteateradventureclub.com`; the original internal domain redirects there.

## First deployment and push acceptance

1. Recheck source installation/repository access and server capacity; create the new project/environment and standalone PostgreSQL resource.
2. Configure separate API/web resources from Git, their runtime settings, media volume, network alias, health probes and Auto Deploy. API readiness tests a database query and expected schema revision; web liveness checks static serving, while smoke checks exercise the proxy/API path separately.
3. Apply the fresh schema/bootstrap, deploy API and then web through Coolify's Git-backed process. Confirm existing wildcard routing reaches these resources on `.77`, TLS is valid, and API/database remain private. Do not modify unrelated proxies/resources.
4. Exercise sign-in/return/logout, officer access, public direct links, one synthetic member/event/check-in flow in the working environment, and media upload/publication. Use disposable records clearly marked as acceptance fixtures and remove them through supported application operations when finished.
5. Push a reviewed harmless source change to `aac-rebuild`. Observe both automatic deployment entries from that push; do not manually press Deploy to satisfy this test. Verify reported commit SHA from web/API, health, generated assets, and source linkage.
6. Restart/redeploy containers and confirm database records, media, cookies/session behavior, and internal API name resolution survive. Confirm duplicate webhook delivery does not create conflicting runs or corrupt state.
7. Complete the backup/restore and application rollback drills below. Save sanitized deployment IDs, commit SHAs, timestamps, browser evidence, and any limitations.

## Backups, monitoring, and rollback

Coolify owns both backup schedules; no custom backup runner or host cron script is installed. PostgreSQL uses its native engine-aware custom-format dump at `15 3 * * *`. The API's `/app/media` directory uses a native storage backup at `25 3 * * *`, with Stop containers while creating the archive enabled. Both retain fourteen local backups and fourteen days under `/data/coolify/backups` on `.77`. Schedules follow the server/instance timezone. Media archiving briefly interrupts API service; Coolify starts the affected containers again afterward. [Database backups](https://coolify.io/docs/databases/backups), [Storage backups](https://coolify.io/docs/core/persistent-storage/storage-mounts/backups).

These daily schedules produce independent recovery points, not an atomic database/media snapshot. For a matched recovery checkpoint, stop only the new API, run both native Backup Now operations, verify both executions, and restart the API in a guaranteed cleanup step. Record the two backup identifiers, schema revision, release SHA, and checksums together. On restore, verify every database media reference exists in the restored archive before serving the site. Monitor timestamp/success for both schedules. A same-host backup is not a host-loss recovery copy.

Restore a matched dump/media snapshot into disposable resources and verify sign-in bindings, receipts/payouts, active event state and published photos. Never test restoration into the working database. Initial recovery targets for this internal phase are RPO 24 hours and RTO 4 hours. The owner explicitly deferred off-host copies as a future TODO; native local backups and restore checks remain in scope. Coolify supports scheduled engine-aware backups and optional S3 uploads. [Coolify backups](https://coolify.io/docs/databases/backups)

Use Coolify health status and structured stdout logs with request IDs, route/status/latency, and release SHA. Redact tokens, request cookies, contact details, answers and payout destinations from general logs. Record administrative actions in the private audit table. Monitor unexpected 5xx, readiness failures, failed/old backups, disk use (>80%), and memory pressure using the host's existing monitoring where available; no new observability stack is needed.

Retain the previous successful frontend and API Git revision/images in Coolify. Roll back both application resources to the recorded compatible revision if health or critical journeys fail. Database/media volumes remain intact. New-site schema evolution after launch must support the previous application revision for routine rollback; the owner's no-backward-compatibility instruction applies to the discarded MVP, not to losing new production data. If a schema rollback cannot preserve data, restore a verified backup only after explicit recovery coordination and accounting for writes since backup. Do not silently delete new records to make old code run.
