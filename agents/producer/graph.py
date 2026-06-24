from __future__ import annotations

import uuid
from typing import Any


class _StubProducer:
    """Stub Producer — returns hardcoded generated_assets without calling any LLM."""

    async def ainvoke(self, input: dict[str, Any], **_kwargs) -> dict[str, Any]:
        num_variants: int = input.get("num_variants", 2)
        platforms: list[str] = input.get("platforms", ["instagram"])

        assets = []
        for i in range(num_variants):
            asset_id = str(uuid.uuid4())
            assets.append({
                "asset_id": asset_id,
                "platform": platforms[i % len(platforms)],
                "format": "carousel",
                "headline": f"Stub Headline {i + 1}",
                "body_copy": f"Stub body copy for variant {i + 1}. Quality you can trust.",
                "cta": "Shop Now",
                "visual_description": "Bright minimalist product shot on white background",
                "storage_url": None,
            })

        return {"generated_assets": assets}


producer_agent = _StubProducer()
