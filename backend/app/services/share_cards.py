"""Deterministic AAC sharing artwork using the site's existing assets."""

import hashlib
import io
import json
from dataclasses import asdict, dataclass
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps, UnidentifiedImageError

ASSETS = Path(__file__).resolve().parents[3] / "frontend" / "public"
SIZE = (1200, 630)
FOREST = "#1f4d3b"
CREAM = "#f8f5f0"
SAGE = "#b6cbb5"
TEMPLATE_VERSION = 1


def concise(value, limit):
    text = " ".join(value.split())
    if len(text) <= limit:
        return text
    cut = text[: limit - 1]
    if " " in cut:
        cut = cut.rsplit(" ", 1)[0]
    return cut.rstrip(" ,;:·–-") + "…"


@dataclass(frozen=True)
class ShareCard:
    title: str
    label: str
    date: str = ""
    time: str = ""
    location: str = ""
    subtitle: str = ""
    cancelled: bool = False
    photo_key: str = ""
    domain: str = "aac.gdodge.dev"

    @property
    def version(self):
        content = json.dumps({"template": TEMPLATE_VERSION, **asdict(self)}, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()[:16]


def font(size, *, heading=False, bold=False):
    name = "Lazydog.otf" if heading else "Chivo-Regular.ttf"
    face = ImageFont.truetype(str(ASSETS / "fonts" / name), size)
    if bold:
        try:
            axes = face.get_variation_axes()
            face.set_variation_by_axes([700 if axis["name"] == b"Weight" else axis["default"] for axis in axes])
        except OSError:
            pass  # Static copies of Chivo already have the same readable letterforms.
    return face


def wrap(text, face, width):
    lines = []
    line = ""
    for word in " ".join(text.split()).split(" "):
        if face.getlength(word) > width:
            if line:
                lines.append(line)
                line = ""
            for char in word:
                if face.getlength(line + char) > width:
                    lines.append(line)
                    line = ""
                line += char
        elif line and face.getlength(line + " " + word) > width:
            lines.append(line)
            line = word
        else:
            line = (line + " " + word).strip()
    if line:
        lines.append(line)
    return lines


def text_block(draw, text, xy, width, *, size, minimum=None, lines=3, fill=CREAM, heading=False, bold=False):
    face = font(size, heading=heading, bold=bold)
    content = wrap(text, face, width)
    while minimum and len(content) > lines and size > minimum:
        size -= 2
        face = font(size, heading=heading, bold=bold)
        content = wrap(text, face, width)
    if len(content) > lines:
        content = content[:lines]
        last = content[-1]
        while last and face.getlength(last + "…") > width:
            last = last.rsplit(" ", 1)[0] if " " in last else last[:-1]
        content[-1] = last.rstrip() + "…"
    x, y = xy
    for line in content:
        draw.text((x, y), line, font=face, fill=fill, anchor="lt")
        y += round(size * 1.2)
    return y


def landscape(image):
    """A code-drawn outdoor motif for cards without an event photograph."""
    draw = ImageDraw.Draw(image)
    draw.rectangle((540, 0, 1200, 630), fill=CREAM)
    draw.ellipse((989, 79, 1083, 173), fill="#e5bd77")
    draw.polygon([(540, 384), (701, 163), (883, 384), (1015, 231), (1200, 392), (1200, 630), (540, 630)], fill="#b6cbb5")
    draw.polygon([(540, 438), (782, 274), (975, 428), (1200, 335), (1200, 630), (540, 630)], fill="#7da079")
    draw.polygon([(540, 535), (771, 420), (938, 488), (1200, 399), (1200, 630), (540, 630)], fill="#426b50")
    draw.polygon([(758, 630), (830, 527), (894, 478), (855, 546), (904, 630)], fill=CREAM)
    for x, y, height in [(636, 397, 141), (1080, 367, 182), (1154, 442, 139)]:
        draw.line((x, y, x, y + height), fill=FOREST, width=9)
        for offset, spread in [(0, 30), (31, 41), (67, 52)]:
            draw.polygon([(x, y + offset), (x - spread, y + offset + 70), (x + spread, y + offset + 70)], fill=FOREST)
    draw.text((586, 54), "SEE YOU OUT THERE", font=font(24, heading=True), fill=FOREST, anchor="lt")


@lru_cache(maxsize=128)
def render_card(card, photo_path=""):
    """Cache at most 128 JPEGs; publication is checked by the caller on every request."""
    image = Image.new("RGB", SIZE, FOREST)
    landscape(image)
    if photo_path:
        try:
            with Image.open(photo_path) as photo:
                photo = ImageOps.fit(photo.convert("RGB"), (660, 630), Image.Resampling.LANCZOS)
                image.paste(photo, (540, 0))
        except (OSError, ValueError, UnidentifiedImageError):
            pass  # The branded landscape remains usable if a media file is missing.
    draw = ImageDraw.Draw(image)
    with Image.open(ASSETS / "logos" / "aac.png") as logo:
        logo = logo.convert("RGBA")
        # Remove the original transparent padding without changing the artwork.
        logo = logo.crop(logo.getchannel("A").getbbox()).resize((78, 78), Image.Resampling.LANCZOS)
        image.paste(logo, (40, 36), logo)
    draw.text((134, 46), "AAC", font=font(38, heading=True), fill=CREAM, anchor="lt")
    draw.text((135, 92), "UC IRVINE", font=font(17), fill=SAGE, anchor="lt")
    label = "CANCELLED" if card.cancelled else card.label.upper()
    draw.text((42, 146), label, font=font(19, bold=True), fill="#f0bd9b" if card.cancelled else SAGE, anchor="lt")
    text_block(draw, card.title, (40, 191), 457, size=62, minimum=38, lines=3, bold=True)
    if card.date:
        text_block(draw, card.date, (42, 421), 456, size=27, minimum=21, lines=2, bold=True)
        draw.text((42, 489), card.time, font=font(23), fill=SAGE, anchor="lt")
        text_block(draw, card.location, (42, 530), 456, size=23, minimum=19, lines=2)
    else:
        text_block(draw, card.subtitle, (42, 429), 456, size=29, minimum=25, lines=3, fill=SAGE)
    draw.line((42, 593, 498, 593), fill="#587b69", width=1)
    draw.text((42, 607), card.domain, font=font(14), fill=SAGE, anchor="lt")
    output = io.BytesIO()
    image.save(output, "JPEG", quality=88, optimize=True)
    return output.getvalue()
