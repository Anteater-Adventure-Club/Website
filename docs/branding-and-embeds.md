Public page and event links include Open Graph and Twitter card metadata in the
initial HTML. Nginx includes `/api/page-metadata` into the static React shell
using SSI, forwarding the original request path and stripping cookies. This
works for crawlers that do not run JavaScript; no crawler user-agent list is
needed. The same endpoint keeps browser titles and metadata current after
React navigation. If the API is unavailable, the shell retains its default
title and description.

Public pages use the AAC logo. Event cards use the event name, Pacific date/time,
destination and description. They use the assigned **Event photo**; completed
events without one can use their published **Recap photo**. An event without
either has a text preview. Draft, skipped and missing events expose no event
details. Member and officer links share generic sign-in text. Query strings and
sessions never contribute to preview content. Canonical links and images use
the configured `APP_URL`, rather than request headers.

The source logo is [assets/branding/aac-logo.pdf](../assets/branding/aac-logo.pdf),
provided as `Downloads/main aac logo.pdf`. Its original artwork is rendered to
SVG for the header and favicon and to a 1024-pixel PNG for link previews and
Apple touch icons. To update the assets from a replacement PDF, run from the
repository root with Poppler installed:

```sh
pdftocairo -svg assets/branding/aac-logo.pdf frontend/public/logos/aac.svg
pdftocairo -png -singlefile -scale-to 1024 -transp assets/branding/aac-logo.pdf frontend/public/logos/aac
```

If the PNG dimensions change, update the logo dimensions in
`backend/app/routers/social.py`. Public social metadata is HTML and deliberately
excluded from OpenAPI; no database or generated response-type changes are
required. CI tests raw initial HTML through the production Nginx configuration,
as well as desktop, tablet and phone navigation and branding.
