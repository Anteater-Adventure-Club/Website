import io
from html.parser import HTMLParser

import pytest
from PIL import Image

from app.models import Event
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


@pytest.mark.parametrize(
    "path,title",
    [
        ("/", "Anteater Adventure Club"),
        ("/events", "Events |"),
        ("/board", "Meet the Board |"),
        ("/membership", "Membership |"),
    ],
)
def test_public_page_cards_have_distinct_copy_and_absolute_images(api, path, title):
    response, head = preview(api, path + "?return_to=private-secret")
    assert head.meta["og:title"].startswith(title)
    assert head.meta["og:url"] == "http://testserver" + path
    assert head.meta["og:image"] == "http://testserver/logos/aac.png"
    assert head.meta["twitter:card"] == "summary"
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
    assert head.meta["og:title"] == "Beach & bonfire | AAC"
    assert head.meta["og:url"] == f"http://testserver/events/beach-bonfire/{e['id']}"
    assert "Sunday, October 4, 2026 · 5:00 PM PDT" in head.meta["og:description"]
    assert "San Clemente · Bring water. Everyone is welcome!" in head.meta["og:description"]
    assert head.meta["og:image"] == f"http://testserver/media/{mid}/large"
    image = api.get(f"/media/{mid}/large")
    assert image.status_code == 200 and image.headers["Content-Type"] == "image/webp"


def test_photo_free_event_and_html_escaping(api):
    e = event(
        api,
        quarter(api),
        name='Trail "day" <script>alert(1)</script>',
        description='Look here: "><img src=x onerror=alert(1)>' + " long" * 100,
    )
    response, head = preview(api, f"/events/trail/{e['id']}")
    assert "og:image" not in head.meta
    assert head.meta["twitter:card"] == "summary"
    assert head.meta["og:title"] == e["name"] + " | AAC"
    assert "script" not in head.tags and "img" not in head.tags
    assert len(head.meta["og:description"]) <= 300
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
    assert "og:image" not in preview(api, path)[1].meta
    api.post(f"/api/admin/events/{e['id']}/state", json={"state": "completed"})
    assert "og:image" not in preview(api, path)[1].meta
    assert api.post(url + "/publication", json={}).status_code == 200
    assert preview(api, path)[1].meta["og:image"] == f"http://testserver/media/{mid}/large"
    assert api.delete(url + "/publication").status_code == 200
    assert "og:image" not in preview(api, path)[1].meta


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
    assert "May 23, 2026 – Tuesday, May 26, 2026" in preview(api, path)[1].meta["og:description"]
    with api.app.state.sessions() as db:
        stored = db.get(Event, e["id"])
        stored.state, stored.cancellation_reason = "cancelled", "Weather closure"
        stored.description = "Updated public description"
        db.commit()
    _, head = preview(api, path)
    assert head.meta["og:title"].startswith("Cancelled: Retreat")
    assert "Cancelled: Weather closure" in head.meta["og:description"]
    assert "Updated public description" in head.meta["og:description"]
