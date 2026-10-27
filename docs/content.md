# Content and assets

## Events and homepage photos

Manage events through the officer tools. Review dates, location, signup settings, and the **Event photo** before publishing. Confirm the result on the public Events page.

To add a completed adventure to the gallery or homepage:

1. Open the completed event's **Recap** tab.
2. Add its photo, title, caption, and recap text.
3. Select **Feature in the homepage polaroid rotation** to include it on the homepage.
4. Choose **Publish to Gallery** and check the public gallery and homepage.

Recap edits remain private until republished. The homepage rotates when at least two published recaps are featured. Update the static **What we do!** copy and activity photos in [home.tsx](../frontend/src/pages/home.tsx) and [frontend/public/images](../frontend/public/images/), then follow the asset steps below.

### Calendar holidays and UCI dates

The public calendar displays federal holidays separately from AAC events. `frontend/src/lib/calendar-notices.ts` calculates actual and weekend-observed dates using [OPM's federal holiday rules](https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/).

The calendar uses the display names **Presidents’ Day** and **Indigenous Peoples’ Day** for all years. UCI fee payment and add/drop deadlines are intentionally excluded when maintaining the academic dates.

Key UCI dates for Fall 2026–Spring 2028 are listed in `frontend/src/lib/uci-academic-dates.ts`, with links to the Registrar's published calendars. Update this list from the official calendars when dates change or another academic year is published, and update the displayed coverage in `frontend/src/pages/public.tsx`. These are reference dates, not signup-enabled club events; federal holidays alone do not establish UCI closures.

Multi-day reference dates appear only on their start and end dates, labeled **Starts** and **Ends**. Selecting either marker shows the full date range. The category buttons show or hide items in the calendar and its day details; **Show all** resets them. Busy dates show up to three colored entries (dots on phones) and a count for any others; select the date to see all visible items.

Club event labels in the calendar link directly to the event page, just like the cards below. Select the date or its empty space to view that day's details without navigating away. Phones keep the compact dots and date selection.

## Member bans and restrictions

Open **Officer Tools → Members → Details → Bans → Ban Member**.
Choose event signups, membership signups, or both. Use the category buttons to
select one or more event types, or **All** for all events. Membership is selected
independently. Event bans can cover all events, selected types
(including all retreats), or specific published upcoming events. Types also
cover events created later. Bans apply across quarters and never prevent login.

Choose a temporary end time in Pacific time or **Permanent**. Enter the required
private officer reason and, optionally, a separate message for the member.
Members see “restriction,” its scope and duration, and officer contact guidance;
they cannot see private reasons or the officers' ban history.

**Review Ban** previews automatic cancellations before **Confirm Ban**. A ban
cancels existing signups for matching events starting from its creation until its
expiry (exclusive); a permanent ban covers all matching upcoming events. Already-started
events and later events outside a temporary ban remain intact. Early check-in and
carpool assignments for cancelled signups are undone. Cancellation cannot be
disabled. While active, the ban also blocks new or restored matching signups,
even for events taking place after expiry.

Use the **Banned** filter button alongside All, Pending, Paid, Exception, and
General. Active bans appear as **Temp banned** or **Banned** badges in the
Membership column. Member **Details → Bans** shows history
and **Lift Ban**. Lifting requires a private reason. Expiry and lifting never
restore cancelled signups automatically, and any other matching active ban
continues to apply. Correct a ban by lifting it and creating its replacement.

Officers, walk-ins, and imports follow the same restrictions; capacity overrides
cannot bypass them. Membership bans block new submissions and new approvals,
including exceptions and paid imports, while preserving already-approved
membership and payment history. For pending dues, open **Confirm Dues**, select
**Return to General Membership**, enter a reason, and choose **Save Adjustment**.
This uses the existing adjustment flow to return the member to general status
and remove the submission from the pending queue.
Coordinate any refund separately. Once restrictions end, the member can submit
again. Notifications are displayed in the site; no email is sent.

## Signup limits and retreat priority

In an event's editor, open **Signups & Carpools** and set the **Signup limits**. The total counts everyone; the transport limits count people who need a ride, drive others, or have their own ride. Blank means unlimited, and zero closes that choice. A full transport category leaves other categories open until the total limit is reached. Offered passenger seats are separate from signup limits.

Lowering a limit preserves existing registrations. Members can still edit their existing signup or change to a transport category with space, subject to the normal signup window. Cancellations release places. Officer additions, walk-ins, and participant imports also respect limits; use **Officer capacity override** with a reason to exceed them. Overrides are audited and do not bypass retreat membership requirements. An import that exceeds capacity without an override saves no rows.

For a retreat priority period, open **Settings → Membership Signups** for the retreat's quarter. Set the pause start and reopening times in Pacific time and the message new members should see. Start the pause before retreat signups open. The pause blocks new dues submissions for that quarter, and the membership forms return automatically at the scheduled end. Pending submissions can still be approved, and approved members can register for retreat. Clear both pause dates and save to reopen early. Budget edits do not change this schedule.

To offer remaining retreat places before requiring payment, enable **Let general members reserve before becoming paid members** under **Signups & Carpools** and set the Pacific opening time. Approved members retain their earlier access. General members become eligible at the configured time, within the ordinary signup window, and compete for the same total and transport limits. For example, 38 existing signups and a total limit of 48 leave 10 places; do not set the total limit to 10. This setting does not reopen membership payments, even for members who secure a place.

Successful general-member reservations show a 24-hour membership reminder. **Your Membership** shows a yellow pending card and links to the existing membership signup page. A reservation alone does not create a payment submission. There is no automatic expiry, removal, or reminder job: officers review unpaid reservations and decide what to do. Turning off general-member reservations keeps existing signups editable within the normal signup window; cancelled signups need current eligibility and available capacity to be restored.

## Event activity logging

Every event kind has a compact **Log activity for this event** checkbox near the editor's save button. It is off by default and independent of retreat eligibility. Enable it before the opening rush, then save. Changing the setting affects subsequent activity; it does not reconstruct earlier visits.

Records are written as JSON lines in **Server's API logs**, with `type: "event_activity"` and an event ID. They are not stored in a separate application database table or displayed in an activity dashboard. Retention and rotation follow the server's API log configuration; export the relevant time range if it needs to be retained.

| Action | Meaning |
| --- | --- |
| `browser.page_view` | Event page rendered; signed-in member ID/name when available, otherwise anonymous |
| `browser.signup_attempt` | Submit attempted in the browser |
| `browser.validation_failed` | Browser validation prevented submission |
| `signup.request` | Signup or cancellation request reached the API |
| `signup.rejected` | API rejected the request, with HTTP status and reason code |
| `signup.created`, `signup.updated`, `signup.restored`, `signup.cancelled` | Change committed to the database |

Use `event_id` to filter, `member_id` to follow a signed-in person, and `attempt_id` / `request_id` to correlate requests. Only committed change records have `authoritative: true`; the roster remains the source of truth. Browser signals are best effort and can be lost, duplicated, or blocked. Requests blocked before the signup route, such as invalid-origin requests, remain in the ordinary HTTP logs. Names and IDs are included, but contact information, payment details, and question answers are excluded from these activity records.

## Board profiles

Open **Officers & Board**, select the board year, and use **Add Board Profile** or edit an existing entry. Review the photo, role, biography, and **Show on the public board** setting. Reorder profiles in that screen and check `/board` afterward.

Use **Start Next Board** for a new year; the previous board remains in the public archive. Public profiles and officer access are managed separately. Review linked member access during handover: starting a new board year does not revoke existing officers.

## Membership and links

Membership page copy lives in [membership.tsx](../frontend/src/pages/membership.tsx). Prices and eligibility come from `/api/membership-benefits` in [finance.py](../backend/app/routers/finance.py). Check the page and payment rules together when changing membership policy.

Change payment destinations in the API runtime settings: `DUES_VENMO_HANDLE`, `DUES_ZELLE_CONTACT`, `DUES_ZELLE_NAME`, and `DUES_CASH_INSTRUCTIONS`. A blank Zelle name hides the recipient-name line. Restart the API and reload the membership page to confirm the values. Verify club payment details before publishing them.

`DISCORD_URL` is also an API runtime setting. Edit Instagram links in [home.tsx](../frontend/src/pages/home.tsx) and [layout.tsx](../frontend/src/components/layout.tsx); the GitHub link is in `layout.tsx`. The `INSTAGRAM_URL` and `GITHUB_URL` entries in `.env.example` are not consumed by the application.

## Static assets

Run these commands from the repository root after [installing dependencies](../README.md#2-install-dependencies-and-create-a-local-database).

For changed activity photos, place the source WebP files in `frontend/public/images/` and generate responsive copies:

```bash
.venv/bin/python scripts/prepare-static-images.py
```

For changes to the supplied fonts in `frontend/public/fonts/`, regenerate subsets:

```bash
.venv/bin/python -m pip install 'fonttools[brotli]'
.venv/bin/python scripts/prepare-fonts.py
```

The source logo is [assets/branding/aac-logo.pdf](../assets/branding/aac-logo.pdf). After replacing it, use Poppler to regenerate the SVG and transparent PNG:

```bash
pdftocairo -svg assets/branding/aac-logo.pdf frontend/public/logos/aac.svg
pdftocairo -png -singlefile -scale-to 1024 -transp assets/branding/aac-logo.pdf frontend/public/logos/aac
```

After any static asset changes, update the version manifest and build:

```bash
(cd frontend && npm run assets:manifest && npm run build)
```

Commit the source assets, generated copies, and `assets/static-asset-versions.json` together. The build rejects a stale manifest. Review affected pages at phone and desktop sizes, including headings over photos and image cropping. Update references and alt text when adding or replacing a photo.

## Social previews

Set `PUBLIC_SITE_URL` to the public HTTPS origin without a path. It controls canonical links and preview images; `APP_URL` controls authentication. Public pages and image URLs must be reachable without signing in.

Event previews use the **Event photo**, falling back to a published **Recap photo** for completed events and then to branded artwork. Check the event title, dates, destination, and photo after changing them. Social platforms may cache previously posted previews.

For changes to preview artwork or bundled assets, update the template version in [share_cards.py](../backend/app/services/share_cards.py) and check the asset copies in [deploy/backend.Dockerfile](../deploy/backend.Dockerfile). Test both the image and the initial HTML:

- Page images: `/api/share-images/pages/home.jpg`, `events.jpg`, `board.jpg`, and `membership.jpg` under the same path.
- Event images: `/api/share-images/events/{event_id}.jpg`.
- Page metadata: inspect the raw public page HTML through Nginx without a session cookie; Vite alone does not render metadata for crawlers.

Run the [production proxy checks](development.md#production-proxy-checks) after changing metadata, branding, or asset delivery.
## External member applications

New Google signups without a UCI email must complete an application before using member tools, signing up for events, or submitting dues. Existing member records are grandfathered in, including imported members who have not signed in. New members deliberately added by officers or imported from a roster are admitted automatically. Adding or importing an existing applicant does not override their application status.

Until an application is approved, direct visits to any My AAC member tab redirect to the application page. This covers Overview, My Signups, Membership, Profile & Cars, and Reimbursements. Member APIs and event signups also reject these accounts, while public pages remain available. Pending payment confirmation is separate and does not impose this application restriction.

Open **Settings → External Member Application → Edit application questions** to change the questionnaire. It uses the same question editor and validation as event forms, including email fields, word limits, and conditions based on an earlier yes/no or multiple-choice answer. Submitted applications retain their original questions and answers. An applicant filling an older version must review the updated questions before submitting.

Review submissions in **Members → Pending**, or follow the dashboard’s **New members waiting for approval** link. The Pending view includes both applications labeled **Pending (Approval)** and payment confirmations labeled **Pending (Membership)**, with no additional pending filters. Applications are independent of quarters and remain reviewable even without an open quarter.

Officers can approve or deny a submitted application. Approvals take applicants directly to the normal **My AAC** pages, including when approval arrives while their application page is open. There is no approval message or acknowledgment step. When denying an application, officers can include a reason that remains visible on the applicant’s application page. Answers lock after submission, and decisions are final: denied accounts cannot apply again. Email notifications and follow-up conversations are not included. Approval does not grant paid membership or lift any bans. College information is self-reported and does not change dues pricing.
