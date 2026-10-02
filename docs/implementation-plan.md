# AAC website implementation plan

Status: implemented on the internal working domain. This specification was prepared from the supplied artifacts and direct environment inspection on 2026-10-01–02 Pacific; [execution-status.md](execution-status.md) records completed verification. The subsequently authorized data import is documented in [historical-import.md](historical-import.md).

Build a branded public website, member portal, and officer workspace in this directory, versioned on branch `aac-rebuild` in `git@github.com:Anteater-Adventure-Club/Website.git`. Implement every applicable state in the 60-panel design inventory. Deploy initially at **https://aac.internal.gdodge.dev** on **192.168.4.77**, using separate Coolify resources and GitHub push deployments.

Supporting specifications:

- [View and state coverage — all 60 panels](view-matrix.md)
- [API gap analysis and replacement contracts](api-gap-matrix.md)
- [Product decisions and deliberate design changes](decisions.md)
- [Coolify deployment and recovery plan](deployment-plan.md)
- [Audit evidence and final verification specification](verification.md)

## Scope and source precedence

User decisions take precedence over mockups; current rendered panels and their notes take precedence over the design export's older `github.md` index. The MVP supplies reusable business logic and test cases, not a schema or routing compatibility obligation. Its Vue frontend must be replaced. The old Next.js/Supabase/Vercel architecture is not reused.

The initial fresh-data requirement was superseded by the owner's authorization to import historical and current data. The one-time import is specified in [historical-import.md](historical-import.md). Keep the clean website schema and existing target account bindings. Do not copy MVP migration chains, authentication, legacy URL aliases, deployment scripts or credentials. The separate existing reimbursement application remains outside this deployment; its records are read as an import source.

Use supplied fonts, icons, and marketing photographs. Treat mockup people, amounts, dates, and trip histories as demonstration data, except for editorial content explicitly reviewed for launch. Synthetic fixtures belong to tests and previews, not production initialization. Production began with a configured initial officer and empty operational tables; the authorized historical import now supplies real source quarters and records. Home's static mission/activity sections retain the reviewed photographs, titles and dates, and hero cards use published real recaps.

Online payment processing, automatic member messaging, elections, equipment inventory, offline check-in, and the old Sponsors page are outside this release. Existing benefit copy does not imply building those systems. Full public launch on a different domain is a later configuration change; this plan targets the internal working domain supplied by the owner.

## Feature list

| ID | Feature | Required behavior |
|---|---|---|
| F01 | Authentication, navigation, shared states | Verified UCI Google sign-in including valid UCI subdomains, safe return paths, session/logout, member/officer switch, branded 404/denied/loading/error/empty states. |
| F02 | Public events | Pacific-time calendar, correct weekday offsets, all events on the same day, multi-day retreats, recurring cards, public details and cancellation reasons; drafts remain private. |
| F03 | Home and editorial content | Combined Home/About, mission and activities, upcoming events, links to matching activities, published polaroids, social links, membership CTA. |
| F04 | Board and access | Public current/previous boards and bios; officer editing of terms, order, photos, approved color pairs, publication visibility and site access. |
| F05 | Quarterly membership | Free general membership; $25 student/$30 non-student submissions; externally paid cash/Venmo/Zelle; officer approval or $0 exception; correction and receipt history. Membership page exposes budget/coverage only, not the old detailed public ledger. |
| F06 | Personal account | Contact and driving preferences, own private payout details, saved vehicles with passenger capacities, member overview. |
| F07 | Signups | Rider/driver/own transport, saved vehicle and offered seats, editable contact summary, custom answers, cancellation, personal history, checked-in and assigned-ride states. |
| F08 | Officer dashboard | Selected-quarter counts and financial totals, today/upcoming cards, pending dues, seat shortages, unpublished recaps, drafts, and direct action links. |
| F09 | Event authoring/lifecycle | Unified editor, types, one-off/weekly/A-B recurrence/multi-day events, skips and one-date changes, signup switch, windows, custom questions, draft/publish/duplicate/complete/cancel. |
| F10 | Carpools | Arrived cars, manual seat/unseat, tap-to-seat, paid/exception priority then arrival order, Fill the Rest preserving assignments; transactional capacity enforcement. |
| F11 | Members and imports | Search/filter, dues queue, payment and event history, directory lookup, manual creation, general/paid/participant imports with preview, Google Forms support, formula-safe CSV export. |
| F12 | Live check-in | Full-screen desk, rider/driver/own-ride tabs, search, walk-ins, cards and inventory, receipt, undo, departure-minus-ten-minute release and audited quick extensions. |
| F13 | Trips and personal reimbursements | Driver registration, quarter eligibility override, miles/gas/rate, automatic/manual trips, cost override including $0, personal estimates and explanation. |
| F14 | Quarter close-out | Review events/drivers, deterministic allocation, frozen payouts, external payment recording, archive after all positive payouts paid, read-only history. |
| F15 | Quarter settings and audit | Name/dates/budget/cap/MPG, fresh quarter creation; internal audit recording and officer-only recent-audit API without a new screen. |
| F16 | Media and recaps | Officer image uploads/crops, optional event photo, private completion statistics, draft/public recap, gallery title/caption and homepage inclusion. |

## Technology and project organization

| Layer | Selection and responsibility |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router 7 in declarative mode. A browser application without Next.js or a Node production server. |
| Data/forms | TanStack Query 5 for fetching, cancellation, cache invalidation and polling; React Hook Form and Zod for form ergonomics. FastAPI remains authoritative. Generate TypeScript API types from OpenAPI with `openapi-typescript`; no handwritten duplicate transport models. |
| Styling | Plain CSS/CSS Modules and shared CSS tokens; local Lazydog and Chivo fonts, supplied social SVGs, locally bundled Lucide icons. Rebuild accessible React primitives rather than shipping the design canvas runtime. |
| Backend | Python 3.12, FastAPI, Pydantic 2, SQLAlchemy 2, psycopg 3, Uvicorn, Authlib. Modular monolith; synchronous SQLAlchemy sessions with short transactions. |
| Database | PostgreSQL 17, latest supported minor at implementation time; Alembic with one clean initial revision, followed only by new-site changes. PostgreSQL in integration tests as well as deployment. |
| Images | Pillow for decoding, EXIF removal/orientation, re-encoding and derivatives; uploaded files in an API persistent volume, metadata in PostgreSQL. |
| Runtime | Separate Nginx static frontend, FastAPI, and Coolify PostgreSQL resources. Same browser origin through frontend `/api` and `/media` proxying. |
| Verification | pytest, React Testing Library/Vitest, Playwright, axe-core, and a small k6 workload. GitHub Actions runs checks; Coolify deploys committed Dockerfiles on pushes to `aac-rebuild`. |

Use Node 24 LTS for frontend builds and pin exact dependency resolutions and container digests. Keep CI, `.node-version`, and the Docker build on the same release. GitHub-maintained workflow actions also use their current Node 24 runtime releases. Retain suitable MVP Python pins as a starting point; verify the selected families together rather than copying all old dependencies. React Router explicitly supports a Vite-created React application, and PostgreSQL 17 remains supported. [React Router installation](https://reactrouter.com/start/declarative/installation), [PostgreSQL version policy](https://www.postgresql.org/support/versioning/)

Target repository layout: `frontend/`, `backend/app/`, `backend/tests/`, `backend/alembic/`, `deploy/`, `tests/e2e/`, `docs/`, and the retained `design/` references. Keep design exports out of production build contexts. Supply `.env.example` with variable names/placeholders only and ignore `.env`, `secrets/`, `.secrets/`, local databases, test artifacts, and generated dependency/build directories.

Backend modules: identity/access, members/membership, events/recurrence, signups, check-in/carpools, finance, board/media, imports, and audit. Shared dependency modules own the database and authentication to avoid the MVP's `main`/`club` circular imports. Keep allocation logic pure and separate from HTTP/database concerns.

## Views, routing, and responsive behavior

Use `/`, `/events`, `/events/:slug/:id`, `/board`, `/membership`, `/sign-in`, `/my-aac`, `/my-aac/profile`, `/my-aac/signups`, and `/my-aac/reimbursements` for public/member views. Use `/admin/overview`, `/admin/events`, `/admin/events/new`, `/admin/events/:slug/:id`, its `/edit`, `/check-in`, and `/seat` children, `/admin/series/:id`, `/admin/series/:id/edit`, `/admin/check-in`, `/admin/members`, `/admin/officers`, `/admin/reimbursements`, and `/admin/settings` for officers. A series detail lists dated occurrences and links to their management pages; it uses the existing events-list patterns.

Management tabs are `signups`, `carpools`, `check-in-log`, `questions`, `trips`, and `recap` in the `tab` query parameter. An occurrence ID determines lookup and quarter; the slug is descriptive and replaced with the current slug after loading. New-site renames keep links usable without carrying over old MVP aliases. Quarter-filtered lists use `?quarter=<id>`; personal/global profile and board routes are not quarter scoped. When no quarter is selected, choose today's containing quarter, else the next upcoming quarter, else the latest past quarter; an empty database shows an officer setup prompt and appropriate public empty states. Reject an unknown explicit quarter rather than silently showing another.

Public and officer contexts share identity and design components. Opening a public event as an officer renders the member experience. A signed-out protected link returns through sign-in to that safe local destination; a signed-in member sees the designed denied state when opening officer tools.

Retain warm tan `#f8f5f0`, forest `#1f4d3b`, Chivo body text, Lazydog headings, glass panels, pill controls, and polaroids. Main layout breakpoints are 640, 768 and 1024px: below 640 use the mobile header/drawer; below 768 use record cards and bottom sheets; below 1024 stack detail/editor columns and use the officer section picker. Preserve two-column board polaroids on phones. Use the single-column gallery on phones and adaptive grids above that. At tablet widths, lay out two columns only where forms and controls still fit; do not scale desktop artboards down.

Use semantic headings, labels, button elements, visible focus, focus-managed dialogs/sheets, 44px target controls, keyboard alternatives for reorder/seat selection, and `prefers-reduced-motion`. A seven-column phone calendar may have smaller day cells if separated adequately, with a full-size selected-day event list and keyboard navigation. The design calendar's first-match-only lookup and clickable `div` cells must be replaced. Long names, error messages, on-screen keyboards, safe-area insets, and 200% zoom must not hide primary actions. The canvas's iPhone frames, sample status bars, reset-demo buttons, and developer Tweaks are reference tooling, not product UI.

## Clean data model and API boundaries

Use one `members` record for an account, a driver, and an imported/manual participant. An unclaimed member may lack Google identity and, for a walk-in, email. Use normalized unique non-null email and a unique Google `(issuer, subject)` binding. Verified UCI owners can claim a unique unclaimed imported member; an existing Google subject is authoritative. Do not merge two claimed identities automatically or create separate legacy driver records.

| Entity group | Required structure and invariants |
|---|---|
| Identity | Members, Google identities, vehicles, private payout details, active officer grants, one-time officer bootstrap marker. Soft-remove vehicles; retain signup vehicle snapshots. |
| Membership | Quarter membership unique by member/quarter; general/pending/approved plus payment/exception/imported approval source. Immutable dues receipts with correction linkage/void flag and reasons. |
| Quarters | Dates, financial settings, reimbursement-data availability and open/finalized/archived state. `cap=0` means uncapped. Reject overlapping quarters to keep the default selector deterministic. |
| Events | One unified occurrence row: quarter, optional series, type, title/location/description, start/end, lifecycle, signup switch, transport/window settings, packing, optional photo, cancellation reason, revision. |
| Series | Pacific timezone, anchor Monday, weekly or A/B day patterns, start/end local dates/times, default event fields, excluded dates. Materialized occurrences with original recurrence date and explicit exception marker. |
| Participation | Unique member/event signup, transport and vehicle snapshot, offered seats, answers keyed by stable question ID, notes, source/joined time, cancellation and extension fields. |
| Attendance | Check-in, append-only attendance actions, cards unique by event/category/number, assignment unique by rider signup. Track trip provenance so undo only removes a trip created by that arrival. |
| Finance | Member-quarter driver registration and nullable reimbursement-eligibility override, one trip per member/event, decimal mileage/rate/cost override, frozen payout per member/quarter, payment date/reference. |
| Editorial | Board terms and ordered board entries separate from access grants; media metadata and validated derivatives; event recap draft and separate published snapshot; completion attendance snapshot. |
| Operations | Append-only audit actions and import preview/application records with request hash, actor, scope, expiry, outcome, and idempotency constraints. |

Store instants as timezone-aware UTC and display/expand recurrence in `America/Los_Angeles`. Return ISO timestamps with offsets and dates as `YYYY-MM-DD`; return money and rates as decimal strings. Rates retain six decimal places, dollars two, mileage two. Localize dates without parsing calendar-only strings as UTC midnight. Reject ambiguous/nonexistent local DST times with a field error and require an unambiguous replacement.

All endpoints use explicit Pydantic request/response DTOs. Public responses exclude emails, phones, private answers, payout destinations, officer access flags, rosters, and private completion statistics. Members receive only their records and limited assigned-car details (driver name, vehicle label/plate, co-rider first names); officers receive scoped operational details. Strip those private responses on logout. Public recap text can contain officer-authored attendance narrative, but private attendance breakdowns are not automatically serialized into public event objects.

Expose the normalized `/api` surface in the [API matrix](api-gap-matrix.md). It replaces the MVP's parallel `/api/club` and ledger endpoint families. Use 401/403/404/409/422 consistently; 422 contains field errors, 409 returns a stable conflict code and current revision where relevant. Lists use `limit` (default 50, maximum 200) and `offset`, returning `{items,total}`. Calendar queries use bounded date ranges; do not download full signup histories to render public months. Generate OpenAPI/type artifacts and contract tests in CI.

## Behavior that must be decided before coding

### Identity, dues, and access

Use Google OIDC with verified UCI email/subdomain and a secure HttpOnly SameSite=Lax cookie; rotate session state after login, expire after eight hours, and check database grants on every officer request. Restrict mutation origins to the configured site, validate OAuth state/nonce, rate-limit sign-in/import/upload/directory endpoints, and validate safe relative return paths. Test fixtures may use an explicitly enabled local-only login helper; the deployed API must not expose the MVP's passphrase bypass.

Initial access defaults to the owner's existing UCI address `gdodge@uci.edu` through `INITIAL_OFFICER_EMAILS`, applied once, not restored every restart. Board entries may be visible without access and access may exist for a hidden entry. New board entries default Site access on as drawn, require UCI email if granting access, and retain access after a term ends until explicitly revoked. Protect the last officer in a transaction. Starting a board term archives the presentation of the previous term without deleting entries, ending access, or duplicating people into the new term.

Membership approval belongs to a quarter. Pending is general; payment or a reasoned $0 exception grants paid benefits. Corrections retain prior receipt history. Paid-list imports without receipt details grant membership but add zero collected dollars and explicitly show unknown payment history. Cash/Venmo/Zelle instructions are runtime club settings (`DUES_VENMO_HANDLE`, `DUES_ZELLE_CONTACT`, cash instructions); do not hard-code mockup personal destinations. Reimbursement destination fields remain member-private/officer-only. Retreat signups require approved payment/exception/imported membership for that event's quarter; ordinary events remain free. Officers use the same rule for their own signup.

A roster eligibility override affects reimbursements only; it does not manufacture a dues receipt or change ride/retreat membership benefits. Default eligibility follows approved membership; an explicit override persists until cleared. Record the actor and reason for overrides.

### Events and recurrence

Event types are `regular`, `meeting`, `picnic`, and `retreat`. Multi-day is one occurrence with a start/end range, not a repeated event and not one signup per day. Default meetings/picnics to signups off and trips/retreats to on; permit officer changes before participation exists. Signups off removes and rejects signup/check-in/carpool/trip actions, while still allowing publication and an editorial recap. Do not let an event with participation history switch those operations off.

Materialize weekly/A-B occurrences transactionally when saving, limited to the selected quarter and inclusive recurrence end. Week A is the Monday-containing week of the first date; B alternates by local week, not elapsed hours. An empty B implements fortnightly recurrence. Preview is computed by the same server logic as persistence. All event start/end dates must fit the quarter; require separate series across quarter boundaries.

Provide explicit “This date” and “This and future dates” edit scope. Past, completed, cancelled, or individually overridden occurrences are never overwritten by a series edit. If a future date that would change already has signups, reject that series operation with the affected dates and require editing/cancelling those occurrences individually; preserve their IDs and answers. Skipping an occurrence without participation hides that date; with participation, require cancellation with a reason and retain a cancelled public occurrence. Duplicating an event creates a single draft in the chosen open quarter, without people, cards, trips, published recap, or payments.

Officers can delete unused drafts and whole unused draft series in open quarters after confirming. Deleting a recurring draft date also excludes that date from later series edits. The dashboard groups draft alerts by series and shows the number of draft dates. Converting a draft series to one event retains the first active occurrence's ID and removes the other unused drafts after confirmation. Converting a standalone draft to recurrence retains its ID as the first occurrence. Both conversions preserve published and participating events by rejecting operations that would remove their history; individual date changes invalidate stale series deletion or conversion requests.

Questions have stable IDs and kinds text/long/choice/yes-no. After the first signup, freeze existing definitions and permit only new optional questions. Signup edits and cancellation end at the window close or check-in, whichever is first. Cancelling an event requires a reason and no active arrivals; preserve signup history and derive its cancelled display from the event state. Completion freezes attendance/signups and snapshots counts/arrival buckets; mileage and trip adjustments remain available until quarter finalization.

### Check-in and carpools

The backend computes ride priority and availability. Only guarantee paid riders when offered passenger seats cover active paid riders; remove the MVP's `paid_riders < 15` exception. Clarify that offers can change and that day-of seating uses arrived drivers. Paid/exception riders precede general riders, then use check-in timestamp and signup ID as the deterministic tie-breaker. No production arrival-order toggle is added.

Release absent rider reservations ten minutes before departure; drivers and own-ride attendees do not receive rider cards. Extensions use only two quick chips: departure time and departure plus five minutes while those are still future; once a chip expires, replace it with the next future five-minute slot. Compute available timestamps using server time, not the user's clock; store the selected instant, officer, and required reason. Omit the mockup's Other input per the owner's choice.

Serialize check-in/card/assignment mutations per occurrence. Duplicate arrivals return the original check-in and card. Issued and voided numbers never repeat. Undo clears dependent seating and only its own auto-created driver trip; edited/manual trip records remain intact. The walk-in action creates/reuses member, optional vehicle, signup, check-in, and card within one transaction, so an exhausted card inventory leaves no partial arrival.

Manual assignment requires active checked-in rider and driver, matching occurrence, and capacity. Fill the Rest processes only unassigned checked-in riders and retains existing assignments. Use arrived drivers in stable arrival/ID order. Tap-to-seat moves to the next car with space; actual assignment remains server-confirmed. An event revision protects against stale writes; on conflict refresh and explain the changed state, without replaying a stale assignment blindly.

Poll the visible check-in/carpool views every two seconds, pause when hidden, refresh immediately after mutations and reconnection, and display stale/reconnecting feedback. Keep an open form's input stable while refreshing reference data. No WebSocket service or offline mutation queue is needed for this scale.

### Reimbursements and publication

Keep the reviewed Decimal algorithm: round each trip to cents, sum eligible costs, apply per-driver cap, prorate to the lesser of budget/eligible total, and distribute remainder cents deterministically by member ID. Non-members have no eligible costs unless a quarter override grants eligibility. Zero-dollar trip overrides and notes are valid.

Finalization locks financial inputs and snapshots payouts in one transaction. Treat a repeated finalize as a stable result without duplicate payouts. Record full externally paid amounts only, with payment date and reference; reject future dates and duplicate payment records. Archive only when all positive payouts are paid. Zero payouts require no payment. New quarters do not carry balances or membership forward. Profile changes cannot alter frozen financial amounts.

Editorial changes are independent of financial locks: completed/finalized events may have their public recap created or corrected without changing attendance/finance. Upload JPEG/PNG/WebP up to 10 MiB and 40 megapixels; reject undecodable files and user-uploaded SVG. Apply EXIF orientation, strip metadata, and create square board and 4:3 gallery derivatives with user-selected crop position; also generate responsive sizes. Use opaque content IDs, not submitted filenames. Keep draft files authenticated, expose only published derivatives, and do not delete files still referenced by another record.

Gallery publication requires an image, title, caption, and recap of at most 500 characters, plus optional homepage flag. Saving a draft must not alter the published snapshot; publishing swaps it atomically. Allow unpublish for correction. A single polaroid photo per event is sufficient for the supplied design; a multi-image album editor is not added. Public galleries show only published snapshots, newest first. Board images use the same upload service and palette-limited popup colors.

## Implementation milestones

Each milestone requires its focused checks before proceeding. Use the view matrix as the checklist rather than building only representative screens.

| Milestone | Work and dependencies | Completion evidence |
|---|---|---|
| M0 — repository and contracts | Base this implementation branch `aac-rebuild` on the existing Website/main history; retain `design/` and these docs; add secret/build ignores, toolchain locks, CI, two Dockerfiles, database baseline, DTO contracts, and synthetic fixtures. | Fresh PostgreSQL initialization; OpenAPI generation; typed frontend build; no credentials/demo operational data in production initialization. |
| M1 — identity and AAC shell | F01, shared responsive components, roles, OAuth, bootstrap, quarter selector, navigation, empty/error states, local assets. | Auth/role/return-path tests; representative header/drawer/dialog checks at all three device classes. |
| M2 — event/domain and public site | F02/F03/F04/F09/F16 core: unified events/recurrence, media, board terms/access, public calendar/home/board and editorial publishing. | Calendar/DST/series exception tests; every same-date event reachable; unpublished content and roles remain private. |
| M3 — member workflows | F05/F06/F07: dues, profile/cars, signup/retreat eligibility, personal dashboard/history, assigned-ride display. | Member journey and ownership tests; receipt corrections, pending/exception states, vehicle snapshot and seat validation. |
| M4 — officer operations | F08/F10/F11/F12: dashboard, members/imports, event tabs, attendance, cards, walk-ins, seats and polling. | PostgreSQL races/idempotency; import rollback; complete field workflow at phone/tablet/desktop; approved D03/D06/D07 behavior. |
| M5 — finance and quarter close | F13/F14/F15: per-event trips, independent eligibility override, report aggregation, personal reimbursements, finalize/payment/archive. | Reused allocation invariants plus frozen-state and cross-quarter tests; complete external-payment recording journey. |
| M6 — integrated acceptance | Apply all [verification requirements](verification.md), review screenshots against all 60 panels, fix defects, verify privacy/performance/accessibility and production builds. | Traceable coverage report, screenshots, passing required suites; no unresolved critical workflow or visual failures. |
| M7 — internal deployment | Configure the separate Coolify project resources, source `aac`, runtime secrets, existing ingress/TLS, backups, initial setup, then deploy from GitHub. | Real push triggers both intended application resources, expected commit SHA serves at internal URL, data/media survive redeploy, restore and rollback drills pass. |

For each implementation PR, reference feature/panel IDs and its focused verification. Push to `aac-rebuild` only after local checks pass, since Coolify's native push hook need not wait for an independently running Actions workflow. A later merge into the existing `main` branch needs review and passing CI; do not change its deployment or protection settings for the internal rebuild. Do not enable pull-request deployment of untrusted code with production secrets.

## Final acceptance

Run the browser/device, backend concurrency, performance, and deployment suites in [verification.md](verification.md). Minimum primary viewports are phone 360×800 and 390×844, tablet 768×1024 and 1024×768, desktop 1280×800 and 1440×900, with 320px overflow and breakpoint-neighbor checks.

Acceptance requires functional coverage of every panel and embedded state, visually reviewed screenshots, complete member/officer journeys, PostgreSQL correctness, ownership/privacy boundaries, working push-triggered deployment, persistent database/media, tested backup restoration, and documented rollback. A fixed-size design-canvas screenshot at a tablet browser width is not evidence that the implemented site is responsive. No previous MVP verification report substitutes for tests on the new site.
