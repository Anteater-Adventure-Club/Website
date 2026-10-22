"""Use the same static content versions and hero sources as the browser."""

import json
from functools import cache
from pathlib import Path

HERO_IMAGE_SIZES = "(max-width: 639px) 256px, (max-width: 767px) 210px, 238px"


@cache
def asset_versions():
    return json.loads((Path(__file__).resolve().parents[3] / "assets/static-asset-versions.json").read_text())


def static_asset_url(path):
    version = asset_versions().get(path)
    return f"{path}?v={version}" if version else path


def hero_sources(home):
    if home.polaroids and home.polaroids[0].image_id:
        mid = home.polaroids[0].image_id
        return f"/media/{mid}/medium", ", ".join(
            f"/media/{mid}/{variant} {width}w"
            for variant, width in (("small", 320), ("medium", 640), ("large", 1280))
        )
    fallback = "about_tide_pools" if home.polaroids else "griffith_park"
    return static_asset_url(f"/images/{fallback}.webp"), ", ".join(
        f"{static_asset_url(f'/images/responsive/{fallback}-{width}.webp')} {width}w"
        for width in (320, 640, 800)
    )
