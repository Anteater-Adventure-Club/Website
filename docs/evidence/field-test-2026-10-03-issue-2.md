# Issue 2: Google sign-in redirect / officers

Prepared on `fix/officer-google-redirect` from live release `00c11695b2a33262589c0a4c7abaf3ab83848c86`. All changes are uncommitted. No production or Google configuration was changed.

## Confirmed defect

Read-only live OAuth initiation on 2026-10-03, using a browser-like `Mozilla/5.0` user agent and stopping before following Google:

| Starting host | HTTP result | Google callback host | Session cookie |
| --- | --- | --- | --- |
| `aac.internal.gdodge.dev` | 302 to Google | `aac.internal.gdodge.dev` | Host-only, HttpOnly, Secure, SameSite=Lax |
| `aac.gdodge.dev` | 302 to Google | `aac.internal.gdodge.dev` | Host-only, HttpOnly, Secure, SameSite=Lax |

There is no Domain attribute on the OAuth session cookie. Public-host initiation therefore stores OAuth state on the public host while its callback goes to the internal host. That callback lacks the state needed to validate the login. The callback catches token/state errors and redirects to `/sign-in?error=oauth`; it does not grant a session. An internal hostname that an external user's network cannot reach can additionally make the browser stall before reaching the callback.

The initial Python-default user-agent public request received 403 from the public gateway; the browser-like request above reached OAuth. That first 403 is not evidence that real browsers cannot initiate OAuth publicly.

Production logs over the preceding 48 hours contained 22 login302, 14 callback303, and 165 session200 entries. No callback4xx/5xx or recognized DB/state exception categories appeared. Callback303 alone cannot distinguish success from the caught OAuth/UCI error redirects. No raw logs, codes, state, cookies, Google client identifiers, or contact data are included here.

## Scope and remaining uncertainty

The user subsequently confirmed that everyone starts at `aac.gdodge.dev`; the owner succeeds on mobile Safari, while other officers appear stuck at the Google redirect/callback with no displayed error. The owner also intermittently sees a first rejection on all platforms. This rules out different starting hosts as the explanation for owner-only success. The confirmed public-to-internal callback/state mismatch applies to their shared starting path. Different access to the internal hostname (LAN, tailnet, DNS, or network policy) could explain why some browsers stall before displaying the caught OAuth error, but that is an inference: final callback host, external-network reachability, and browser network traces remain unverified. Existing internal-host cookies could affect a returning owner's behavior, but were not inspected. Google consent audience/testing/test-user restrictions cannot be determined from the repository or current sanitized HTTP evidence; no Google-console access was used. The source fix and public runtime-origin proposal are therefore concrete corrections to a proven defect, not a claim that every account-specific symptom has been reproduced.

The application login implementation does not check an officer email allowlist; this observation does not establish Google-console audience/test-user configuration. It accepts verified UCI identities and resolves existing members by identity or email; officer authorization is a separate database role check. The patch does not change identity verification, matching, membership creation, officer roles, or callback handling. First-login identity/profile behavior belongs to issue 6; this patch covers OAuth initiation origin only.

## Prepared source change

Before creating OAuth state, `/api/auth/login` compares the request origin with configured `APP_URL`. A different origin receives303 to the configured origin's login endpoint, with a sanitized and correctly encoded return path. OAuth state is then created on the callback origin. Cookies remain host-only and SameSite=Lax; no cookie domain sharing or security relaxation is needed.

The destination comes exclusively from configured `APP_URL`, never a caller-supplied host. Unsafe return paths retain the existing `/my-aac` fallback. On the canonical host the existing login rate limit and Google behavior continue unchanged.

## Required production proposal — held for approval

The code correction alone does not make a LAN-only canonical hostname reachable to external officers. For public access, the concrete proposed runtime configuration is:

- `APP_URL=https://aac.gdodge.dev`
- `PUBLIC_SITE_URL=https://aac.gdodge.dev` (retain current public sharing origin)
- Google OAuth client's authorized redirect URI must include `https://aac.gdodge.dev/api/auth/callback` before switching the runtime origin.

No values above have been written to production. Main-agent read-only validation
of Google's authorization endpoint accepted both the existing internal callback
and the proposed public callback, reaching `/v3/signin/identifier` without an
OAuth error. An intentionally unregistered control callback instead reached
`/signin/oauth/error` with `redirect_uri_mismatch`. This validates the proposed
public callback against the live OAuth client without signing in or changing
Google settings. Google requires the callback to match a registered URI exactly
([official documentation](https://developers.google.com/identity/protocols/oauth2/web-server)).
An affected officer's full login on an external network remains unverified.
Keep the existing internal callback registered during a coordinated transition
if rollback is required.

With the public canonical origin, an internal-host login first moves to the public host; its callback and post-login relative destination stay public. Host-only cookies mean an internal bookmark does not inherit the public session. Mutation Origin checks remain exact against `APP_URL`: public-origin submissions pass; internal-origin or other-origin submissions are rejected. Do not accept multiple mutation origins as a workaround. Users should conduct authenticated work on the public canonical site; consider a separate canonical UI redirect if internal bookmarked workflows must transparently move public.

## Validation

Isolated disposable Postgres database: `aac_issue2_tests`. No shared fixtures/database were mutated.

`TEST_DATABASE_URL=postgresql+psycopg://aac:aac@127.0.0.1:55432/aac_issue2_tests /home/gdodge/Documents/aac/aac-website-current/.venv/bin/python -m pytest backend/tests/test_oauth_origin.py backend/tests/test_workflows.py -q`

Result: **20 passed** (six new OAuth regressions and 14 existing workflow tests). Existing Starlette/httpx and Alembic deprecation warnings only.

Tests demonstrate canonical redirect before state/cookie creation, state and existing officer session continuity on the callback host, safe return-path encoding/rejection, existing nonofficer sign-in without acquiring officer privileges, and exact mutation-origin enforcement when public origin is configured at app creation. The principal public-initiation regression fails on unchanged live source (302 instead of required303); restored patch passes.

Google token exchange is mocked in automated tests. Real Google login has not been performed for an affected officer. After approved code/configuration rollout, verify a nonowner existing officer starting from the public site on an external network, a regular UCI member, and denial of an unverified/non-UCI identity; confirm callback reaches the public origin and appropriate role remains unchanged. That verification is required before declaring the field report fully resolved.
