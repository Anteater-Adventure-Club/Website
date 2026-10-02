"""Split common Latin text from the supplied fonts without removing other glyphs.

Run with fonttools[brotli] installed. CSS retains the complete WOFF2 files for
the remaining Unicode ranges; those files download only when needed.
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
for name in ("Chivo-Regular", "Chivo-Italic", "Lazydog"):
    font = TTFont(ROOT / f"{name}.woff2")
    options = subset.Options()
    options.layout_features = ["*"]
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=COMMON)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(ROOT / f"{name}-latin.woff2")
