"""Prepare responsive copies of supplied photos; originals remain the source."""

from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1] / "frontend/public/images"
OUTPUT = ROOT / "responsive"
OUTPUT.mkdir(exist_ok=True)
for source in sorted(ROOT.glob("*.webp")):
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert("RGB")
        for width in (320, 640, 800):
            height = round(image.height * width / image.width)
            image.resize((width, height), Image.Resampling.LANCZOS).save(
                OUTPUT / f"{source.stem}-{width}.webp", "WEBP", quality=78, method=6
            )
