import io
from dataclasses import replace
from html.parser import HTMLParser

import pytest
from PIL import Image

from app.models import Event
from app.config import Settings
from app.services.share_cards import render_card
from conftest import event, quarter


class Head(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.meta = {}
        self.tags = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        self.tags.append(tag)
        attrs = dict(attrs)
        if tag == "meta":
            self.meta[attrs.get("property") or attrs.get("name")] = attrs.get("content")


def preview(api, path):
    response = api.get("/api/page-metadata", headers={"X-AAC-Page-URI": path, "Host": "untrusted.example"})
    assert response.status_code == 200, response.text
    assert response.headers["Cache-Control"] == "no-store"
    return response, Head(response.text)


def photo(api):
    output = io.BytesIO()
    Image.new("RGB", (900, 600), "green").save(output, "JPEG")
    response = api.post("/api/admin/media", files={"file": ("photo.jpg", output.getvalue(), "image/jpeg")})
    assert response.status_code == 201, response.text
    return response.json()["id"]


@pytest.mark.parametrize("path,title", [("/privacy", "Privacy Policy"), ("/terms", "Terms of Service")])
def test_legal_pages_have_public_metadata_without_a_share_card(api, path, title):
    api.cookies.clear()
    response, head = preview(api, path + "/?return_to=private-secret")
    assert f"<title>{title} | Anteater Adventure Club</title>" in response.text
    assert head.meta["og:url"] == "http://testserver" + path
    assert f'rel="canonical" href="http://testserver{path}"' in response.text
    assert head.meta["twitter:card"] == "summary"
    assert "robots" not in head.meta and "og:image" not in head.meta
    assert "private-secret" not in response.text and "untrusted.example" not in response.text


@pytest.mark.parametrize(
    "path,title",
    [
        ("/", "Anteater Adventure Club"),
        ("/events", "Your next adventure"),
        ("/board", "Meet the board"),
        ("/membership", "Adventure belongs to everyone"),
    ],
)
def test_public_page_cards_have_distinct_copy_and_absolute_images(api, path, title):
    response, head = preview(api, path + "?return_to=private-secret")
    assert head.meta["og:title"].startswith(title)
    assert head.meta["og:url"] == "http://testserver" + path
    assert head.meta["og:image"].startswith("http://testserver/api/share-images/pages/")
    assert head.meta["twitter:card"] == "summary_large_image"
    assert head.meta["og:image:width"] == "1200" and head.meta["og:image:height"] == "630"
    image = api.get(head.meta["og:image"])
    assert image.status_code == 200 and image.headers["content-type"] == "image/jpeg"
    with Image.open(io.BytesIO(image.content)) as card:
        assert card.size == (1200, 630)
    assert "private-secret" not in response.text and "untrusted.example" not in response.text


def test_event_preview_has_pacific_date_canonical_description_and_assigned_photo(api):
    q = quarter(api, starts_on="2026-09-01", ends_on="2026-12-31")
    mid = photo(api)
    e = event(
        api,
        q,
        name="Beach & bonfire",
        destination="San Clemente",
        description="Bring water.\nEveryone is welcome!",
        photo_id=mid,
        starts_at="2026-10-05T00:00:00Z",
        ends_at="2026-10-05T03:00:00Z",
        departure_at="2026-10-05T00:00:00Z",
    )
    api.cookies.clear()
    _, head = preview(api, f"/events/old-slug/{e['id']}?tracking=secret")
    assert head.meta["og:title"] == "Beach & bonfire"
    assert head.meta["og:url"] == f"http://testserver/events/beach-bonfire/{e['id']}"
    assert "Sun, Oct 4, 2026 · 5:00 PM–8:00 PM PDT" in head.meta["og:description"]
    assert "San Clemente — Bring water." in head.meta["og:description"]
    assert "Everyone is welcome" not in head.meta["og:description"]
    assert head.meta["og:image"].startswith(f"http://testserver/api/share-images/events/{e['id']}.jpg?v=")
    image = api.get(head.meta["og:image"])
    assert image.status_code == 200 and image.headers["Content-Type"] == "image/jpeg"
    with Image.open(io.BytesIO(image.content)) as card:
        # The assigned green photo fills the right half of the designed card.
        r, g, b = card.getpixel((1000, 300))
        assert g > r + 50 and g > b + 50


def test_photo_free_event_and_html_escaping(api):
    e = event(
        api,
        quarter(api),
        name='Trail "day" <script>alert(1)</script>',
        description='Look here: "><img src=x onerror=alert(1)>' + " long" * 100,
    )
    response, head = preview(api, f"/events/trail/{e['id']}")
    assert head.meta["og:image"].startswith(f"http://testserver/api/share-images/events/{e['id']}.jpg")
    assert head.meta["twitter:card"] == "summary_large_image"
    assert head.meta["og:title"] == e["name"]
    assert "script" not in head.tags and "img" not in head.tags
    assert len(head.meta["og:description"]) <= 200
    assert "<script>" not in response.text


@pytest.mark.parametrize("state", ["draft", "skipped", "missing"])
def test_unavailable_events_never_expose_event_details_even_to_officers(api, state):
    e = event(api, quarter(api), name="Secret draft destination", publish=state != "draft")
    if state == "skipped":
        with api.app.state.sessions() as db:
            db.get(Event, e["id"]).skipped = True
            db.commit()
    eid = e["id"] if state != "missing" else 2147483648
    response, head = preview(api, f"/events/anything/{eid}")
    assert "Secret draft destination" not in response.text
    assert head.meta["og:title"].startswith("Event Unavailable")
    assert "og:image" not in head.meta and head.meta["robots"] == "noindex, nofollow"
    assert api.get(f"/api/share-images/events/{eid}.jpg").status_code == 404


@pytest.mark.parametrize(
    "path",
    ["/admin/members", "/admin/events/secret/1", "/my-aac/profile", "/sign-in?return_to=secret", "/missing"],
)
def test_private_and_unknown_paths_have_generic_metadata(api, path):
    response, head = preview(api, path)
    assert "secret" not in response.text and "officer@uci.edu" not in response.text
    assert "og:image" not in head.meta and head.meta["robots"] == "noindex, nofollow"


def test_recap_image_is_only_used_when_completed_and_published(api):
    e = event(api, quarter(api), signups_enabled=False)
    mid = photo(api)
    url = f"/api/admin/events/{e['id']}/recap"
    response = api.put(
        url, json={"image_id": mid, "title": "A great day", "caption": "Trail day", "text": "Recap"}
    )
    assert response.status_code == 200, response.text
    path = f"/events/trail/{e['id']}"
    original = preview(api, path)[1].meta["og:image"]
    original_bytes = api.get(original).content
    api.post(f"/api/admin/events/{e['id']}/state", json={"state": "completed"})
    assert preview(api, path)[1].meta["og:image"] == original
    assert api.post(url + "/publication", json={}).status_code == 200
    published = preview(api, path)[1].meta["og:image"]
    assert published != original
    assert api.get(published).content != original_bytes
    assert api.delete(url + "/publication").status_code == 200
    assert preview(api, path)[1].meta["og:image"] == original
    # Even a previously cached image URL now renders only the fallback.
    assert api.get(published).content == original_bytes


def test_multi_day_cancelled_preview_and_content_changes_are_current(api):
    q = quarter(api, starts_on="2026-01-01", ends_on="2026-12-31")
    e = event(
        api,
        q,
        name="Retreat",
        starts_at="2026-05-23T15:00:00Z",
        ends_at="2026-05-26T22:00:00Z",
        departure_at="2026-05-23T15:00:00Z",
    )
    path = f"/events/retreat/{e['id']}"
    original = preview(api, path)[1].meta["og:image"]
    assert "May 23, 2026 – Tue, May 26, 2026" in preview(api, path)[1].meta["og:description"]
    with api.app.state.sessions() as db:
        stored = db.get(Event, e["id"])
        stored.state, stored.cancellation_reason = "cancelled", "Weather closure"
        stored.description = "Updated public description"
        db.commit()
    _, head = preview(api, path)
    assert head.meta["og:title"].startswith("Cancelled: Retreat")
    assert "Cancelled: Weather closure" in head.meta["og:description"]
    assert "Updated public description" in head.meta["og:description"]
    assert head.meta["og:image"] != original


def test_public_origin_is_independent_of_authentication_and_request_headers(api):
    before = api.app.state.settings
    api.app.state.settings = replace(before, public_site_url="https://aac.example.org").validate()
    response, head = preview(api, "/?token=do-not-share")
    assert head.meta["og:url"] == "https://aac.example.org/"
    assert head.meta["og:image"].startswith("https://aac.example.org/api/share-images/")
    assert head.meta["og:image:secure_url"] == head.meta["og:image"]
    assert 'rel="canonical" href="https://aac.example.org/"' in response.text
    assert "untrusted.example" not in response.text and "do-not-share" not in response.text
    assert api.app.state.settings.app_url == before.app_url


def test_image_cache_rechecks_visibility_and_supports_head_and_etag(api):
    e = event(api, quarter(api), name="A public adventure")
    url = preview(api, f"/events/adventure/{e['id']}")[1].meta["og:image"]
    image = api.get(url)
    assert image.status_code == 200 and image.headers["Cache-Control"] == "private, max-age=300"
    assert api.head(url).headers["content-length"] == str(len(image.content))
    assert api.head(url).content == b""
    etag = image.headers["etag"]
    assert api.get(url, headers={"If-None-Match": etag}).status_code == 304
    assert api.get(url, headers={"If-None-Match": f'"other", W/{etag}'}).status_code == 304
    assert api.head(url, headers={"If-None-Match": f"W/{etag}"}).status_code == 304
    assert api.get(url, headers={"If-None-Match": "*"}).status_code == 304
    with api.app.state.sessions() as db:
        db.get(Event, e["id"]).name = "An updated adventure"
        db.commit()
    updated = api.get(url, headers={"If-None-Match": etag})
    assert updated.status_code == 200 and updated.headers["etag"] != etag
    with api.app.state.sessions() as db:
        db.get(Event, e["id"]).state = "draft"
        db.commit()
    hidden = api.get(url, headers={"If-None-Match": updated.headers["etag"]})
    assert hidden.status_code == 404 and hidden.headers["Cache-Control"] == "no-store"
    assert api.get(url, headers={"If-None-Match": "*"}).status_code == 404


def test_missing_photo_file_has_a_usable_branded_fallback(api):
    e = event(api, quarter(api), photo_id=photo(api), name="Outdoor adventure")
    url = preview(api, f"/events/outdoors/{e['id']}")[1].meta["og:image"]
    original = api.get(url).content
    for path in api.app.state.settings.media_root.glob("*.webp"):
        path.unlink()
    updated = preview(api, f"/events/outdoors/{e['id']}")[1].meta["og:image"]
    assert updated != url
    fallback = api.get(updated)
    assert fallback.status_code == 200 and fallback.content != original
    with Image.open(io.BytesIO(fallback.content)) as card:
        assert card.size == (1200, 630)


def test_long_unicode_titles_and_locations_fit_a_bounded_card(api):
    e = event(api, quarter(api), name="Café & coastal adventures " * 4,
              destination="A long destination along the beautiful Southern California coast " * 3,
              description="This introduction is deliberately long " * 40)
    _, head = preview(api, f"/events/long/{e['id']}")
    assert len(head.meta["og:description"]) <= 200
    image = api.get(head.meta["og:image"])
    assert image.status_code == 200 and len(image.content) < 500_000
    assert render_card.cache_info().maxsize == 128
    with Image.open(io.BytesIO(image.content)) as card:
        assert card.size == (1200, 630)


@pytest.mark.parametrize("origin", ["//example.com", "https://example.com/private", "https://a:b@example.com", "https://example.com?token=secret", "http://example.com"])
def test_invalid_production_public_origins_are_rejected(origin):
    with pytest.raises(RuntimeError, match="PUBLIC_SITE_URL"):
        Settings(environment="production", public_site_url=origin).validate()


def test_unknown_page_share_image_is_not_available(api):
    assert api.get("/api/share-images/pages/sign-in.jpg").status_code == 404
