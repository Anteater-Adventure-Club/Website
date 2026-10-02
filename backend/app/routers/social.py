"""Public sharing metadata, included in the SPA head by Nginx.

This response ignores the session. Drafts, rosters, financials, and member
details must never appear in a link preview.
"""

import re
from html import escape
from urllib.parse import unquote, urlsplit

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import HTMLResponse

from ..db import get_db
from ..domain import PACIFIC, slug
from ..models import Event, Media, Recap

router = APIRouter()
SITE = "Anteater Adventure Club"
DESCRIPTION = (
    "Anteater Adventure Club at UC Irvine. Hikes, city adventures, picnics "
    "and quarterly retreats. Making nature accessible!"
)
PAGES = {
    "/": (SITE, DESCRIPTION),
    "/events": (
        f"Events | {SITE}",
        "Find your next adventure with AAC at UC Irvine. Browse upcoming hikes, "
        "city trips, picnics, meetings and quarterly retreats.",
    ),
    "/board": (
        f"Meet the Board | {SITE}",
        "Meet the students behind Anteater Adventure Club at UC Irvine and explore our past boards.",
    ),
    "/membership": (
        f"Membership | {SITE}",
        "Join AAC at UC Irvine. Explore membership, quarterly dues and how we help make adventures accessible.",
    ),
    "/sign-in": (
        f"Sign In | {SITE}",
        "Sign in with your UCI account to join adventures and manage your AAC membership.",
    ),
}


def concise(value, limit=300):
    text = " ".join(value.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def event_description(event):
    start, end = event.starts_at.astimezone(PACIFIC), event.ends_at.astimezone(PACIFIC)
    date = start.strftime("%A, %B %-d, %Y")
    if start.date() == end.date():
        date += start.strftime(" · %-I:%M %p %Z")
    else:
        date += " – " + end.strftime("%A, %B %-d, %Y")
    parts = [date, event.destination, event.description]
    if event.state == "cancelled":
        reason = f": {event.cancellation_reason}" if event.cancellation_reason else ""
        parts.insert(1, "Cancelled" + reason)
    return concise(" · ".join(part for part in parts if part))


def event_image(db, event):
    mid = event.photo_id
    if not mid and event.state == "completed":
        recap = db.get(Recap, event.id)
        if recap and recap.published:
            mid = recap.published.get("image_id")
    media = db.get(Media, mid) if mid else None
    if media and "large" in media.variants:
        return {
            "path": f"/media/{media.id}/large",
            "type": "image/webp",
            "width": 1280,
            "height": 1280 if media.purpose == "board" else 960,
            "alt": f"Photo for {event.name}",
        }
    return None


@router.get("/api/page-metadata", response_class=HTMLResponse, include_in_schema=False)
def page_metadata(
    request: Request,
    page_uri: str = Header(default="/", alias="X-AAC-Page-URI"),
    db=Depends(get_db, scope="function"),
):
    # A configured origin and known paths avoid Host poisoning and including
    # query strings that may contain OAuth return paths or private values.
    base = request.app.state.settings.app_url
    path = unquote(page_uri.split("?", 1)[0]).rstrip("/") or "/"
    canonical, image, indexable = "/", None, False
    if path in PAGES:
        title, description = PAGES[path]
        canonical, indexable = path, path != "/sign-in"
        if indexable:
            # Club branding for pages; individual events deliberately have
            # no unrelated photo fallback.
            image = {
                "path": "/logos/aac.png",
                "type": "image/png",
                "width": 1024,
                "height": 1024,
                "alt": "Anteater Adventure Club logo",
            }
    elif match := re.fullmatch(r"/events/[^/]+/([1-9][0-9]{0,9})", path):
        eid = int(match[1])
        event = db.get(Event, eid) if eid <= 2**31 - 1 else None
        if event and event.state != "draft" and not event.skipped:
            title = f"{'Cancelled: ' if event.state == 'cancelled' else ''}{event.name} | AAC"
            description = event_description(event)
            canonical, indexable = f"/events/{slug(event.name)}/{event.id}", True
            image = event_image(db, event)
        else:
            title = f"Event Unavailable | {SITE}"
            description = "Explore upcoming AAC adventures at UC Irvine."
    elif path == "/admin" or path.startswith("/admin/"):
        title = f"Officer Tools | {SITE}"
        description = "Sign in with an authorized officer account to access AAC officer tools."
        canonical = "/sign-in"
    elif path == "/my-aac" or path.startswith("/my-aac/"):
        title = f"My AAC | {SITE}"
        description = "Sign in with your UCI account to manage your AAC membership and adventures."
        canonical = "/sign-in"
    else:
        title, description = f"Page Not Found | {SITE}", "Explore Anteater Adventure Club at UC Irvine."

    def meta(key, value, attribute="property"):
        return f'<meta {attribute}="{key}" content="{escape(str(value), quote=True)}" />'

    tags = [
        f"<title>{escape(title)}</title>",
        meta("description", description, "name"),
        f'<link rel="canonical" href="{escape(base + canonical, quote=True)}" />',
        meta("og:type", "website"),
        meta("og:site_name", SITE),
        meta("og:locale", "en_US"),
        meta("og:title", title),
        meta("og:description", description),
        meta("og:url", base + canonical),
        meta(
            "twitter:card",
            "summary_large_image" if image and image["type"] != "image/png" else "summary",
            "name",
        ),
        meta("twitter:title", title, "name"),
        meta("twitter:description", description, "name"),
    ]
    if image:
        tags.append(meta("og:image", base + image["path"]))
        if urlsplit(base).scheme == "https":
            tags.append(meta("og:image:secure_url", base + image["path"]))
        tags.extend(meta(f"og:image:{key}", image[key]) for key in ("type", "width", "height", "alt"))
        tags.extend(
            (
                meta("twitter:image", base + image["path"], "name"),
                meta("twitter:image:alt", image["alt"], "name"),
            )
        )
    if not indexable:
        tags.append(meta("robots", "noindex, nofollow", "name"))
    return HTMLResponse("\n".join(tags), headers={"Cache-Control": "no-store"})
