# Guest officer access demo

From `frontend`, run `npm run demo:guests`, then open <http://localhost:5180/demo>.
The gallery has 15 scenes at mobile (390 × 844), tablet (834 × 1112), and desktop
(1440 × 1000) sizes. Each permission links into the actual React application.

This is a local UI preview with fictional, in-memory data. No database, OAuth
account, or backend service is needed. The dedicated Vite plugin intercepts API
requests before the normal backend proxy. It is loaded only by this script and
is not included in normal development, production builds, or deployment.

Each tab stores its own preview identity and session identifier in sessionStorage.
Reloading preserves its edits. Reset preview restores fixtures; restarting clears
all edits. `DEMO_PORT` overrides 5180. The server binds to loopback only.

Supported writes: Guest grant/edit/renew/revoke, event details, recap drafts,
existing board profiles, and event mileage. Other writes return an explicit
preview limitation. This mock does not establish backend authorization; the
feature's backend tests cover permissions, expiry, eligibility, audit, and revision
checks. Full officer screens outside Guest management are not populated.

## Screenshots and verification

With the demo running and Playwright Chromium installed:

```sh
npm run demo:guests:capture
node demo/guest-officers/verify.mjs
```

`DEMO_URL` overrides the origin. `DEMO_SCENES=grant,renew` restricts a capture pass.
The default captures all scenes and writes PNGs and a manifest under
`design/guest-officer-access/screenshots/`. Screenshots use CSS pixels at 1× scale;
regular pages are captured in full, and dialogs use the viewport to keep their
content prominent. Captures fail on browser exceptions or failed API responses.

Verification checks image links, responsive overflow, accessibility, independent
tab identities, expiry cleanup, restricted navigation, and Guest management edits.

The existing local browser image can supply Chromium:

```sh
podman run --rm --network host --userns keep-id --security-opt label=disable \
  -v "$PWD/..:/work" -w /work/frontend localhost/aac-browser-tests:1.63 \
  npm run demo:guests:capture
```
