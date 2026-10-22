"""Split common text from the supplied fonts without removing other glyphs.

Run with fonttools[brotli] installed. CSS retains the complete WOFF2 files for
extended Latin and remaining Unicode ranges. The basic subset includes the
middle dot used in event cards, copyright, and common punctuation.
"""

from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1] / "frontend/public/fonts"
COMMON = (
    set(range(0x250))
    | set(range(0x2000, 0x2070))
    | set(range(0x20A0, 0x20D0))
    | set(range(0x2190, 0x2200))
)
BASIC = (
    set(range(0x80))
    | set(range(0xA0, 0xC0))
    | {0xD7}
    | set(range(0x2000, 0x2070))
    | set(range(0x20A0, 0x20D0))
    | set(range(0x2190, 0x2200))
)
for name in ("Chivo-Regular", "Chivo-Italic", "Lazydog"):
    for suffix, characters in (("latin", COMMON), ("basic", BASIC)):
        font = TTFont(ROOT / f"{name}.woff2", recalcTimestamp=False)
        options = subset.Options()
        options.layout_features = ["*"]
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=characters)
        subsetter.subset(font)
        font.flavor = "woff2"
        font.save(ROOT / f"{name}-{suffix}.woff2")
