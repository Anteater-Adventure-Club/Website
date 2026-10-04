# Issue 6: first Google login rejected, retry works

Prepared in `aac-fix-first-login` on `fix/first-login-rejection`, based on live release `00c11695b2a33262589c0a4c7abaf3ab83848c86`. Changes are **uncommitted**. No push, deployment, real-account authentication, or production/configuration write was performed.

## Findings and field attribution

Two defects can produce a failed first attempt. The host mismatch is shared with [issue 2](field-test-2026-10-03-issue-2.md) and is not duplicated here. A separate session-expiry defect is reproduced and corrected here.

The owner clarified that everyone begins at the public hostname, that the owner sees first-attempt rejection across platforms, and that other officers hang after the Google redirect/callback without a visible error. Only the owner currently completes login. These observations do not identify the failing callback's exact error or establish which defect caused an individual attempt.

Issue 2's read-only live inspection established that public login creates a host-only state cookie on `aac.gdodge.dev`, while configured `APP_URL` sends the callback to `aac.internal.gdodge.dev`. The isolated reproduction here proves this sequence: first callback has no matching state, fails before token exchange and creates no identity; retry initiated on the callback host succeeds and creates the identity. Repeated owner success after an initial rejection is consistent with this host transition. Other officers' hanging remains a field observation; network reachability and the precise failing stage have not been established.

## Independent defect: session reads erase pending OAuth

Both `/api/session` and the authenticated-member dependency previously called `request.session.clear()` when `login_at` was absent or older than eight hours. An anonymous user signing in has valid Authlib state/nonce and `return_to` in the session, but no `login_at` yet. A same-host session read while that user is at Google therefore erased the pending transaction. An unauthenticated profile read did the same while correctly returning 401. The next callback returned the OAuth error redirect without exchanging a token.

This is a proven same-host defect, independent of cookie-host selection. A second tab shares the browser's cookie jar; the frontend's global provider loads `/api/session` and its query configuration refetches on window focus. The tests model that request ordering directly. They do not establish that an extra tab/read occurred in the owner's field attempts or prove a single-tab browser race.

The minimal patch centralizes member-session expiry in `session_member_id()` and removes only `member_id` and `login_at` when expired. Pending OAuth state and the local return path survive reads. Expired users still receive 401 on protected routes and have no officer access. Explicit logout, failed callbacks and successful callback session replacement retain their existing clearing behavior.

## Reproduction evidence

Synthetic Google endpoints and ephemeral RSA-signed ID tokens exercise the installed Authlib implementation's actual state lookup, nonce, issuer and audience validation. Metadata, key retrieval and token transport are isolated fixtures; no Google account or network exchange is used.

| Local source / sequence | Result |
| --- | --- |
| Baseline, first new identity, same host, no intervening read | First callback succeeds; account and identity commit without a retry |
| Baseline, same host, session/profile read during pending login | OAuth error; reproduced with anonymous and expired authenticated sessions |
| Issue 6 patch, same intervening reads | First callback succeeds; return path preserved; expired officer access denied before callback |
| Baseline or issue 6 only, public initiation / different callback host | First attempt fails before token exchange, zero identities; callback-host retry succeeds |
| Temporary issue 2 + issue 6 candidate, public initiation | OAuth cookie created on callback host; first callback succeeds; no retry needed |

Ignored evidence under `artifacts/issue-6/`:

- `baseline-first-login.txt`: **4 failed, 12 passed** on unchanged live source; all four failures are pending-state preservation regressions.
- `patched-tests.txt`: **30 passed** on final issue 6-only source, comprising 16 OAuth regressions and 14 existing workflow tests.
- `baseline-host-sequence.json`, `issue6-host-sequence.json`, `combined-host-sequence.json`: sanitized first-attempt/retry evidence, identity counts and token-fetch counts.
- `combined-tests.txt`: **30 passed** with issue 2's uncommitted login-origin patch temporarily applied. It was then removed, restoring the issue 6-only source.
- `reproduce_host_sequence.py` and `validate_dependency.py`: repeatable isolated reproduction; the latter restores this worktree's source in a `finally` block.

Security regressions verify wrong/superseded/consumed state rejection, nonce/issuer/audience rejection, verified UCI email requirements, explicit logout invalidation, expired-session denial, existing-officer role preservation, and no new officer grant to a first-time member. A successful repeat login reuses the committed member/identity rather than creating duplicates.

## Validation and dependency

Only disposable local database `aac_issue6_tests` was created/used. From `backend/`:

```sh
TEST_DATABASE_URL=postgresql+psycopg://aac:aac@127.0.0.1:55432/aac_issue6_tests \
  /home/gdodge/Documents/aac/aac-website-current/.venv/bin/python -m pytest \
  tests/test_first_login.py tests/test_workflows.py -q
/home/gdodge/Documents/aac/aac-website-current/.venv/bin/python -m ruff check .
```

Result: **30 passed; Ruff passed**. Existing Starlette/httpx and Alembic deprecation warnings only. No frontend/API contract changes or browser screenshot evidence are needed for this backend correction.

Issue 6 alone does **not** correct public/internal host mismatch. First-attempt public login also requires issue 2's canonical-origin correction and an approved publicly reachable `APP_URL`. The main agent separately reports anonymous Google authorization probes for both callback origins reached Google's sign-in page without an immediate `redirect_uri_mismatch`; that is not a completed account-authentication test, and no Google setting was changed here.

After approval and coordinated rollout, verify the owner's first public-host attempt and an existing nonowner officer on an external network. Include a second same-origin tab reading session during consent. Until those field checks succeed, this report proves the two local mechanisms and their corrections, not complete resolution of every reported login failure.
