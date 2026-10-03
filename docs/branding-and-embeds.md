Public page and event links include Open Graph and Twitter card metadata in the
initial HTML. Nginx includes `/api/page-metadata` into the static React shell
using SSI, forwarding the original request path and stripping cookies. This
works for crawlers that do not run JavaScript; no crawler user-agent list is
needed. The same endpoint keeps browser titles and metadata current after
React navigation. If the API is unavailable, the shell retains its default
title and description.

Public pages and events use designed 1200 × 630 JPEG cards, generated with
Pillow from the existing transparent logo, Chivo/Lazydog fonts, and AAC's forest
and cream colors. Home, Events and Membership use their existing activity
photos; Board uses the outdoor illustration. Event cards show the event name,
Pacific date/time and destination beside the assigned **Event photo**; completed
events without one can use their published **Recap photo**. An event without
either uses the branded outdoor illustration with its own details. Cancellation
labels and multi-day date ranges are included. The description keeps the
essentials and one introductory sentence within 200 characters; long text wraps
or truncates at word boundaries. Browser titles retain their branding suffix,
while event embed titles avoid repeating it. Draft, skipped and missing events
expose no event details. Member and officer links share generic sign-in text. Query strings and
sessions never contribute to preview content. Canonical links and images use
the configured `PUBLIC_SITE_URL`, rather than request headers. Configure
`PUBLIC_SITE_URL=https://aac.gdodge.dev` as a runtime setting for `aac-api` in
Coolify. When blank, it follows `APP_URL` for local development. This setting
does not change OAuth callbacks, session cookies, or mutation-origin checks.
The public origin must serve both pages and image endpoints without sign-in;
advertising the private internal hostname prevents external crawlers from
fetching the pictures.

Images are served from `/api/share-images/pages/{home,events,board,membership}.jpg`
and `/api/share-images/events/{event_id}.jpg`. Metadata includes a content-version
query parameter, JPEG type, dimensions, and descriptive alt text, and requests
large-image cards. GET and HEAD are supported, with ETags and a five-minute
private HTTP cache. A per-worker LRU cache holds at most 128 rendered images.
Every request resolves current public content before consulting the render
cache or returning a conditional response. Unpublished events return 404, and
unpublished recap photos are replaced with the event's fallback artwork. No
sharing files or new records are stored in the media volume or database.
Discord and other platforms choose their own surrounding layout and may keep
previously posted previews cached.

The source logo is [assets/branding/aac-logo.pdf](../assets/branding/aac-logo.pdf),
provided as `Downloads/main aac logo.pdf`. Its original artwork is rendered to
SVG for the header and favicon and to a transparent 1024-pixel PNG for sharing
artwork and Apple touch icons. To update the assets from a replacement PDF, run from the
repository root with Poppler installed:

```sh
pdftocairo -svg assets/branding/aac-logo.pdf frontend/public/logos/aac.svg
pdftocairo -png -singlefile -scale-to 1024 -transp assets/branding/aac-logo.pdf frontend/public/logos/aac
```

The backend Dockerfile copies only the required fonts, transparent logo and
three static activity photos into the image. Local rendering reads these same
files from `frontend/public`. Increment the sharing renderer's template version
when changing the artwork or bundled assets. Public social metadata and JPEG
routes are deliberately excluded from OpenAPI; no database or generated
response-type changes are required. CI tests raw initial HTML through the
production Nginx configuration, as well as desktop, tablet and phone navigation
and branding.
