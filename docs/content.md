# Content and assets

## Events and homepage photos

Manage events through the officer tools. Review dates, location, signup settings, and the **Event photo** before publishing. Confirm the result on the public Events page.

To add a completed adventure to the gallery or homepage:

1. Open the completed event's **Recap** tab.
2. Add its photo, title, caption, and recap text.
3. Select **Feature in the homepage polaroid rotation** to include it on the homepage.
4. Choose **Publish to Gallery** and check the public gallery and homepage.

Recap edits remain private until republished. The homepage rotates when at least two published recaps are featured. Update the static **What we do!** copy and activity photos in [home.tsx](../frontend/src/pages/home.tsx) and [frontend/public/images](../frontend/public/images/), then follow the asset steps below.

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
