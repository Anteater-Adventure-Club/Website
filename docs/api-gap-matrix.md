# API coverage and implementation gaps

The source audit found **67 HTTP operations** in `aac-management-MVP/backend/main.py` and `club.py`. Every operation is accounted for below. Reuse classifications refer to behavior and tests, not copying the old schema or preserving wire compatibility.

## Feature coverage

| Features | Existing evidence | Required work |
|---|---|---|
| F01 | `main.py`, `access.py`, `club_identity.py`; identity/officer tests | Port OIDC/origin/session behavior; remove pre-upgrade fallback and deployed test login; unified identity; immediate grants. |
| F02/F03 | Public event APIs and old public-site visuals | New public DTOs, bounded calendar queries, multiple same-day events, homepage aggregation, gallery and content components. |
| F04 | Officer grants API; old hard-coded board arrays | New terms/board profiles/order/photo/visibility API; independent access grants, current/prior public projections. |
| F05/F06/F07 | Profile, cars, quarterly dues, signup/member-history APIs | New React views; unified identity; retreat gate; explicit privacy DTOs; D02 and D07; immutable snapshots. |
| F08 | Frontend-computed officer overview plus finance report | Dedicated efficient operational dashboard with pending/shortage/draft/unpublished-recap links. |
| F09 | One-off draft/publish/edit/duplicate/complete/cancel; custom questions | Recurrence/types/multi-day/signup switch, cancellation reason, snapshot completion, occurrence exceptions. |
| F10/F12 | Check-in/cards/extension/carpool APIs with event locks | D03/D06/D07, quick chips, atomic walk-in, revisions, polling, preserved manual/edited trips on undo. |
| F11 | `club_imports.py`, preview/apply in `club.py`, directory and CSV | Reuse parser/limits/claiming concepts; replace legacy models; persist scoped previews and atomic idempotent application. |
| F13/F14/F15 | `calculations.py`, ledger report/CRUD/finalize/pay/archive | Preserve Decimal math; unified events/members, explicit eligibility override, frozen snapshots, protected audit API. |
| F16 | Completion counts only | New upload/derivative service, completion snapshot, public recap draft/publish separation; do not leak private recap statistics. |

## Existing operation dispositions

Notation: qid = quarter, eid = event occurrence, sid = signup, vid = vehicle, pid = payout where used in finance. New contracts use member IDs instead of legacy driver/participant IDs. All admin endpoints require database-checked officer access; all `/me` operations require ownership.

| Existing operation | Source | Disposition | Replacement contract | Notes |
|---|---|---|---|---|
| `GET /api/health` | [health](../../aac-management-MVP/backend/main.py#L144) | Adapt | `GET /api/health/ready` | Database readiness; add independent liveness endpoint. |
| `GET /api/session` | [session](../../aac-management-MVP/backend/main.py#L146) | Adapt | `GET /api/session` | Member ID, roles, profile completeness, OAuth availability; no deployed test-login flag. |
| `GET /api/auth/login` | [login](../../aac-management-MVP/backend/main.py#L154) | Reuse behavior | `GET /api/auth/login` | UCI Google OAuth and safe local return path. |
| `GET /api/auth/callback` | [callback](../../aac-management-MVP/backend/main.py#L159) | Adapt | `GET /api/auth/callback` | One member identity, no legacy session or driver binding. |
| `POST /api/auth/test` | [test_login](../../aac-management-MVP/backend/main.py#L170) | Remove from runtime | `None in deployed application` | Isolated test fixture authentication only; never deploy passphrase bypass. |
| `POST /api/auth/logout` | [logout](../../aac-management-MVP/backend/main.py#L175) | Reuse behavior | `POST /api/auth/logout` | Clear session; client clears cached private data. |
| `GET /api/quarters` | [quarters](../../aac-management-MVP/backend/main.py#L177) | Adapt | `GET /api/quarters` | Public-safe ID/name/dates/state only; paginated; no historical status flags. |
| `GET /api/public/{qid}` | [public](../../aac-management-MVP/backend/main.py#L179) | Replace D02 | `GET /api/membership-benefits?quarter_id={qid}` | Budget and coverage sentence only; remove full public ledger. |
| `GET /api/me/{qid}` | [mine](../../aac-management-MVP/backend/main.py#L182) | Adapt | `GET /api/me/reimbursements?quarter_id={qid}` | Use authenticated member ID, own trips/payout only. |
| `GET /api/admin/officers` | [officers](../../aac-management-MVP/backend/main.py#L201) | Adapt | `GET /api/admin/officers` | Grants by unified member ID; no separate legacy officer identity table. |
| `POST /api/admin/officers` | [add_officer](../../aac-management-MVP/backend/main.py#L205) | Adapt | `POST /api/admin/officers` | Grant to member_id; verified UCI target and audit. |
| `DELETE /api/admin/officers/{email}` | [remove_officer](../../aac-management-MVP/backend/main.py#L216) | Adapt | `DELETE /api/admin/officers/{member_id}` | Immediate revocation and transactional last-officer guard. |
| `GET /api/admin/directory` | [directory](../../aac-management-MVP/backend/main.py#L228) | Reuse behavior | `GET /api/admin/directory?email=...` | Unique exact UCI directory match; unavailable/ambiguous leaves manual entry available. |
| `GET /api/admin/{qid}` | [dashboard](../../aac-management-MVP/backend/main.py#L234) | Adapt | `GET /api/admin/quarters/{qid}/reimbursements` | Private report separate from operational dashboard, grouped queries. |
| `POST /api/admin/quarters` | [add_quarter](../../aac-management-MVP/backend/main.py#L248) | Adapt | `POST /api/admin/quarters` | Clean quarter with valid nonoverlapping dates; no history bootstrap. |
| `PUT /api/admin/quarters/{qid}` | [update_quarter](../../aac-management-MVP/backend/main.py#L251) | Adapt | `PUT /api/admin/quarters/{qid}` | Reject outside event ranges and finalized/archived edits. |
| `POST /api/admin/{qid}/drivers` | [add_driver](../../aac-management-MVP/backend/main.py#L266) | Adapt | `POST /api/admin/quarters/{qid}/drivers` | Create/reuse member; register driver, no duplicate driver identity. |
| `PUT /api/admin/{qid}/drivers/{did}/membership` | [membership](../../aac-management-MVP/backend/main.py#L273) | Adapt | `PUT /api/admin/quarters/{qid}/drivers/{member_id}/eligibility` | Nullable reimbursement override plus reason; does not approve dues or alter ride priority. |
| `POST /api/admin/{qid}/events` | [add_event](../../aac-management-MVP/backend/main.py#L284) | Consolidate D04 | `POST /api/admin/events` | Same unified event creation as create_event; body includes quarter_id. |
| `PUT /api/admin/events/{eid}` | [update_event](../../aac-management-MVP/backend/main.py#L289) | Adapt | `PUT /api/admin/events/{eid}/mileage` | Dedicated financial field edit remains available after completion until quarter finalize. |
| `POST /api/admin/events/{eid}/trips` | [add_trip](../../aac-management-MVP/backend/main.py#L299) | Adapt | `POST /api/admin/events/{eid}/trips` | Member ID, cost override and notes; one trip/member/event; track manual provenance. |
| `DELETE /api/admin/trips/{tid}` | [delete_trip](../../aac-management-MVP/backend/main.py#L304) | Adapt | `DELETE /api/admin/trips/{tid}` | Detach auto-trip provenance safely; enforce quarter state. |
| `POST /api/admin/{qid}/finalize` | [finalize](../../aac-management-MVP/backend/main.py#L309) | Adapt | `POST /api/admin/quarters/{qid}/finalize` | Atomic frozen snapshot and duplicate-safe repeated result. |
| `PUT /api/admin/payouts/{pid}` | [payment](../../aac-management-MVP/backend/main.py#L317) | Adapt | `PUT /api/admin/payouts/{pid}/payment` | Full external payout, date/reference, duplicate protection. |
| `POST /api/admin/{qid}/archive` | [archive](../../aac-management-MVP/backend/main.py#L325) | Reuse behavior | `POST /api/admin/quarters/{qid}/archive` | All positive payouts paid; archive repeat-safe, audit once. |
| `GET /api/admin/audit/recent` | [audit](../../aac-management-MVP/backend/main.py#L331) | Retain D01 | `GET /api/admin/audit/recent` | Latest 100 officer-only records; no new screen. |
| `GET /api/club/profile` | [profile](../../aac-management-MVP/backend/club.py#L181) | Adapt | `GET /api/me/profile` | Unified member profile, no driver linkage. |
| `PUT /api/club/profile` | [save_profile](../../aac-management-MVP/backend/club.py#L188) | Adapt | `PUT /api/me/profile` | Own contact/driving fields; OIDC email not freely editable. |
| `PUT /api/club/profile/payout` | [save_payout](../../aac-management-MVP/backend/club.py#L197) | Adapt | `PUT /api/me/payout-details` | Private destination, phone suffix; blank/prefer-not-to-say supported. |
| `GET /api/club/vehicles` | [vehicles](../../aac-management-MVP/backend/club.py#L220) | Reuse behavior | `GET /api/me/vehicles` | Only own active vehicles. |
| `POST /api/club/vehicles` | [add_vehicle](../../aac-management-MVP/backend/club.py#L225) | Reuse behavior | `POST /api/me/vehicles` | Passenger capacity excludes driver; ordinary entries require real year. |
| `PUT /api/club/vehicles/{vid}` | [update_vehicle](../../aac-management-MVP/backend/club.py#L231) | Reuse behavior | `PUT /api/me/vehicles/{vid}` | Ownership and capacity checks; existing signup snapshot preserved. |
| `DELETE /api/club/vehicles/{vid}` | [remove_vehicle](../../aac-management-MVP/backend/club.py#L238) | Reuse behavior | `DELETE /api/me/vehicles/{vid}` | Soft removal; preserve prior signup/trip references. |
| `GET /api/club/membership/{qid}` | [my_membership](../../aac-management-MVP/backend/club.py#L248) | Adapt | `GET /api/me/memberships/{qid}` | Quarter status and own receipt history only. |
| `POST /api/club/membership/{qid}` | [apply_membership](../../aac-management-MVP/backend/club.py#L255) | Reuse behavior | `POST /api/me/memberships/{qid}` | Student category/external method; pending is not approved; repeat-safe submission. |
| `GET /api/club/events` | [public_events](../../aac-management-MVP/backend/club.py#L305) | Adapt | `GET /api/events?from=...&to=...` | Bounded date query, all overlapping multi-day dates, series metadata, no drafts/private recap statistics. |
| `GET /api/club/events/{eid}` | [public_event](../../aac-management-MVP/backend/club.py#L311) | Adapt | `GET /api/events/{eid}` | Explicit public DTO; signup-switch and cancellation details; D07 capacity semantics. |
| `GET /api/club/admin/quarters/{qid}/events` | [officer_events](../../aac-management-MVP/backend/club.py#L317) | Adapt | `GET /api/admin/events?quarter_id={qid}` | One series row with next date plus standalones; filters/search and occurrence links. |
| `POST /api/club/admin/quarters/{qid}/events` | [create_event](../../aac-management-MVP/backend/club.py#L326) | Consolidate D04 | `POST /api/admin/events` | Unified event DTO, series handled through series endpoints below. |
| `GET /api/club/admin/events/{eid}` | [manage_event](../../aac-management-MVP/backend/club.py#L335) | Adapt | `GET /api/admin/events/{eid}` | Private management DTO, revisions and permitted actions; no legacy pseudo-event fallback. |
| `PUT /api/club/admin/events/{eid}` | [edit_event](../../aac-management-MVP/backend/club.py#L345) | Adapt | `PUT /api/admin/events/{eid}` | Editor fields/state validation, question immutability, signup-switch restrictions, expected_revision. |
| `POST /api/club/admin/events/{eid}/state` | [event_state](../../aac-management-MVP/backend/club.py#L366) | Adapt | `POST /api/admin/events/{eid}/state` | draft/published/completed/cancelled action with reason where required; snapshot completion. |
| `POST /api/club/admin/events/{eid}/duplicate` | [duplicate_event](../../aac-management-MVP/backend/club.py#L375) | Adapt | `POST /api/admin/events/{eid}/duplicate` | Target quarter in body; single fresh draft without people/finance/published recap. |
| `POST /api/club/events/{eid}/signup` | [signup](../../aac-management-MVP/backend/club.py#L428) | Adapt | `PUT /api/events/{eid}/signup` | Atomic own signup/contact update, retreat membership gate and capacity, stable request ID. |
| `DELETE /api/club/events/{eid}/signup` | [cancel_signup](../../aac-management-MVP/backend/club.py#L434) | Reuse behavior | `DELETE /api/events/{eid}/signup` | Own cancellation only before lock; keep historical record. |
| `GET /api/club/signups` | [my_signups](../../aac-management-MVP/backend/club.py#L445) | Adapt | `GET /api/me/signups?quarter_id={qid}` | Derived event-cancelled state and own limited ride details. |
| `GET /api/club/admin/events/{eid}/signups` | [event_signups](../../aac-management-MVP/backend/club.py#L452) | Adapt | `GET /api/admin/events/{eid}/signups` | Private roster, ride/search filters, pagination and counts. |
| `POST /api/club/admin/events/{eid}/signups` | [officer_signup](../../aac-management-MVP/backend/club.py#L460) | Adapt | `POST /api/admin/events/{eid}/signups` | Add existing member without check-in; normal active-event rules. |
| `DELETE /api/club/admin/signups/{sid}` | [officer_cancel](../../aac-management-MVP/backend/club.py#L466) | Reuse behavior | `DELETE /api/admin/signups/{sid}` | Officer removal only before check-in; no history deletion. |
| `GET /api/club/admin/events/{eid}/check-in` | [checkin_state](../../aac-management-MVP/backend/club.py#L474) | Adapt | `GET /api/admin/events/{eid}/check-in` | Revision, server_time, counts, next-card previews, current assignments and future extension chips. |
| `POST /api/club/admin/signups/{sid}/check-in` | [check_in](../../aac-management-MVP/backend/club.py#L481) | Adapt | `POST /api/admin/signups/{sid}/check-in` | Transaction and event lock; idempotent receipt and auto-trip provenance. |
| `DELETE /api/club/admin/signups/{sid}/check-in` | [undo_check_in](../../aac-management-MVP/backend/club.py#L506) | Adapt | `DELETE /api/admin/signups/{sid}/check-in` | Void card, clear seating, remove only unchanged arrival-owned trip; retain log action. |
| `POST /api/club/admin/signups/{sid}/extension` | [extension](../../aac-management-MVP/backend/club.py#L527) | Replace UI D03 | `POST /api/admin/signups/{sid}/extension` | Chip token/instant + reason; validate offered future option and audit. |
| `POST /api/club/admin/events/{eid}/cards/void` | [void_card](../../aac-management-MVP/backend/club.py#L538) | Reuse behavior | `POST /api/admin/events/{eid}/cards/void` | Unissued missing cards only; never reuse numbers. |
| `PUT /api/club/admin/events/{eid}/cards` | [inventory](../../aac-management-MVP/backend/club.py#L552) | Reuse behavior | `PUT /api/admin/events/{eid}/cards` | Cannot reduce below issued/void maximum; event lock. |
| `POST /api/club/admin/events/{eid}/carpools` | [assign](../../aac-management-MVP/backend/club.py#L566) | Adapt | `PUT /api/admin/events/{eid}/carpools/{rider_signup_id}` | driver_signup_id or null plus expected_revision; checked-in eligibility and capacity. |
| `POST /api/club/admin/events/{eid}/carpools/suggest` | [auto_assign](../../aac-management-MVP/backend/club.py#L585) | Replace D06 | `POST /api/admin/events/{eid}/carpools/fill` | Fill unassigned riders into free arrived seats without deleting assignments. |
| `POST /api/club/admin/participants` | [add_person](../../aac-management-MVP/backend/club.py#L605) | Adapt | `POST /api/admin/members` | Create/reuse unified member; allow named no-email walk-ins; no silent merge of claimed identities. |
| `POST /api/club/admin/participants/{pid}/vehicles` | [officer_vehicle](../../aac-management-MVP/backend/club.py#L614) | Adapt | `POST /api/admin/members/{member_id}/vehicles` | Officer-created vehicle for walk-in/registration; same capacity validation. |
| `GET /api/club/admin/participants/{pid}/vehicles` | [officer_vehicles](../../aac-management-MVP/backend/club.py#L619) | Adapt | `GET /api/admin/members/{member_id}/vehicles` | Officer lookup, active vehicles only. |
| `GET /api/club/admin/quarters/{qid}/members` | [members](../../aac-management-MVP/backend/club.py#L624) | Adapt | `GET /api/admin/members?quarter_id={qid}` | Search/filter/pagination, actual collected receipts and separate exception counts. |
| `GET /api/club/admin/quarters/{qid}/members/{pid}` | [member_detail](../../aac-management-MVP/backend/club.py#L638) | Adapt | `GET /api/admin/members/{member_id}?quarter_id={qid}` | All event/dues history and private payout information; no legacy driver-link section. |
| `POST /api/club/admin/quarters/{qid}/members/{pid}/dues` | [approve_dues](../../aac-management-MVP/backend/club.py#L666) | Adapt | `POST /api/admin/members/{member_id}/memberships/{qid}/decision` | payment/exception/general only; audited corrections; remove accommodation alias. |
| `POST /api/club/admin/participants/{pid}/driver-link` | [link_driver](../../aac-management-MVP/backend/club.py#L688) | Remove D05 | `None` | Unified identity eliminates old imported-workbook driver linking. |
| `GET /api/club/admin/events/{eid}/export` | [export_signups](../../aac-management-MVP/backend/club.py#L717) | Reuse behavior | `GET /api/admin/events/{eid}/signups.csv` | Private export, formula-safe cells, stable column meanings. |
| `POST /api/club/admin/quarters/{qid}/members/import` | [import_members](../../aac-management-MVP/backend/club.py#L791) | Adapt | `POST /api/admin/imports/preview; POST /api/admin/imports/{preview_id}/apply` | Modes members/paid_members; signed or persisted preview, atomic apply/idempotency. |
| `POST /api/club/admin/events/{eid}/participants/import` | [import_event_participants](../../aac-management-MVP/backend/club.py#L828) | Adapt | `POST /api/admin/imports/preview; POST /api/admin/imports/{preview_id}/apply` | participants mode and event scope; mixed Google Forms rides/times/vehicle placeholders. |

## New operation contracts

These are additions, not capabilities inferred to exist merely because a Vue page looks similar. Reuse shared domain services across endpoints rather than making HTTP calls between backend modules.

| Operation | Request / query | Response / contract |
|---|---|---|
| `GET /api/health/live` | None | Process liveness and baked source commit SHA; no database dependency. |
| `GET /api/home` | Current time resolved by server | Public upcoming occurrences, recurring summaries and published homepage polaroids; no member-specific cache contents. |
| `GET /api/membership-benefits` | `quarter_id` | Quarter identity, budget and coverage only; no full report/driver/event cost rows. |
| `GET /api/me/overview` | `quarter_id` | Own membership and signup previews, next event chosen by open-window priority. |
| `GET /api/admin/overview` | `quarter_id` | Approved/exception/pending membership counts, actual dues received, budget/payout estimates, attention items with target IDs. |
| `GET /api/board` | Optional `term_id`; default current | Public term and ordered visible profiles; no account emails or site-access flags. |
| `GET /api/board/terms` | `limit`, `offset` | Public term list newest first, current marker. |
| `GET, POST /api/admin/board/terms` | POST: academic-year label/start year | Ordered terms; starting a new current term retains old entries/access and creates an empty new board. |
| `GET /api/admin/board/terms/{id}` | Term ID | Editable profiles and access state for that term. |
| `POST /api/admin/board/terms/{id}/entries` | BoardEntryInput | Add current or historical entry linked to a member where access is needed; optional new grant processed atomically. |
| `PUT, DELETE /api/admin/board/entries/{id}` | PUT: BoardEntryInput + revision | Edit or remove presentation; removal never silently revokes site access. Grant/revoke remains an explicit checkbox/action. |
| `PUT /api/admin/board/terms/{id}/order` | Ordered entry IDs + revision | Validate every ID belongs to term and appears exactly once; keyboard and drag actions share endpoint. |
| `POST /api/admin/media` | Multipart file, `purpose=board/event`, crop focal point | Validated media ID, dimensions, derivative descriptors and protected preview URL. Reject oversized/undecodable images with field error. |
| `GET /api/admin/media/{id}` | Officer session | Draft preview; no-store. |
| `DELETE /api/admin/media/{id}` | Expected revision | Only unreferenced asset; clear errors if used in draft or publication. |
| `GET /media/{id}/{variant}` | Public derivative reference | Published/visible images only, correct content type, immutable content-based cache key; unknown/private assets return 404. |
| `GET /api/gallery` | Date/offset/limit | Published recap projections ordered newest first; separate from attendance. |
| `GET /api/gallery/{event_id}` | Published event reference | Public polaroid, caption and authored recap for gallery dialog/deep link. |
| `GET, PUT /api/admin/events/{id}/recap` | PUT: RecapInput + revision | Private completion snapshot and editable draft; saves do not alter public snapshot. |
| `POST, DELETE /api/admin/events/{id}/recap/publication` | POST: expected revision | Publish validated snapshot or unpublish; reject stale content; do not alter quarter financial locks. |
| `POST /api/admin/series/preview` | SeriesInput | Expanded local dates/times, skipped/exception dates and conflicting existing occurrences; no writes. |
| `POST /api/admin/series` | SeriesInput + request ID | Create series and materialized occurrences atomically; unique original recurrence dates. |
| `GET /api/admin/series/{id}` | Series ID | Definition, dated occurrences, exception and participation flags for series management. |
| `PUT /api/admin/series/{id}` | SeriesInput + `effective_from` + revision | Future-only change; return affected IDs or 409 listing protected/participating conflicts. |
| `POST /api/admin/events/{id}/skip` | Expected revision; series occurrence only | Skip only an unparticipated occurrence; otherwise require event cancellation with reason. |
| `GET /api/admin/events/{id}/questions` | Event ID | Stable question definitions, answer aggregates and private per-member rows. |
| `GET /api/admin/events/{id}/check-in-log` | Pagination | Recorded arrivals/undos, actor/time, current status; not reconstructed solely from active check-ins. |
| `POST /api/admin/events/{id}/walk-ins` | Member/contact/transport/vehicle/answers + request ID | One atomic member+signup+arrival transaction; returns actual issued card, never an optimistic preview. |
| `PUT /api/admin/trips/{id}` | Decimal cost override or null, notes, revision | Edit trip without remove/re-add; mark manual adjustment so later attendance undo cannot erase it. |

## Minimum DTO specification

These field groups define the required interfaces. Do not serialize SQLAlchemy records directly.

- `EventWrite`: `quarter_id`, name, type, destination, description, local start/end with timezone/offset, `signups_enabled`, optional event photo ID, packing list, optional signup-open/close and transport arrival/departure/return, questions, miles/rate. For signup-disabled events omit operational fields; reject attempts to mutate hidden operations through their APIs. State changes use the state endpoint after creation.
- `SeriesInput`: `EventWrite` defaults, recurrence kind weekly/alternating, Monday anchor, weekdays A/B (0=Monday through 6=Sunday), inclusive start/until dates, local start/end times, excluded local dates. Non-repeating and multi-day events use `EventWrite`, not this DTO. Reject range exceeding selected quarter.
- `EventPublic`: ID/slug, public text/photo, type, dates, cancelled reason, series summary/next dates, current permitted public actions, signup-window status, transport aggregates/guarantee, optional published recap. No roster, contact, answers, payout data, or private completion snapshot.
- `SignupWrite`: role `ride/driver/own`, optional vehicle ID, offered passenger count, answers by question ID, notes, optional own contact edits, revision and request ID. A driver needs an active owned vehicle and positive offer no greater than its capacity. Member phone required for a normal self-signup. Import rows can retain unknown answers and request completion later.
- `CheckInState`: event revision, server time, private current signup summaries, arrived/seat/card counters, next-card previews, assignments, permitted extension chip timestamps. Issue new chips as time passes; writes validate current status under lock.
- `MembershipDecision`: category payment/exception/general, student boolean, amount/date/method/reference for payment, required reason for exceptions/corrections/general return. Preserve original receipt; `amount=0` does not invent a payment record. New receipt dates cannot be future Pacific dates.
- `DriverEligibility`: nullable `eligible_override` and reason. Null follows approved membership; explicit true/false overrides financial eligibility only.
- `QuarterReport`: quarter and lock state; aggregate nominal/eligible/capped/allocated/paid/pending totals; private driver rows with precise decimal calculation inputs and frozen payout; event trip summaries. Public benefit DTO exposes only budget/coverage.
- `BoardEntryInput`: member link or public-only name, role/major/bio/favorite memory/Instagram URL, image/crop, palette pair key, visible flag, sort position, site-access flag when a member is linked. Validate safe HTTPS social URLs and enumerated palette pairs. Historical entry content remains independent of the member's current profile.
- `RecapInput`: image ID, title, caption, plain-text recap <=500 characters, homepage inclusion, crop and revision. Published content uses a separate snapshot; no arbitrary HTML.
- `ImportPreview`: mode `members/paid_members/participants`, quarter ID and optional event ID, CSV/TSV text, membership category or fallback transport as appropriate. Return row issues, proposed actions, skipped/conflicting records, preview ID, request hash and expiry. Apply accepts only that preview ID/hash; revalidate current database state and authorization. Expire previews after 30 minutes and never apply a stale preview silently.

Imports retain the MVP's 1 MiB/1,000-row bounds, headerless name/email/phone support, case-insensitive aliases, Google Forms mixed transport/passenger/timestamp handling, Pacific interpretation of supplied timestamps, existing-signup preservation, actual-receipt-only totals, and repeat/concurrency safety. Represent unknown imported vehicle year as null rather than the MVP's `year=0` sentinel; mark the source unknown and allow later correction.

List/detail/aggregation queries must avoid the MVP's per-event/per-signup N+1 lookup pattern. Index quarter/date/state, event/member uniqueness, normalized email, event/card category/number, and assignment driver/rider lookups. Prefer grouped SQL queries plus small in-memory DTO assembly at this membership scale.

## Business-rule reuse and replacement tests

Reuse the arithmetic examples from `test_portal.py`, card/idempotency/CSV/quarter cases from `test_club.py`, import boundaries from `test_bulk_import.py`, and directory/last-officer cases from `test_officers_directory.py`. Rewrite fixtures against the clean schema and routes. Do not mechanically port migration/history or under-15-guarantee expectations; D03/D05/D06/D07 and the new recurrence/media rules require new assertions.
