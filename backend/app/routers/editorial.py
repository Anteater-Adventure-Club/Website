import io
from typing import Annotated
from uuid import uuid4
from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import select, update
from ..auth import limited, officer
from ..db import get_db
from ..domain import advisory, audit, fail, require, revision, utcnow
from ..models import BoardEntry, BoardTerm, Event, Media, Officer, Recap
from ..projections import events_projection
from ..schemas import (
    Items,
    BoardEntryWrite,
    OrderWrite,
    RecapWrite,
    Revision,
    TermWrite,
    MediaView,
    RecapView,
    HomeView,
    GalleryRow,
    Page,
    BoardView,
    BoardPrivateView,
    BoardEntryPrivate,
    BoardTermView,
)
from .members import grant, revoke

router = APIRouter()
Image.MAX_IMAGE_PIXELS = 40_000_000


def image_visible(db, mid):
    if db.scalar(
        select(BoardEntry.id).where(BoardEntry.photo_id == mid, BoardEntry.visible.is_(True)).limit(1)
    ):
        return True
    if db.scalar(
        select(Event.id)
        .where(Event.photo_id == mid, Event.state != "draft", Event.skipped.is_(False))
        .limit(1)
    ):
        return True
    return any(r.published and r.published.get("image_id") == mid for r in db.scalars(select(Recap)))


def media_path(settings, media, variant):
    name = media.variants.get(variant)
    if not name:
        fail(404, "not_found", "This image could not be found.")
    return settings.media_root / name


@router.post("/api/admin/media", status_code=201, response_model=MediaView)
async def upload(
    request: Request,
    file: Annotated[UploadFile, File()],
    purpose: Annotated[str, Form()] = "event",
    focal_x: Annotated[float, Form(ge=0, le=1)] = 0.5,
    focal_y: Annotated[float, Form(ge=0, le=1)] = 0.5,
    user=Depends(officer),
    db=Depends(get_db, scope="function"),
):
    limited(request, db, "upload", 15)
    if purpose not in {"board", "event"}:
        fail(422, "purpose", "Choose board or event image.")
    data = await file.read(10 * 1024 * 1024 + 1)
    if len(data) > 10 * 1024 * 1024:
        fail(422, "image_size", "Choose an image smaller than 10 MiB.")
    try:
        with Image.open(io.BytesIO(data)) as source:
            # Camera JPEGs with auxiliary pictures can be identified as MPO.
            # Image.open starts on their primary photo; other pictures are not decoded.
            if source.format not in {"JPEG", "MPO", "PNG", "WEBP"}:
                fail(422, "image_format", "Use a JPEG, PNG or WebP image.")
            if source.width * source.height > 40_000_000:
                fail(422, "image_dimensions", "Choose an image with at most 40 megapixels.")
            source.load()
            image = ImageOps.exif_transpose(source).convert("RGB")
    except Image.DecompressionBombError:
        fail(422, "image_dimensions", "Choose an image with at most 40 megapixels.")
    except (UnidentifiedImageError, OSError, ValueError):
        fail(422, "image_invalid", "This image could not be decoded.")
    mid = uuid4().hex
    root = request.app.state.settings.media_root
    root.mkdir(parents=True, exist_ok=True)
    variants = {}
    for label, width in (("small", 320), ("medium", 640), ("large", 1280)):
        height = width if purpose == "board" else width * 3 // 4
        cropped = ImageOps.fit(image, (width, height), Image.Resampling.LANCZOS, centering=(focal_x, focal_y))
        name = f"{mid}-{label}.webp"
        cropped.save(root / name, "WEBP", quality=85, method=6)
        variants[label] = name
    media = Media(id=mid, purpose=purpose, width=image.width, height=image.height, variants=variants)
    db.add(media)
    audit(db, user, "media.upload", mid, {"purpose": purpose})
    return {
        "id": mid,
        "width": image.width,
        "height": image.height,
        "variants": list(variants),
        "preview_url": f"/api/admin/media/{mid}?variant=medium",
    }


@router.get("/api/admin/media/{mid}")
def preview_image(
    mid: str, request: Request, variant: str = "medium", user=Depends(officer), db=Depends(get_db, scope="function")
):
    media = require(db, Media, mid)
    return FileResponse(
        media_path(request.app.state.settings, media, variant),
        media_type="image/webp",
        headers={"Cache-Control": "no-store"},
    )


@router.get("/media/{mid}/{variant}")
def public_image(mid: str, variant: str, request: Request, db=Depends(get_db, scope="function")):
    media = require(db, Media, mid)
    if not image_visible(db, mid):
        fail(404, "not_found", "This image could not be found.")
    # Re-check visibility after every unpublication; cache only inside the browser.
    return FileResponse(
        media_path(request.app.state.settings, media, variant),
        media_type="image/webp",
        headers={"Cache-Control": "private, max-age=300"},
    )


@router.delete("/api/admin/media/{mid}")
def delete_image(mid: str, request: Request, user=Depends(officer), db=Depends(get_db, scope="function")):
    media = require(db, Media, mid, True)
    referenced = (
        image_visible(db, mid)
        or db.scalar(select(Event.id).where(Event.photo_id == mid).limit(1))
        or db.scalar(select(BoardEntry.id).where(BoardEntry.photo_id == mid).limit(1))
    )
    if referenced or any(r.draft.get("image_id") == mid for r in db.scalars(select(Recap))):
        fail(409, "image_referenced", "Remove this photo from its event, recap or board profile first.")
    for name in media.variants.values():
        (request.app.state.settings.media_root / name).unlink(missing_ok=True)
    db.delete(media)
    audit(db, user, "media.remove", mid)
    return {"ok": True}


@router.get("/api/admin/events/{eid}/recap", response_model=RecapView)
def get_recap(eid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    e = require(db, Event, eid)
    recap = db.get(Recap, eid)
    return {
        "event_id": eid,
        "completion": e.completion,
        "draft": recap.draft if recap else {},
        "published": recap.published if recap else None,
        "revision": recap.revision if recap else 0,
    }


@router.put("/api/admin/events/{eid}/recap", response_model=RecapView)
def save_recap(eid: int, value: RecapWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    require(db, Event, eid, True)
    recap = db.get(Recap, eid)
    if recap:
        revision(recap, value.expected_revision)
    else:
        if value.expected_revision not in {None, 0}:
            fail(409, "stale_revision", "This recap changed. Refresh and try again.")
        recap = Recap(event_id=eid, draft={})
        db.add(recap)
        db.flush()
    if value.image_id:
        require(db, Media, value.image_id, True)
    recap.draft = value.model_dump(exclude={"expected_revision"})
    recap.revision += 1
    audit(db, user, "recap.save", eid)
    db.flush()
    return get_recap(eid, user, db)


@router.post("/api/admin/events/{eid}/recap/publication", response_model=RecapView)
def publish_recap(eid: int, value: Revision, user=Depends(officer), db=Depends(get_db, scope="function")):
    e = require(db, Event, eid, True)
    recap = db.get(Recap, eid)
    if not recap:
        fail(422, "recap_required", "Save a recap before publishing.")
    revision(recap, value.expected_revision)
    if e.state != "completed":
        fail(409, "completion_required", "Complete the event before publishing its recap.")
    if any(not recap.draft.get(k) for k in ("image_id", "title", "caption", "text")):
        fail(422, "recap_incomplete", "Photo, title, caption and recap are required to publish.")
    recap.published = {**recap.draft, "published_at": utcnow().isoformat()}
    recap.revision += 1
    audit(db, user, "recap.publish", eid)
    return get_recap(eid, user, db)


@router.delete("/api/admin/events/{eid}/recap/publication")
def unpublish_recap(eid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    require(db, Event, eid, True)
    recap = db.get(Recap, eid)
    if recap and recap.published:
        recap.published = None
        recap.revision += 1
        audit(db, user, "recap.unpublish", eid)
    return {"ok": True}


def gallery_items(db, homepage=False):
    result = []
    for r, e in db.execute(
        select(Recap, Event)
        .join(Event)
        .where(Recap.published.is_not(None), Event.skipped.is_(False), Event.state == "completed")
        .order_by(Event.starts_at.desc())
    ):
        if not r.published:
            continue
        if not homepage or r.published.get("homepage"):
            result.append({"event_id": e.id, "event_name": e.name, "starts_at": e.starts_at,
                           "ends_at": e.ends_at, **r.published})
    return result


@router.get("/api/gallery", response_model=Page[GalleryRow])
def gallery(
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    db=Depends(get_db, scope="function"),
):
    rows = gallery_items(db)
    return {"items": rows[offset : offset + limit], "total": len(rows)}


@router.get("/api/gallery/{eid}", response_model=GalleryRow)
def gallery_detail(eid: int, db=Depends(get_db, scope="function")):
    row = next((r for r in gallery_items(db) if r["event_id"] == eid), None)
    if row is None:
        fail(404, "not_found", "This polaroid could not be found.")
    return row


@router.get("/api/home", response_model=HomeView)
def home(db=Depends(get_db, scope="function")):
    n = utcnow()
    events = list(
        db.scalars(
            select(Event)
            .where(Event.state == "published", Event.skipped.is_(False), Event.ends_at >= n)
            .order_by(Event.starts_at)
            .limit(8)
        )
    )
    return {"upcoming": events_projection(db, events), "polaroids": gallery_items(db, True)[:12]}


def term_view(term):
    return {
        "id": term.id,
        "label": term.label,
        "start_year": term.start_year,
        "current": term.current,
        "revision": term.revision,
    }


def entry_view(db, entry, private=False):
    fields = (
        "id",
        "term_id",
        "name",
        "role",
        "major",
        "bio",
        "memory",
        "instagram",
        "photo_id",
        "palette",
        "position",
    )
    data = {k: getattr(entry, k) for k in fields}
    if private:
        data.update(
            member_id=entry.member_id,
            visible=entry.visible,
            revision=entry.revision,
            site_access=bool(entry.member_id and db.get(Officer, entry.member_id)),
        )
    return data


@router.get("/api/board/terms", response_model=Items[BoardTermView])
def public_terms(db=Depends(get_db, scope="function")):
    return {
        "items": [term_view(t) for t in db.scalars(select(BoardTerm).order_by(BoardTerm.start_year.desc()))]
    }


@router.get("/api/board", response_model=BoardView)
def public_board(term_id: int | None = None, db=Depends(get_db, scope="function")):
    term = (
        require(db, BoardTerm, term_id)
        if term_id
        else db.scalar(select(BoardTerm).where(BoardTerm.current.is_(True)))
    )
    if term is None:
        return {"term": None, "entries": []}
    entries = db.scalars(
        select(BoardEntry)
        .where(BoardEntry.term_id == term.id, BoardEntry.visible.is_(True))
        .order_by(BoardEntry.position, BoardEntry.id)
    )
    return {"term": term_view(term), "entries": [entry_view(db, e) for e in entries]}


@router.get("/api/admin/board/terms", response_model=Items[BoardTermView])
def admin_terms(user=Depends(officer), db=Depends(get_db, scope="function")):
    return public_terms(db)


@router.post("/api/admin/board/terms", status_code=201, response_model=BoardTermView)
def add_term(value: TermWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    advisory(db, 703)
    db.execute(update(BoardTerm).values(current=False))
    term = BoardTerm(**value.model_dump())
    db.add(term)
    db.flush()
    audit(db, user, "board.term", term.id)
    return term_view(term)


@router.get("/api/admin/board/terms/{tid}", response_model=BoardPrivateView)
def manage_term(tid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    term = require(db, BoardTerm, tid)
    return {
        "term": term_view(term),
        "entries": [
            entry_view(db, e, True)
            for e in db.scalars(
                select(BoardEntry)
                .where(BoardEntry.term_id == tid)
                .order_by(BoardEntry.position, BoardEntry.id)
            )
        ],
    }


def apply_entry(db, entry, value, user):
    if value.photo_id:
        media = require(db, Media, value.photo_id, True)
        if media.purpose != "board":
            fail(422, "photo_purpose", "Use a square board photo.")
    if value.site_access and not value.member_id:
        fail(422, "member_required", "Link a member before granting site access.")
    if value.member_id:
        (grant if value.site_access else revoke)(db, value.member_id, user)
    for key, item in value.model_dump(exclude={"expected_revision", "site_access"}).items():
        setattr(entry, key, item)


@router.post("/api/admin/board/terms/{tid}/entries", status_code=201, response_model=BoardEntryPrivate)
def add_entry(tid: int, value: BoardEntryWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    require(db, BoardTerm, tid, True)
    entry = BoardEntry(term_id=tid)
    apply_entry(db, entry, value, user)
    db.add(entry)
    db.flush()
    audit(db, user, "board.entry.create", entry.id)
    return entry_view(db, entry, True)


@router.put("/api/admin/board/entries/{eid}", response_model=BoardEntryPrivate)
def edit_entry(eid: int, value: BoardEntryWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    entry = require(db, BoardEntry, eid, True)
    revision(entry, value.expected_revision)
    apply_entry(db, entry, value, user)
    entry.revision += 1
    audit(db, user, "board.entry.edit", eid)
    return entry_view(db, entry, True)


@router.delete("/api/admin/board/entries/{eid}")
def delete_entry(eid: int, user=Depends(officer), db=Depends(get_db, scope="function")):
    entry = require(db, BoardEntry, eid, True)
    db.delete(entry)
    audit(db, user, "board.entry.remove", eid)
    return {"ok": True}


@router.put("/api/admin/board/terms/{tid}/order")
def order_entries(tid: int, value: OrderWrite, user=Depends(officer), db=Depends(get_db, scope="function")):
    term = require(db, BoardTerm, tid, True)
    revision(term, value.expected_revision)
    entries = list(db.scalars(select(BoardEntry).where(BoardEntry.term_id == tid)))
    if len(value.ids) != len(entries) or set(value.ids) != {e.id for e in entries}:
        fail(422, "order_invalid", "Include each board profile exactly once.")
    order = {eid: i for i, eid in enumerate(value.ids)}
    for entry in entries:
        entry.position = order[entry.id]
    term.revision += 1
    audit(db, user, "board.order", tid)
    return manage_term(tid, user, db)
