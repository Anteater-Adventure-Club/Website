"""Public sharing metadata, included in the SPA head by Nginx.

This response ignores the session. Drafts, rosters, financials, and member
details must never appear in a link preview.
"""

import re
from html import escape
from urllib.parse import unquote, urlsplit

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import HTMLResponse, Response

from ..db import get_db
from ..domain import PACIFIC, fail, slug
from ..models import Event, Media, Recap
from ..services.share_cards import ASSETS, SIZE, ShareCard, concise, render_card

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


PAGE_CARDS = {
    "home": ("/", SITE, "Making nature accessible", "Hikes, city adventures & quarterly retreats.", "about_sequoia.webp"),
    "events": ("/events", "Your next adventure", "Explore with AAC", "Find hikes, city trips, picnics and retreats.", "about_tide_pools.webp"),
    "board": ("/board", "Meet the board", "The people behind AAC", "A student-led club. A shared love of the outdoors.", ""),
    "membership": ("/membership", "Adventure belongs to everyone", "Join AAC", "Quarterly membership. More ways to get outside.", "about_picnic_w3.webp"),
}


def event_schedule(event):
    start, end = event.starts_at.astimezone(PACIFIC), event.ends_at.astimezone(PACIFIC)
    date = start.strftime("%a, %b %-d, %Y")
    clock = start.strftime("%-I:%M %p")
    if start.date() == end.date():
        if end != start:
            if start.tzname() != end.tzname():
                clock += " " + start.tzname()
            clock += "–" + end.strftime("%-I:%M %p")
    else:
        date += " – " + end.strftime("%a, %b %-d, %Y")
    clock += " " + (end.tzname() if start.date() == end.date() else start.tzname())
    return date, clock


def event_description(event):
    date, clock = event_schedule(event)
    parts = [date, clock, concise(event.destination, 70)]
    if event.state == "cancelled":
        reason = f": {concise(event.cancellation_reason, 45)}" if event.cancellation_reason else ""
        parts.insert(0, "Cancelled" + reason)
    essentials = concise(" · ".join(part for part in parts if part), 200)
    intro = re.split(r"(?<=[.!?])\s+", " ".join(event.description.split()), maxsplit=1)[0]
    remaining = 200 - len(essentials) - 3
    if intro and remaining >= 25:
        return essentials + " — " + concise(intro, remaining)
    return essentials


def event_photo(db, event):
    mid = event.photo_id
    if not mid and event.state == "completed":
        recap = db.get(Recap, event.id)
        if recap and recap.published:
            mid = recap.published.get("image_id")
    media = db.get(Media, mid) if mid else None
    if media and "large" in media.variants:
        return media
    return None


def public_event(db, eid):
    event = db.get(Event, eid) if 0 < eid <= 2**31 - 1 else None
    return event if event and event.state != "draft" and not event.skipped else None


def event_card(db, event, settings):
    media = event_photo(db, event)
    photo = settings.media_root / media.variants["large"] if media else None
    if photo and not photo.is_file():
        photo = None
    date, clock = event_schedule(event)
    card = ShareCard(
        title=event.name,
        label={"meeting": "Club meeting", "picnic": "Picnic", "retreat": "Quarterly retreat"}.get(event.kind, "Adventure"),
        date=date, time=clock, location=event.destination, cancelled=event.state == "cancelled",
        photo_key=media.id if photo else "", domain=urlsplit(settings.share_url).netloc,
    )
    return card, str(photo) if photo else ""


def page_card(key, settings):
    _, title, label, subtitle, filename = PAGE_CARDS[key]
    card = ShareCard(title=title, label=label, subtitle=subtitle, photo_key=filename,
                     domain=urlsplit(settings.share_url).netloc)
    return card, str(ASSETS / "images" / filename) if filename else ""


def card_metadata(card, path):
    return {"path": f"{path}?v={card.version}", "type": "image/jpeg", "width": SIZE[0], "height": SIZE[1],
            "alt": " · ".join(value for value in ["Cancelled" if card.cancelled else "", card.title, card.date,
                                                  card.time, card.location, card.subtitle] if value)}


def image_response(request, card, photo):
    etag = f'"{card.version}"'
    headers = {"Cache-Control": "private, max-age=300", "ETag": etag}
    # The routes resolve current public content before this cache or conditional check.
    candidates = (value.strip() for value in request.headers.get("if-none-match", "").split(","))
    # GET/HEAD use weak comparison; the public proxy may add the W/ prefix.
    if any(value == "*" or value.removeprefix("W/") == etag for value in candidates):
        return Response(status_code=304, headers=headers)
    content = render_card(card, photo)
    headers["Content-Length"] = str(len(content))
    return Response(content=b"" if request.method == "HEAD" else content, media_type="image/jpeg", headers=headers)


@router.api_route("/api/share-images/pages/{key}.jpg", methods=["GET", "HEAD"], include_in_schema=False)
def page_share_image(key: str, request: Request):
    if key not in PAGE_CARDS:
        fail(404, "not_found", "This sharing image could not be found.")
    return image_response(request, *page_card(key, request.app.state.settings))


@router.api_route("/api/share-images/events/{eid}.jpg", methods=["GET", "HEAD"], include_in_schema=False)
def event_share_image(eid: int, request: Request, db=Depends(get_db, scope="function")):
    event = public_event(db, eid)
    if not event:
        fail(404, "not_found", "This sharing image could not be found.")
    return image_response(request, *event_card(db, event, request.app.state.settings))


@router.get("/api/page-metadata", response_class=HTMLResponse, include_in_schema=False)
def page_metadata(
    request: Request,
    page_uri: str = Header(default="/", alias="X-AAC-Page-URI"),
    db=Depends(get_db, scope="function"),
):
    # A configured origin and known paths avoid Host poisoning and including
    # query strings that may contain OAuth return paths or private values.
    settings = request.app.state.settings
    base = settings.share_url
    path = unquote(page_uri.split("?", 1)[0]).rstrip("/") or "/"
    canonical, image, indexable, share_title = "/", None, False, None
    if path in PAGES:
        title, description = PAGES[path]
        canonical, indexable = path, path != "/sign-in"
        if indexable:
            key = next(key for key, value in PAGE_CARDS.items() if value[0] == path)
            card, _ = page_card(key, settings)
            share_title = card.title
            image = card_metadata(card, f"/api/share-images/pages/{key}.jpg")
    elif match := re.fullmatch(r"/events/[^/]+/([1-9][0-9]{0,9})", path):
        eid = int(match[1])
        event = public_event(db, eid)
        if event:
            share_title = f"{'Cancelled: ' if event.state == 'cancelled' else ''}{event.name}"
            title = f"{share_title} | AAC"
            description = event_description(event)
            canonical, indexable = f"/events/{slug(event.name)}/{event.id}", True
            card, _ = event_card(db, event, settings)
            image = card_metadata(card, f"/api/share-images/events/{eid}.jpg")
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
        meta("og:title", share_title or title),
        meta("og:description", description),
        meta("og:url", base + canonical),
        meta(
            "twitter:card",
            "summary_large_image" if image else "summary",
            "name",
        ),
        meta("twitter:title", share_title or title, "name"),
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
