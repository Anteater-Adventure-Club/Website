# Page-speed review — October 5, 2026

Status: local implementation and validation complete; no push or deployment. Worktree: `aac-page-speed`, branch `feat/page-speed`. Runtime candidate `e8e2725` includes upstream through `1e00a03`; the original matched baseline is `1ce3443`. The frontend Dockerfile conflict was resolved by retaining both projects’ required COPY entries.

The change supplies public HomeView data and a responsive hero preload through the existing Nginx SSI response, seeds the normal query cache, versions static assets for long caching, splits non-home public routes, preserves analytics with a narrow CSP allowance, serves valid robots.txt, and fixes caption/heading semantics. Common font subsets preserve glyph outlines and widths. The shared stylesheet is embedded in fresh HTML to remove its blocking request. Uploaded media keeps its private five-minute cache policy and publication checks.

## Matched measurements

Lighthouse 13.0.3, Chrome for Testing 153.0.8010.12, Node 24.21.0. Five fresh-browser, cold-navigation runs per build and profile, baseline/candidate interleaved. The two methods run sequentially after functional browser checks and image builds finish. Both builds use the same isolated photographic fixtures and local production Nginx; gzip is enabled equally to approximate edge compression. These are local comparisons, not the supplied live scores or field measurements.

Mobile: 412×823 CSS pixels, DPR 1.75, CPU slowdown 4. Simulated networking uses 150 ms RTT and 1638.4 Kbps. Applied DevTools networking uses the Lighthouse profile’s 562.5 ms request latency and 1474.56 Kbps download cap. Desktop: 1350×940, DPR 1, CPU 1; simulation uses 40 ms RTT and 10240 Kbps. The built-in desktop applied profile has zero request latency and an unlimited download setting.

| Method / profile | Perf before → after | FCP before → after | LCP before → after | CLS before → after |
| --- | --- | --- | --- | --- |
| simulated / mobile | 81 → 92 | 1.502s → 1.352s | 5.028s → 3.378s | 0.0047 → 0.0000 |
| simulated / desktop | 98 → 100 | 0.362s → 0.322s | 0.703s → 0.802s | 0.0799 → 0.0000 |
| applied / mobile | 85 → 94 | 2.512s → 2.530s | 3.881s → 2.530s | 0.0047 → 0.0000 |
| applied / desktop | 99 → 100 | 0.081s → 0.087s | 0.081s → 0.087s | 0.0799 → 0.0000 |

Candidate accessibility, best practices and SEO are 100 in every run. Local baseline best practices are already 100 because Cloudflare injection is absent from the local Nginx preview; the live CSP error is validated separately with the real beacon. The baseline simulated LCP varies with its transient fallback photo, so the applied-mode comparison is also reported rather than treating the simulation as a field result.

The 1.8s FCP / 2.5s LCP targets are not fully achieved across both methods. Simulated mobile FCP meets its target, while simulated LCP remains above it. Applied mobile LCP is approximately 2.53s, down from approximately 3.88s; applied FCP is effectively unchanged. Desktop performance remains 100 for the candidate, but simulated desktop LCP increases by about 100 ms while FCP and CLS improve.

The candidate passes cache lifetime, LCP discovery and render-blocking insights. First mobile trace transfer falls from 789332 to 715351 bytes. The image-delivery insight still recommends additional compression/sizing (about 179 KiB in this fixture); native lazy loading also fetches more nearby images once the real page appears immediately, so its per-image warning does not track the total byte reduction. The initial API home/metadata dependencies are removed; session, quarter and site-settings requests remain. No attributed forced reflow appears in either initial-navigation trace; viewport changes additionally avoid redundant writes without claiming that the original reported reflow was conclusively attributed.

## Verification

- 205 backend tests; Ruff; OpenAPI and generated frontend types match; Alembic reports no new migration operations.
- 47 frontend unit tests and the production build. Both production Docker images build, and the production Nginx configuration parses.
- 36 production speed checks across Chromium, Firefox and WebKit at 390 and 1440 pixels: one rendered/preloaded hero request, no initial API-home/metadata requests, no fallback-photo download with valid bootstrap, malformed-data fallback, font requests, rotation/navigation, robots/cache/CSP, sequential headings and zero axe findings.
- 48 existing social metadata/branding checks pass.
- 54 simulated keyboard cases pass across the three engines; six affected dues-confirmation cases were repeated successfully after merging concurrent changes. A stale Vite dependency cache caused the follow-up timeout and was resolved by restarting with --force. No physical phone or native keyboard was tested.
- Font outlines and widths match the supplied full fonts for every basic-subset character at the UI weights 400/500/600/700; composite glyphs are decomposed before comparison. Complete fonts remain available for other characters.
- Phone and desktop screenshots were visually checked. All measured hero/title/activity bounding boxes match the baseline exactly.
- The actual public Cloudflare beacon executes in the candidate with zero console errors and zero DevTools issues. Its synthetic token reports only to an intercepted local /cdn-cgi/rum endpoint; no production analytics were sent. The policy retains connect-src self, as described by [Cloudflare’s CSP guidance](https://developers.cloudflare.com/web-analytics/faq/#what-do-i-need-to-add-to-my-content-security-policy-csp).

## Review artifacts

[Summary JSON](page-speed-2026-10-05.json) contains all medians, ranges, settings and check counts. Full reports and traces are in the ignored `artifacts/page-speed/complete-simulated/` and `complete-applied/` directories. The corresponding `.mjs` runners and temporary local Nginx configurations are saved alongside them.

- Phone: [before](../../artifacts/page-speed/baseline-390.png), [after](../../artifacts/page-speed/candidate-390.png).
- Desktop: [before](../../artifacts/page-speed/baseline-1440.png), [after](../../artifacts/page-speed/candidate-1440.png).
- [Font proof](../../artifacts/page-speed/font-integrity.json), [geometry](../../artifacts/page-speed/geometry.json), [actual beacon check](../../artifacts/page-speed/cloudflare-check.json).

After the user approves deployment, merge any newer upstream changes, rerun affected checks, push to aac-rebuild, and verify both release SHAs and the live public site. The old robots response may be cached at Cloudflare; verify or purge that exact URL after deployment approval. Run live Lighthouse again to measure the real published recaps and edge behavior.
