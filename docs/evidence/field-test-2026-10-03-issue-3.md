# Issue 3: original-size textured role controls without a roster divider

Prepared on 2026-10-03 in `aac-fix-checkin-toggle`, branch `fix/checkin-role-toggle`, based on `00c11695b2a33262589c0a4c7abaf3ab83848c86`. The current candidate follows both user directions: add texture without enlarging the controls, and remove the horizontal roster line now that the controls look like buttons. It remains unapproved and uncommitted. The main agent must review the final evidence and obtain per-issue user approval before commit or deployment.

## Finding and final change

The field-desk roster used `.tabs` with `aria-pressed` and an unused `selected` class. Shared tab CSS highlighted only `.active` or `aria-selected`, so filtering worked while the controls resembled plain text. The walk-in ride selector showed its selected choice but lacked individual surfaces for the other choices.

The patch adds `.ride-role-texture` to these existing controls. Unselected choices receive subtle gradient surfaces, inset edges, and top highlights. Selected choices have a forest gradient; pointer-down has a depressed inset shadow. All shadows remain inside the surface. Backgrounds use `padding-box` clipping; selected and hover states change `background-image` so they preserve that clip. Keyboard focus remains visible inside the controls.

The supplied `/tmp/codex-clipboard-JywCP0.png` revealed a paint issue that equal bounding rectangles missed: the selected forest fill extended through the roster button's existing 2px transparent bottom border while its inset edge ended above that border. Clipping the fill and removing external shadows gave selected and idle controls matching visible edges. The pixel regression still detects that earlier border bleed.

The latest change removes only the roster divider with `.desk-toolbar .tabs.ride-role-texture { border-bottom-color: transparent; }`. The original 1px border width remains as layout space, so neither the controls nor the search, actions, or roster shift. Other `.tabs` dividers keep their original color, including desk tabs without this modifier. The corrected button surfaces remain unchanged.

Native buttons, markup, inline count placement, `aria-pressed`, role state, filtering, vehicle fields, and submission logic are preserved. Heights, widths, padding, margins, gaps, fonts, line heights, and display modes are unchanged. Controls remain 44px high; roster surfaces paint 42 CSS pixels, with the original transparent bottom-border gap retained.

Source scope:

- `frontend/src/pages/check-in.tsx`: one texture class added to the existing roster group.
- `frontend/src/components/operations.tsx`: one texture class added to the existing `AddParticipantDialog` ride-situation group.
- `frontend/src/styles.css`: 37 lines of scoped surface, selected, hover, pressed, focus, and roster-divider color styling. General tab, segmented, and responsive layout rules are untouched.

No other issue, backend, dependency, lockfile, vehicle-selection, keyboard, or capacity-label changes were made. No commits, pushes, deployments, or production requests occurred. The current review patch is `artifacts/issue-3/source.patch`.

## Final visual evidence

Screenshots show the actual local application route, `FieldDesk`, and `AddParticipantDialog`, with deterministic synthetic API responses and a fixed clock at `2026-10-03T17:00:00Z`. No backend mutations are sent. Original baseline geometry and PNGs remain available under `paint-before-*`; current screenshots are under `divider-after-*`. Previous textured screenshots under `paint-after-*` provide a matched comparison for the latest divider removal.

The [updated review index](../../artifacts/issue-3/review.html) begins with enlarged selected-plus-idle close-ups before and after removal of the divider. Artifacts are ignored local review files, not committed assets.

| State | Before divider removal | Current candidate |
| --- | --- | --- |
| 390×844 roster, Riders selected | [Before](../../artifacts/issue-3/paint-after-chromium/390x844-roster-riders.png) | [After](../../artifacts/issue-3/divider-after-chromium/390x844-roster-riders.png) |
| 390×844 roster, Drivers selected | [Before](../../artifacts/issue-3/paint-after-chromium/390x844-roster-drivers.png) | [After](../../artifacts/issue-3/divider-after-chromium/390x844-roster-drivers.png) |
| 390×844 selected and idle, 3× close-up | [Before](../../artifacts/issue-3/paint-after-chromium-dpr3/390x844-roster-riders-closeup.png) | [After](../../artifacts/issue-3/divider-after-chromium-dpr3/390x844-roster-riders-closeup.png) |
| 390×844 keyboard focus, 3× close-up | [Before](../../artifacts/issue-3/paint-after-chromium-dpr3/390x844-roster-keyboard-focus-closeup.png) | [After](../../artifacts/issue-3/divider-after-chromium-dpr3/390x844-roster-keyboard-focus-closeup.png) |
| 1440×900 roster | [Before](../../artifacts/issue-3/paint-after-chromium/1440x900-roster-riders.png) | [After](../../artifacts/issue-3/divider-after-chromium/1440x900-roster-riders.png) |
| 390×844 walk-in, Driver selected | [Before](../../artifacts/issue-3/paint-after-chromium/390x844-walkin-driver.png) | [After](../../artifacts/issue-3/divider-after-chromium/390x844-walkin-driver.png) |

The latest captures cover phone 390×844 and desktop 1440×900 in Chromium and WebKit, plus a Chromium phone at 3× pixel density. Each includes selected Riders, selected Drivers, hover, pointer-down, keyboard focus, and Unknown. The earlier corrected surfaces also passed at 320×568 and 768×1024; those broader runs were not repeated for the divider-color change.

## Targeted validation of the final revision

| Check | Result | Artifact under `artifacts/issue-3/` |
| --- | --- | --- |
| Pixel regression | 30 screenshot states pass; selected and idle painted bounds match | `paint-check.log`, `paint-validation.json` |
| Divider removal | All 30,978 former-divider pixels match the page background | `paint-validation.json` |
| Surface gap | All 36,776 reserved-gap pixels match the original baseline | `paint-validation.json` |
| Regression sensitivity | Detects the prior visible divider in 6 states and prior border bleed in 4 states | `paint-validation.json` |
| Original geometry | 92 targeted button-state comparisons, 0 differences | `geometry-check.log`, `validation-summary.json` |
| Geometry fields | Width, height, position, padding, border widths, fonts, line height, whitespace, display, parent spacing, and inline count position/size | Current browser result JSONs |
| Heights and painted edges | Control boxes remain 44px; selected/idle roster surfaces both paint 42 CSS pixels, or 126 physical pixels at 3× | Pixel and geometry JSONs |
| Divider scope | Target border remains 1px with transparent color; normal tabs outside and inside the desk retain `rgba(31, 77, 59, 0.14)` | `validation-summary.json`, browser `dividers` records |
| Chromium/WebKit | Current phone and desktop fixtures pass; Chromium 3× phone passes | `divider-after-chromium/results.json`, `divider-after-webkit/results.json`, `divider-after-chromium-dpr3/results.json` |
| Accessibility | 8 targeted standard-viewport audits plus 2 additional 3× phone audits, 0 violations | Current browser result JSONs |
| Functional preservation | Native keyboard selection, one pressed role, rider/driver/own/unknown filtering, search, and conditional vehicle fields pass | Current browser result JSONs |
| Browser/API isolation | 0 page errors, console errors, or unexpected API requests | Current browser result JSONs |
| CSS formatting/whitespace | Prettier CSS and `git diff --check` pass | `format-check.log`, `diff-check.log` |

The prior typecheck, production build, source formatting, and 9 existing unit-test passes are retained. This final revision changes only a scoped border color; broader checks were not repeated. Their logs remain `typecheck.log`, `build.log`, and `unit-tests.log`.

The repeatable fixture is `capture.mjs`. `verify-texture.mjs` compares current phone/desktop geometry against the original baseline and checks divider scope. `verify-paint.py` checks actual PNG surface bounds, every former-divider pixel, the reserved gap, and sensitivity to earlier failing candidates. Screenshot close-ups are captured directly by Playwright without resizing or retouching.

The temporary dependency symlink was removed, the local preview stopped, and the WebKit test container removed itself on exit. Caches and evidence stay under the ignored issue artifact directory.

## Limits

These synthetic local checks verify actual frontend rendering and interactions, not backend persistence or a real check-in transaction. WebKit runs in the existing local browser-test container. No physical iPhone, native keyboard, or production validation was performed. The patch is ready for final main-agent Helium review and a fresh user approval request; it remains uncommitted.
