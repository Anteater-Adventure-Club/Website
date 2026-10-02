# Implementation progress

This file records actual work; remaining acceptance requirements are not passes.

- Repository: `Anteater-Adventure-Club/Website`, branch `aac-rebuild`, based on existing main commit `8fd1fd7`. Commits use Gabe Dodge <gabriel@gdodge.dev>. The existing main branch and site are separate from this internal rebuild.
- Backend: clean SQLAlchemy schema, one fresh Alembic baseline, FastAPI operations covering identity, quarters, members/dues, vehicles, events/series, signups, attendance/cards, seats, trips/payouts, board/media/recaps, imports, and officer audit API.
- Frontend: React member/officer workflows and all supplied design views are implemented, with generated API types, quarter-aware routes, lazy officer bundles, supplied branding/fonts/photos, and responsive field tools.
- Validation: 43 PostgreSQL integration tests pass, including concurrent arrivals, last-officer protection, import idempotency, financial calculations, DST, privacy, and card handling. Frontend production build passes; six Vitest time tests pass.
- Browser evidence: 360 Chromium screen/state cases passed across 360, 390, 768, 1024, 1280, and 1440 pixel widths. Phone axe scans found no serious or critical violations in those cases. These checks are screen coverage; complete mutating journeys, additional browser engines, layout boundaries, and load acceptance remain to be completed.
- Infrastructure: new AAC Website project contains separate private PostgreSQL, API, and web resources on lab0-apps (192.168.4.77). Both applications now follow Website/aac-rebuild through the existing GitHub App. Runtime secrets are configured without build-time exposure; initial deployment and push-trigger evidence are pending.
- Containers: pinned Python, Node, Nginx, and PostgreSQL images; scoped runtime database role, serialized baseline initialization, persistent sanitized media, same-origin proxy, and release-SHA reporting. Fresh container startup acceptance is in progress.
- CI: PostgreSQL schema/integration checks, OpenAPI contract check, frontend type/build/unit checks, and six-size Chromium view coverage are committed workflow requirements.

Remaining: complete workflow/browser/boundary/performance acceptance; first Git push and healthy internal deployment; verify actual Google OAuth sign-in after the owner updates its redirect URI; schedule backups and demonstrate restore, persistence, and application rollback. The Discord runtime invite remains unset because it was not available in the management site's settings.

No existing application/database has been repurposed. No old data or synthetic operational records have been transferred into the working deployment. Payment destinations were copied from the management site's source as authorized by the owner.
