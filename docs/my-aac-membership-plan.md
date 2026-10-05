# My AAC navigation and membership implementation plan

Implement Design B: a personal membership card beside payment signup or membership details, with benefits below. Use direct wording. Omit the event card and club reimbursement budget from the personal view. Keep driver reimbursement eligibility in the benefits list.

## 1. Navigation

Keep My AAC selected on every `/my-aac/*` route in desktop and mobile navigation. Keep Home and workspace tabs exact so only the current subtab is selected. Preserve `aria-current` indicators.

Add `/my-aac/membership` under the existing sign-in guard and member workspace. Update workspace tabs, account menus, mobile section links, and the overview membership action. Preserve the selected quarter. Preserve the existing public `/membership` page’s layout, text, and signup behavior. Apply the new design only to `/my-aac/membership`. Keep the public and personal views in separate page files. Signed-out private visits return to their original route and quarter after sign-in.

## 2. Personal membership

Use the existing session, quarter context, membership API, and submission/approval workflow. Show the member’s actual name, selected quarter, status, and available receipts.

| State | Behavior |
| --- | --- |
| General, open quarter | Show free-activity information, contact phone, $25 UCI student or $30 non-student category, payment instructions, confirmation, and submit action. |
| Pending | Show submission date, category, and payment method. Explain officer confirmation and prevent repeat submission. |
| Approved payment | Show benefits dates and actual receipts, with event and signup links. |
| Officer exception | Explain officer approval without requiring or inventing a payment. |
| Imported approval | Explain when payment details were not provided. |
| Past or closed quarter | Show historical status and records; do not accept new payment submissions. |
| No quarter | Explain that dues are closed until a quarter is available and weekly activities are free. |
| Loading/error | Use existing loading, error, and retry controls. Do not display a signup form before status is known. |

Retain contact-phone prefill and validation, Zelle/Venmo/cash choices, explicit confirmation, server errors, and query refresh after submission. Reset payment confirmation when the amount, method, or quarter changes. Approved and pending members can expand membership signup information without submitting again.

## 3. Zelle runtime configuration

Preserve the existing `DUES_ZELLE_CONTACT` value and payment instructions. Add runtime `DUES_ZELLE_NAME`, expose it as `zelle_name` from `/api/site-settings`, and render it below the Zelle instructions. Set the production value to `Gabe Dodge`. An empty name is omitted. The recipient name is not a frontend constant; changing it requires an API restart and no frontend rebuild. No database migration is required.

## 4. Validation

Run backend lint, migration consistency, integration tests, OpenAPI generation, frontend type generation, production build, and unit tests. Extend browser coverage for personal membership states, persistent navigation selection, quarter preservation, direct reload/back/forward, sign-in return, and runtime settings.

Exercise the unpaid → pending → officer-approved workflow only in an isolated local fixture database. Check all payment methods, required phone, confirmation reset, submit failure/retry, exception/imported status, closed/no-quarter states, and missing settings. Review desktop/mobile layouts, keyboard access, accessibility, and horizontal overflow at 320, 390, 768, and 1440 pixels.

## 5. Deployment

Record the previous healthy release. Set `DUES_ZELLE_NAME=Gabe Dodge` on the API application in Coolify, preserving existing payment settings. Commit the validated implementation, merge into `aac-rebuild`, and push through the existing deployment workflow described in [deployment-plan.md](deployment-plan.md).

Wait for both API and web deployments and repository CI. Verify readiness, matching release SHAs, the runtime Zelle name/contact, public membership information, and authenticated member navigation using read-only live checks at https://anteateradventureclub.com. If a critical release check fails, restore the previous compatible application release with database and media volumes intact.
