import io

import pytest
from PIL import Image


def photo_bytes(format, size=(900, 600), orientation=None):
    output = io.BytesIO()
    primary = Image.new("RGB", size, "green")
    options = {}
    if orientation:
        exif = Image.Exif()
        exif[274] = orientation
        options["exif"] = exif
    if format == "MPO":
        options.update(save_all=True, append_images=[Image.new("RGB", (120, 80), "red")])
    primary.save(output, format, **options)
    return output.getvalue()


@pytest.mark.parametrize("purpose", ["board", "event"])
def test_24mp_multi_picture_jpeg_upload_uses_primary_photo(api, purpose):
    data = photo_bytes("MPO", (6000, 4000))
    with Image.open(io.BytesIO(data)) as source:
        assert source.format == "MPO"
        assert source.n_frames == 2
    response = api.post(
        "/api/admin/media",
        files={"file": ("camera-photo.jpg", data, "image/jpeg")},
        data={"purpose": purpose},
    )
    assert response.status_code == 201, response.text
    uploaded = response.json()
    assert (uploaded["width"], uploaded["height"]) == (6000, 4000)
    for variant, width in [("small", 320), ("medium", 640), ("large", 1280)]:
        preview = api.get(f"/api/admin/media/{uploaded['id']}?variant={variant}")
        assert preview.status_code == 200
        with Image.open(io.BytesIO(preview.content)) as image:
            assert image.format == "WEBP"
            assert image.size == (width, width if purpose == "board" else width * 3 // 4)
            red, green, blue = image.getpixel((width // 2, image.height // 2))
            assert green > red + 80 and green > blue + 80


@pytest.mark.parametrize("format", ["JPEG", "PNG", "WEBP", "MPO"])
def test_photo_upload_applies_exif_orientation(api, format):
    response = api.post(
        "/api/admin/media",
        files={"file": ("photo.jpg", photo_bytes(format, orientation=6), "image/jpeg")},
        data={"purpose": "board"},
    )
    assert response.status_code == 201, response.text
    assert (response.json()["width"], response.json()["height"]) == (600, 900)


def test_unsupported_photo_format_error_does_not_claim_it_is_too_large(api):
    response = api.post(
        "/api/admin/media", files={"file": ("photo.gif", photo_bytes("GIF"), "image/gif")}
    )
    assert response.status_code == 422
    assert response.json()["detail"] == {
        "code": "image_format",
        "message": "Use a JPEG, PNG or WebP image.",
    }


def test_photo_pixel_limit_has_a_separate_error(api):
    response = api.post(
        "/api/admin/media",
        files={"file": ("oversized.jpg", photo_bytes("JPEG", (8000, 5001)), "image/jpeg")},
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "image_dimensions"
    assert "40 megapixels" in response.json()["detail"]["message"]


def test_invalid_photo_is_rejected(api):
    response = api.post("/api/admin/media", files={"file": ("photo.jpg", b"not a photo", "image/jpeg")})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "image_invalid"


def test_photo_byte_limit_is_preserved(api):
    response = api.post(
        "/api/admin/media",
        files={"file": ("too-large.jpg", b"x" * (10 * 1024 * 1024 + 1), "image/jpeg")},
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "image_size"
