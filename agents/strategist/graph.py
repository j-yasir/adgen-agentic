from __future__ import annotations

from typing import Any


class _StubStrategist:
    """Stub Strategist — returns a hardcoded StrategyDoc without calling any LLM."""

    async def ainvoke(self, input: dict[str, Any], **_kwargs) -> dict[str, Any]:
        return {
            "strategy_doc": {
                "positioning": "Authentic brand voice for everyday consumers",
                "unique_value_prop": "Quality products at accessible prices",
                "messaging_pillars": ["trust", "value", "speed"],
                "tone_of_voice": "conversational, warm, direct",
                "content_themes": ["customer stories", "product demos", "behind-the-scenes"],
                "platform_tactics": {
                    "instagram": {
                        "formats": ["carousel", "reels"],
                        "posting_cadence": "3x per week",
                        "cta": "Shop now",
                    },
                    "facebook": {
                        "formats": ["single image", "video"],
                        "posting_cadence": "2x per week",
                        "cta": "Learn more",
                    },
                },
                "asset_brief": {
                    "num_variants": 2,
                    "funnel_stage": "tofu",
                    "primary_emotion": "aspiration",
                    "visual_style": "bright, minimalist",
                    "copy_length": "short",
                },
                "kpis": ["CTR", "reach", "engagement_rate"],
            }
        }


strategist_agent = _StubStrategist()
