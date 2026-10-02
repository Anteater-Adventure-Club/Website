# Verification: evidence now and acceptance after implementation

## Checks performed during planning

| Check | Observed result | Limit |
|---|---|---|
| Source design inventory | 60 distinct panels extracted from actual canvas, including dialogs and compound states | Panels are not 60 independent routes. |
| Render both exports | 60 panels in each; identical rendered panel text; zero captured page exceptions or failed requests | Ran in installed headless Helium through Playwright; not a production app. |
| Visual inspection | Captured all 60 panels, reviewed five contact sheets, captured the bottoms of all 11 scrollable phone panels | Contact sheets preserve overview evidence; detailed target comparisons are required after implementation. |
| Design interactions | Tap-to-seat changes state; Fill the Rest changes waiting list; calendar Next changes month | This checks the prototype, not backend persistence or authorization. |
| Canvas at device sizes | All 60 panels remain present at 390×844, 768×1024, 1440×900 | The canvas uses fixed artboard sizes and cannot prove app responsiveness. |
| MVP API inventory | 67 operations accounted for in API gap matrix | Behavior must be rewritten against clean schema and contracts. |
| Selected MVP backend suites | **84 passed, 3 skipped**, one Starlette/httpx deprecation warning, 4.82 seconds | Disposable SQLite, existing Python 3.14 virtualenv; PostgreSQL-specific concurrency tests skipped. Not proof of the planned Python 3.12/container implementation. |
| Server read access | Reached lab0-apps/.77 using existing dedicated SSH key; capacity and running containers inspected | No resources provisioned, app files uploaded or deployments triggered. |
| Git repository | SSH read access succeeds; initially no refs | No push/write access test performed. |
| Coolify | API 4.3.23; target server identified; organization source installation and private target repository confirmed | First new-application push trigger remains an implementation acceptance test. |
| Ingress | Owner supplied working hostname, automatic TLS and working webhook routing | New application route/TLS/OAuth must be verified after creation. |
| Document integrity | All 60 panels, 67 operations, 16 features and 9 decisions accounted for; zero broken local links; source designs unchanged; no API credential content in documents | Checks the planning package, not implemented application coverage. |

The sandboxed MVP test run stalled in the test client and was stopped. The same selected suites completed outside the sandbox, with `TEST_DATABASE_URL` and `DATABASE_URL` removed so only disposable fixtures were used. The three skipped cases require PostgreSQL. No old verification report was counted as a new-site test result.

The prototype server returned a missing `/favicon.ico` response; no design asset needed for rendering failed. The request-failure counts above measure transport failures, not every HTTP status. The final application must supply its own normal static-asset handling.

Executed suite selection: `test_portal.py`, `test_club.py`, `test_bulk_import.py`, `test_officers_directory.py` in the MVP backend. Results establish useful reference behavior only. Migration/legacy/old-guarantee assertions are not new-site acceptance criteria.

Evidence: [source fingerprints, rendered text and interaction results](evidence/design-audit.json), [panels 1–12](evidence/contact-1.jpg), [13–24](evidence/contact-2.jpg), [25–36](evidence/contact-3.jpg), [37–48](evidence/contact-4.jpg), [49–60](evidence/contact-5.jpg), [phone scroll bottoms A](evidence/scroll-contact-1.jpg), [phone scroll bottoms B](evidence/scroll-contact-2.jpg). Original full-resolution PNGs are temporary `/tmp/aac-design-audit` artifacts; the reference exports and compact evidence are retained with these documents.

[Document coverage/link/credential checks](evidence/document-checks.json) record the final planning-package validation.

## Implementation test matrix

| Class | Required dimensions | Purpose |
|---|---|---|
| Phone | 360×800; 390×844 | Full workflows, sheets, field desk, keyboard/safe-area behavior. |
| Tablet | 768×1024; 1024×768 | Portrait/landscape, navigation transitions, form/table reflow. |
| Desktop | 1280×800; 1440×900 | Full layouts, side panels, calendar, close-out tables. |
| Stress/boundaries | 320×568; widths 639/640/641, 767/768/769, 1023/1024/1025; 200% zoom | Overflow, layout discontinuities, long text, hidden controls. |

Run every route and applicable panel/state in Chromium at the six primary dimensions. Run complete member/officer journeys in Chromium, Firefox and WebKit at one phone, tablet and desktop size each. Test portrait/landscape transitions without a reload. Validate at least one physical phone's Safari/Chrome keyboard/safe-area behavior if available; if unavailable, state that limitation rather than treating desktop WebKit as a physical-device test.

Each row of the view matrix becomes one or more named Playwright cases using IDs such as `3b-membership-pending`, `6b-check-in-log`, `6b-questions`. Compound panels 8a, 8g, 6b, 6c, 6g and 1f require all their states, not one representative screenshot. Include states implied by workflows but not separately drawn: closed/full signup, no car, required answer missing, upload rejected, stale edit, exhausted cards, retry after network failure, and empty first deployment.

Use deterministic synthetic fixtures with fixed clock/quarter/date and known identities; test photo assets with controlled dimensions. Capture viewport and full-page screenshots, relevant open dialogs, route/role/viewport metadata, failed requests, console/page errors, test results and accessibility findings. Compare layout intent against the designs, not literal device-frame pixels or made-up sample text. Human-review contact sheets and inspect failures at full resolution. Keep records of deliberate deviations D02/D03/D05/D06/D07 and accessibility changes.

## Required end-to-end journeys

1. **Visitor:** Home -> calendar month/day with multiple events -> event detail -> sign-in return path; board/past boards/dialog; membership information; gallery popup; real 404 and draft privacy.
2. **Member:** OAuth fixture -> profile and saved car -> external dues submission -> officer confirmation -> paid/exception state -> ordinary/retreat signup -> edit/cancel -> personal history -> own reimbursement explanation.
3. **Officer event setup:** create quarter -> one-off event -> weekly picnic without signups -> A/B recurrence -> preview/skip/one-date edit -> multi-day retreat -> publish -> freeze question definitions after signup -> duplicate draft.
4. **Meeting/dues:** find pending member on phone -> confirm actual payment -> approve $0 exception -> correction with original receipt retained -> inspect history; registered-driver eligibility override must not change dues or ride benefits.
5. **Imports:** paste/headered/headerless CSV/TSV and Google Forms -> preview mixed rides/timestamps -> invalid row blocks entire batch -> apply valid batch -> repeated/concurrent apply produces one result -> imported member later claims own profile.
6. **Field operations:** concurrent officers -> arrive riders/driver/own ride -> skip missing card -> exhaust/add inventory -> late-release quick extension -> atomic walk-in -> fill remaining seats without moving existing riders -> manually move/unseat -> undo arrival -> recover after a dropped connection.
7. **Completion/publication:** complete event -> frozen attendance recap -> upload/crop photo -> save draft remains private -> publish gallery/home -> edit draft without changing public content -> republish/unpublish -> cancellation reason remains visible for a different event.
8. **Finance:** actual trip plus manual/$0 override -> cap and proration -> finalize -> deny financial edits -> record external positive payouts -> deny duplicates/future date -> archive -> new quarter starts empty -> archived history remains readable.
9. **Board/access:** create term and entries -> photo/order/color/bio preview -> publish visibility -> revoke officer while preserving bio/member records -> reject removal of last officer, including simultaneous requests -> start next board without silently revoking past access.

Run these journeys on phone/tablet/desktop after unit/integration checks. Financial mutations, imports and race tests use disposable local/CI databases. The working internal deployment gets a clearly scoped smoke fixture; do not mutate the unrelated existing reimbursement deployment.

## Backend and contract acceptance

- Fresh Alembic baseline works on empty PostgreSQL; restart does not seed fake history or restore revoked officers. Generated OpenAPI types match frontend usage.
- Ownership: signed-out/member/officer permissions on every operation; ID substitution cannot expose another member's answers, cars, contacts, payout or financial history. Public serialization tests assert forbidden fields are absent.
- Identity: exact UCI/subdomain boundaries, verified OIDC issuer/subject, unique import claiming, duplicate/ambiguous identity errors, safe redirect, session expiry, logout, CSRF origin, immediate access revocation.
- Recurrence: leap/month boundaries, DST transitions, A/B parity, multi-day overlaps, inclusive end, empty B, multiple weekdays, skips and protected exceptions; no duplicate occurrences. Edits must not destroy signups/history.
- Membership: quarter isolation, pending/general distinction, paid and $0 exceptions, immutable corrected receipts, paid imports with unknown receipt history, student/non-student fees, independent reimbursement override.
- Check-in: simultaneous unique arrivals allocate unique category/card numbers; repeated driver requests produce one trip; atomic failed walk-in leaves no arrival; exhausted/missing cards; stale revision conflict; extension expiry based on server time.
- Carpools: concurrent assignments cannot exceed capacity or cross events; unarrived drivers excluded; one rider has at most one car; Fill the Rest preserves manual assignments; paid then arrival ordering and D07 guarantee boundaries.
- Finance: rounding at trip/cap/proration stages, deterministic remainder ties, zero-budget/zero-cost/uncapped/capped cases, huge valid values, no float drift, finalization race, payout uniqueness, protected closed-quarter inputs, no cross-quarter balances.
- Upload/editorial: file signature/decode/size/pixel-limit checks, path traversal resistance, EXIF removal, correct crop/derivatives, private draft access, published snapshot isolation, referenced-file deletion guard.
- Import/export: 1 MiB/1,000-row limits, case matching, alias conflicts, formula injection protection, partial-row rollback, repeat application, expired preview and concurrent state changes, Unknown Car null year and later correction.

Run race tests on real PostgreSQL, including at least 16 concurrent check-ins and 8 repeated driver-arrival requests. SQLite passes cannot waive these cases. Exercise transactions with separate connections/processes, not only sequential requests.

## Accessibility and performance targets

Require no unresolved critical/serious axe findings and manual keyboard/focus review. Do not rely on color alone for cards/status. Labels, errors, live confirmations and stale-state messages must be announced appropriately; dialogs restore focus; all actions have accessible names. Confirm long-form scrolling and fixed bars never hide the focused input/submit control.

Use 500 synthetic members, 40 events in an active quarter plus historical fixtures, a 200-person signup roster, and 10 simultaneous officer desks. These are engineering test defaults for the owner's “few hundred members,” not claimed measured demand. Run five minutes of 50 concurrent mixed browsing/signup users, plus the ten desks polling every two seconds, then a 100-user burst for one minute. Exclude external Google/directory latency from internal API timing and report it separately.

Internal API targets: p95 reads <300ms; p95 mutations <750ms; unexpected error rate <1%; no lost/duplicate writes or capacity violations. Investigate query counts/N+1 and lock contention before adding services. On the configured host, no OOM or sustained swap growth attributable to the new services. For public pages, target LCP <=2.5s, CLS <=0.1 and interaction responsiveness <=200ms under a documented mobile profile; use lab proxies where field INP does not yet exist and do not label them field measurements. Optimize/cap image derivatives and lazy-load lower galleries.

## Deployment acceptance and stopping condition

Follow [deployment-plan.md](deployment-plan.md): verify correct server/source/repository, same-origin API, valid automatic TLS, OAuth callback, private ports, exact deployed revision, real push-triggered redeploys, volume persistence, matched database/media restore, and compatible application rollback. Record build/deploy timings and whether the API/media-volume configuration produces a brief replacement interruption; do not promise zero downtime without evidence.

The website is complete only when every applicable view/state and journey has evidence, required database/browser checks pass, critical defects are fixed, the push-triggered internal deployment works, and recovery is demonstrated. A skipped/blocked required test must be reported and resolved or explicitly accepted by the owner; it is not a pass. Today's planning evidence does not claim those implementation tests have already run.
