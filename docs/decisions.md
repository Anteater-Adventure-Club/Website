# Decisions and scope dispositions

The owner's answers during the planning session are authoritative. IDs are referenced throughout the implementation and view specifications.

## Explicit product decisions

| ID | Question / discrepancy | Owner's decision | Implementation effect |
|---|---|---|---|
| D01 | MVP recent-audit API has no general audit screen | Keep recording and officer API without a screen | Retain audit model and protected recent-read endpoint; do not invent Settings UI. |
| D02 | Full public Budgets report has no equivalent view | Show only the Membership budget display as designed | Keep budget/coverage sentence from 3b; remove public allocations/payments/event-cost report and standalone Budgets route. |
| D03 | Arbitrary extension datetime vs quick chips | Offer only time chips | Server offers future chip timestamps; no Other/custom input. Audit selected time, actor, reason. |
| D04 | Separate reimbursement-only event editor | Use the unified event editor for all events | One event entity/editor; per-event Trips & Mileage replaces standalone Mileage/Attendance pages. |
| D05 | Designed legacy driver linking conflicts with fresh data | Remove legacy linking; use one member identity | Remove that subsection of 7e and 3j, old driver-link endpoint, backfills and duplicate driver/account model. Preserve normal import/manual-account claiming. |
| D06 | MVP Arrange Seats discards existing assignments | Preserve assignments; fill remaining seats only | Replace auto-assignment algorithm; no Rebuild All control. |
| D07 | MVP guarantees when paid riders <15 regardless of capacity | Paid priority; guarantee only when offered seats cover paid riders | Remove under-15 exception and unconditional promise; compute on server. |
| D08 | Initial deployment hostname | Use aac.internal.gdodge.dev while working | Existing wildcard ingress and automatic TLS; do not assume the domain must point directly to the application host. |
| D09 | Push delivery / GitHub source | Use the configured aac integration and working aac-deployment-hook routing | Native Coolify/GitHub push deployment; no new Actions runner or public ingress redesign. |

## Requirements supplied before drafting

- React rather than Next.js; FastAPI and PostgreSQL; a few hundred members.
- Fresh deployment without transferred data or MVP compatibility migrations.
- Support every supplied design view; adapt layouts where needed for responsiveness and accessibility.
- For each MVP capability absent from the mockups, obtain an individual disposition instead of silently dropping it.
- Use root SSH access to 192.168.4.77 and the supplied Coolify credential. The actual key is at workspace-root `.secrets/coolify_key.txt` (not `secrets/coolify_key.txt`). Never include its contents in source or documents.
- Use branch `aac-rebuild` in git@github.com:Anteater-Adventure-Club/Website.git (owner updated the repository choice); redeploy on push with separate Coolify resources in one project; do not manually upload application files.

## Capability audit closure

The four uncovered active capabilities requiring decisions were audit reads, detailed public finance, arbitrary extension times, and the separate reimbursement-only event editor (D01–D04). The MVP's full-rebuild carpool action was also explicitly replaced (D06). The 67-operation mapping accounts for every API operation; no unmatched operation may disappear during implementation.

Capabilities already represented include exact-email directory lookup (10b/1l), driver registration/eligibility override (10b/1n), payout destinations (3d/7e/1o), import preview and Google Forms (3k and design notes), receipt corrections (7e), event duplication (3i), card void/inventory (6f), custom-question answers (6b), and cost overrides/notes (1m). Consolidation into another view is recorded in the view/API matrices.

Historical workbook imports, unknown historical payment dates, accommodation-name compatibility, pre-upgrade session fallback, schema backfills, migration scripts, and legacy URL aliases are excluded by the owner's explicit fresh-site/no-backward-compatibility requirement. These are not continuing club workflows. Panel 6i remains an archived/read-only view, but its workbook-specific sample text, historical seed data, and `data_status=imported/no_data` model are not carried forward. An empty new quarter is represented honestly as empty.

Old-site Sponsors and short-link routes are not new-design requirements. Old architecture is excluded. Gear lending, elections, automatic messaging, and payment processing are benefit/context copy or explicitly deferred MVP ideas, not existing capabilities that need porting.

## Engineering defaults selected for the implementation

- One unified member identity and event model, server-owned Decimal finance and permissions, PostgreSQL everywhere that validates persistence/concurrency.
- UCI-only Google identity, free general membership and quarter-based paid/exception benefits from the designs/MVP; no new enrollment provider.
- Pacific timezone, explicit materialized occurrences, protected past/exception/participating dates in series edits, and one signup per multi-day retreat.
- Two-second visible-view polling for field operations, transactional mutations and stale-revision conflicts; no offline writes or extra realtime service.
- Same-origin frontend/API, local persistent media volume and derived images; no new object-storage service required for the internal working deployment.
- Separate Coolify frontend/API/PostgreSQL resources; initial conservative limits and workload targets are specified in deployment/verification docs.
- Native Coolify daily database and media backups, plus restore testing, for the internal deployment; no custom backup runner. Before public launch, configure an owner-controlled off-host copy and confirm its retention/recovery requirements.
- Initial officer allowlist defaults to gdodge@uci.edu as found in the supplied club artifacts; bootstrap only once. The implementation reads this through runtime configuration.

These defaults fill implementation detail rather than change the owner's scope decisions. No product question remains unanswered. OAuth credentials, payment destinations, DNS/TLS validation, backup configuration and first-push evidence are deployment inputs/checks, not claimed completed work.

## Infrastructure correction

During discovery, public DNS returned private IP 192.168.4.78 for the internal domains. That alone did not establish webhook reachability. The owner confirmed existing routing makes GitHub delivery work and completed the organization integration during the session. Use that routing; do not add a runner or expose a new endpoint based on the earlier inference.

## Homepage clarification during implementation

The owner requested the exact supplied About section titles, copy, photos, and seasonal/week captions. These remain fixed editorial content for now. Restore Hikes, City Exploration, Potluck Picnics, and Quarterly Retreats from the combined homepage mockup. Every “Find your next adventure” link opens the full calendar with no activity/type filter. Hero cards read published homepage-selected recaps, with real titles and full dates, and cycle when more than two exist; supplied mockup examples are the empty-store fallback. Respect reduced motion and offer Pause/Resume. The verified Discord invite is `https://discord.gg/aWx6Apz74n` and is set as a runtime setting.
