# Issue 5: passenger capacity label

Prepared on 2026-10-03 for review in `aac-fix-capacity-label`, branch `fix/passenger-capacity-label`, based on `00c11695b2a33262589c0a4c7abaf3ab83848c86`. Changes remain uncommitted.

## Scope

Changed the single shared vehicle-field label in [operations.tsx](../../frontend/src/components/operations.tsx) from **Passenger capacity · excludes driver** to **Passenger capacity**. `AddParticipantDialog` supplies this field to both the event-management Add Participant flow and the check-in walk-in flow. The separate **Seats offered · excludes driver** label, capacity/seats submission, defaults, required/min/max attributes, and backend validation/calculation are unchanged. No applicable `AGENTS.md` files were found; repository README and verification guidance were inspected.

## Verification

- **Passed:** frontend `npm run build` with Node 24.21.0 (includes `tsc -b` and Vite production build). [Build log](../../artifacts/issue-5/build.log). Rollup emitted two nonfatal third-party Zod annotation warnings.
- **Passed:** four Chromium 153.0.8010.12 renders: Add & Check In a Walk-in and Add participant at **390×844** and **360×800**. Actual application routes and `AddParticipantDialog` rendered with synthetic browser API responses on local port 5205, without a backend or database.
- Each render verified the exact accessible label **Passenger capacity**, absence of the old label, unchanged **Seats offered · excludes driver**, and unchanged capacity attributes (`type=number`, `name=capacity`, `required`, `min=1`, `max=50`, default `4`). Both fields were visible in each screenshot; no dialog horizontal overflow occurred.
- Final capture recorded **zero page/console errors, unexpected requests, or mutation requests**. [Machine-readable validation](../../artifacts/issue-5/visual-validation.json) and [reproduction script](../../artifacts/issue-5/capture-phone.cjs).
- **Passed:** `git diff --check`. No new permanent tests were added for this wording-only change.

## Screenshots

- [Walk-in, 390×844](../../artifacts/issue-5/passenger-capacity-walk-in-390.png)
- [Add participant, 390×844](../../artifacts/issue-5/passenger-capacity-add-participant-390.png)
- [Walk-in, 360×800](../../artifacts/issue-5/passenger-capacity-walk-in-360.png)
- [Add participant, 360×800](../../artifacts/issue-5/passenger-capacity-add-participant-360.png)

These are synthetic phone viewport captures, not physical-device checks or evidence of backend persistence. Synthetic member identities use `example.invalid`; no real personal data or production services were used. All screenshot/build/reproduction artifacts are in ignored `artifacts/issue-5/`.

No commit, push, merge, deployment, production mutation, or additional agent was performed. Main-agent review and per-issue user approval precede any commit or deployment.
