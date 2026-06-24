from __future__ import annotations

import json
from pathlib import Path

GENERATIONS_DIR = Path("generations")

_EXT: dict[str, str] = {
    "image": "png",
    "video": "mp4",
    "voice": "mp3",
    "email": "html",
}


def save_asset(
    campaign_id: str,
    asset_id: str,
    asset_type: str,
    data: bytes | str,
) -> str:
    ext = _EXT.get(asset_type, "bin")
    folder = GENERATIONS_DIR / campaign_id / asset_type
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{asset_id}.{ext}"
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
