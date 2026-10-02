# One-time historical import

The owner authorized combining the management MVP, the old static website, and the private `Anteater-Adventure-Club/AAC-Business-Intel` repository. This extends the clean website schema; it does not adopt the MVP schema, migration chain, authentication, or deployment architecture. The old applications remain separate.

## Source accounting

| Source | Available source records | Destination treatment |
|---|---|---|
| Old static website | 2024–25 board: 12 entries; 2025–26 board: 14 entries; 14 officer photos | Two past board terms, 26 profiles, 14 sanitized photos. These public profiles grant no officer access. Leave 2026–27 for manual configuration. |
| Old static website | 10 past-event photos/descriptions | Ten published recaps and ten sanitized photos. Eight attach to matching events; two add events absent from the operational sources. Homepage cards use the published titles/dates and rotate. |
| Business Intel | 426 person UUIDs | Match explicit source UUIDs and normalized valid emails. Preserve valid non-UCI contacts and email-less people; Google sign-in remains UCI-only. |
| Business Intel | 243 membership records across five quarters | 243 quarter memberships, including 205 approved memberships: 203 known positive dues receipts totaling $4,275 and two complimentary memberships. |
| Business Intel | 806 submissions for 29 regular events; 183 submissions for five retreats | 940 distinct member/event signups after collapsing 49 repeated submissions. Five regular events overlap MVP events and reuse those destination events. |
| Business Intel | 29 driver reimbursement rows | Superseded by the MVP's more complete 32 Winter 2026 trip records; no duplicate payments or trips. |
| Management MVP | 159 participants and 37 driver records | 178 logical people after 16 explicit participant/driver links and two owner-confirmed links. These overlap 22 BI people, giving 582 combined members. Reuse both existing website accounts. |
| Management MVP | Three quarters, 159 club memberships, 37 driver-quarter memberships | Three quarter configurations, 159 quarter memberships and 37 quarter driver registrations. Preserve Fall 2026's open $500 budget and quarter eligibility overrides. |
| Management MVP | Eight events and 181 signup rows | Six Winter events have no signup rows in this database; BI supplies their historical signups. All 181 MVP signups belong to the two Fall 2026 events. Preserve current event schedules and signup windows. |
| Management MVP | 45 trips, 21 frozen payout rows | A trip is one driver's reimbursement journey, not an event. Preserve 32 Winter trips and 13 Fall trips. Eleven Winter payouts are confirmed paid, totaling $168.57. |
| Management MVP | 22 vehicles; 143 imported profile snapshots | Preserve the vehicles and consolidated participant profile values. Source snapshots do not become duplicate member records. |
| Management MVP | One Google identity, one officer identity; zero dues receipts, check-ins, cards or carpools | Preserve the target's existing two Google bindings and one officer grant. Import no historical grants or Google subjects. The absent operational records are not fabricated. |

Final destination totals: **582 members, seven quarters, 402 memberships, 203 dues receipts, 39 events, 1,121 signups, 37 quarter driver registrations, 45 trips, 21 payouts, 22 vehicles, two board terms, 26 board entries, 24 media records and ten recaps**. Of the 582 members, 580 are new and two reuse existing accounts.

| Quarter | Events | Signups | Memberships |
|---|---:|---:|---:|
| Fall 2024 | 7 | 130 | 38 |
| Winter 2025 | 7 | 177 | 53 |
| Spring 2025 | 8 | 199 | 28 |
| Fall 2025 | 8 | 196 | 57 |
| Winter 2026 | 7 | 238 | 67 |
| Spring 2026 | 0 | 0 | 0 |
| Fall 2026 | 2 | 181 | 159 |

## Data and contract changes

Alembic revision `b51e773a08fd` adds `quarters.reimbursement_data_available` and allows null `signups.seats` and `signups.joined_at`. The signup role constraint also accepts `unknown` for closed historical records. Live signup input still accepts only ride, driver and own transport, with its existing vehicle/seat validation. No event-date, payment-estimation, import-tracking, or per-trip eligibility columns are added.

Quarter, reimbursement, membership-benefit and dashboard responses expose reimbursement availability and return null financial values for quarters without recorded reimbursement data. Signup projections return nullable seats/timestamps and derived `attendance_status`; a completed historical event without a completion snapshot has unknown attendance instead of fabricated missed attendance. Field arrival counts are nullable in that case. Gallery responses include `ends_at` for retreat date ranges. Frontend transport types are generated from OpenAPI, and all affected member/officer views handle these values. Readiness checks the current migration head rather than a hardcoded baseline.

Reimbursement eligibility is **always member/quarter**. The importer uses the existing driver registration's quarter override and discards legacy trip eligibility flags. Winter's frozen approved amounts and paid status remain unchanged even when quarter-wide eligibility differs from the old per-trip calculation. BI financial ledger transactions and analytical turnout summaries have no supported view and are excluded; individual membership, signup and reimbursement records populate the existing views.

Retreat dates are ordinary event dates: Sequoia & Kings Canyon November 8–10, 2024; Death Valley February 14–16, 2025; Zion May 23–26, 2025; Central Coast November 21–23, 2025; Joshua Tree February 20–22, 2026. Known paid records without dates use the quarter end. There are no approximate-date fields, payment-estimation flags, or such labels in the UI.

## Operation and validation

`scripts/prepare-historical-import.py` reads a private PostgreSQL MVP snapshot, BI's committed canonical CSV, and the static site's trusted data arrays/photos. It writes a private normalized bundle, source checksums and accounting. It does not rebuild BI's data pipeline or modify source data. Names alone do not merge accounts; the two additional driver links were expressly confirmed by the owner.

`python -m app.historical_import` defaults to a full rollback dry run. Apply uses one transaction and an advisory lock, validates identities and operational details, sanitizes media into WebP derivatives, and records the fixed `history.import` audit marker `aac-historical-import-v1`. A second application is refused. Private reports retain source mappings and checksums; no persistent import framework or mapping table is introduced. Future backfills require a separately scoped operation.

Before deployment/apply, save a coordinated local PostgreSQL dump and media archive. Deploy code only by pushing `Website/aac-rebuild`; the existing Coolify GitHub source redeploys the separate web and API services. After schema readiness succeeds, feed the private bundle to the API container's CLI over SSH stdin, first without `--apply`, then with it. Capture the full reports in the private local directory, never in Git. Data transfer for this one-time import is separate from native code deployment.

The rehearsal uses a disposable PostgreSQL database seeded with the target's actual account bindings and grants. Checks cover exact combined counts, both account reuses, preserved identity/grants, quarter-level eligibility, frozen payouts, missing financial data, nullable historical participation, rollback/media cleanup, competing imports, second-apply refusal, and rejected unknown live signup roles. Populated views are checked at 360/390px phone, 768px tablet and 1440px desktop widths, plus iPhone WebKit. Phone keyboard regression tests use synthetic isolated fixtures and never mutate imported or live records. Private datasets, reports, cookies and roster screenshots are excluded from Git.
