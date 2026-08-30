from __future__ import annotations

import io
import json
import shutil
import uuid
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from utils.exceptions import ValidationError

GENERATIONS_DIR = Path("generations")
BUSINESS_ASSETS_DIR = Path("business_assets")

_EXT: dict[str, str] = {
    "image": "png",
    "video": "mp4",
    "voice": "mp3",
    "email": "html",
}

# Business-asset uploads (logo, product photos) are validated by actually
# decoding the bytes with Pillow — never trust the client-supplied filename
# or Content-Type header, both are trivially spoofable. Only formats in this
# map are accepted; the extension is derived from Pillow's own detection,
# never from the uploaded filename.
_ALLOWED_IMAGE_FORMATS: dict[str, str] = {
    "PNG": "png",
    "JPEG": "jpg",
    "WEBP": "webp",
}
_MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB


def _validate_image_bytes(data: bytes) -> str:
    """Decode + verify the bytes are really an image of an allowed format.

    Returns the file extension to use. Raises ValidationError otherwise.
    """
    if len(data) > _MAX_UPLOAD_BYTES:
        raise ValidationError(f"Image exceeds the {_MAX_UPLOAD_BYTES // (1024 * 1024)}MB upload limit.")
    try:
        with Image.open(io.BytesIO(data)) as img:
            img.verify()  # cheap structural check, doesn't decode pixel data
        # Re-open — verify() leaves the file object unusable for further reads.
        with Image.open(io.BytesIO(data)) as img:
            fmt = img.format
    except (UnidentifiedImageError, OSError) as exc:
        raise ValidationError("File is not a valid image (png, jpg, or webp).") from exc

    ext = _ALLOWED_IMAGE_FORMATS.get(fmt or "")
    if not ext:
        raise ValidationError(f"Unsupported image format '{fmt}'. Allowed: png, jpg, webp.")
    return ext


def asset_output_path(campaign_id: str, asset_id: str, asset_type: str) -> str:
    """Path convention for a producer-generated file, without writing it —
    the caller (e.g. a MediaGen provider) writes the actual bytes there."""
    ext = _EXT.get(asset_type, "bin")
    folder = GENERATIONS_DIR / campaign_id / asset_type
    folder.mkdir(parents=True, exist_ok=True)
    return str(folder / f"{asset_id}.{ext}")


def save_asset(
    campaign_id: str,
    asset_id: str,
    asset_type: str,
    data: bytes | str,
) -> str:
    path = Path(asset_output_path(campaign_id, asset_id, asset_type))
    if isinstance(data, str):
        path.write_text(data, encoding="utf-8")
    else:
        path.write_bytes(data)
    return str(path)


def save_generation(campaign_id: str, filename: str, data: dict) -> str:
    """Save a JSON artifact to generations/{campaign_id}/{filename}.

    Used to persist each agent's output (research_report.json,
    strategy_doc.json, audit_results.json, etc.) alongside binary assets.
    """
    folder = GENERATIONS_DIR / campaign_id
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / filename
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
    return str(path)


def get_asset_path(storage_url: str) -> Path:
    return Path(storage_url)


# ── Business input assets (logo, product photography) ────────────────────────
#
# These are INPUT assets — real brand files a business supplies so agents can
# ground generation in the actual product/logo instead of an AI approximation
# (see docs/agents/STATIC_AD_AGENT design discussion). Separate from
# `generations/`, which holds OUTPUT assets the pipeline produces.

def save_business_logo(business_id: str, data: bytes) -> str:
    """Validate and store a business's logo. Upsert — always overwrites any
    previous logo file for this business (a business has exactly one)."""
    ext = _validate_image_bytes(data)
    folder = BUSINESS_ASSETS_DIR / business_id
    folder.mkdir(parents=True, exist_ok=True)
    # Fixed filename (not content-hashed) so re-uploading cleanly replaces the
    # old file rather than accumulating orphans; old-extension leftovers from
    # a format change are swept below.
    for stale in folder.glob("logo.*"):
        stale.unlink(missing_ok=True)
    path = folder / f"logo.{ext}"
    path.write_bytes(data)
    return str(path)


def save_product_image(business_id: str, product_id: str, data: bytes) -> str:
    """Validate and store one product photo. Additive — appends to that
    product's gallery rather than replacing anything; a product can have
    multiple reference photos."""
    ext = _validate_image_bytes(data)
    folder = BUSINESS_ASSETS_DIR / business_id / "products" / product_id
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{uuid.uuid4()}.{ext}"
    path.write_bytes(data)
    return str(path)


def delete_business_asset(storage_url: str) -> None:
    """Best-effort delete of a business asset file. Silently no-ops if the
    path is already gone or was never a real file — the BKO's own list of
    URLs is the source of truth, not the filesystem."""
    path = Path(storage_url)
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


def delete_business_assets_dir(business_id: str) -> None:
    """Remove all stored assets (logo + every product's gallery) for a
    business. Called when a business is deleted, so files don't outlive the
    DB row that references them."""
    folder = BUSINESS_ASSETS_DIR / business_id
    shutil.rmtree(folder, ignore_errors=True)


def delete_product_assets_dir(business_id: str, product_id: str) -> None:
    """Remove all stored images for a single product. Called when a product
    is deleted, so files don't outlive the DB row that references them."""
    folder = BUSINESS_ASSETS_DIR / business_id / "products" / product_id
    shutil.rmtree(folder, ignore_errors=True)
