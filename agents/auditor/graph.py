from __future__ import annotations

import asyncio
from typing import Any, Callable

PASS_THRESHOLD = 7.5


class _StubAuditor:
    """Stub Auditor — scores all assets above the pass threshold (8.0 > 7.5)."""

    async def ainvoke(self, input: dict[str, Any], on_event: Callable | None = None, **_kwargs) -> dict[str, Any]:
        emit = on_event or (lambda *_: None)
        assets: list[dict] = input.get("generated_assets", [])

        audit_results = []
        assets_approved: list[str] = []
        assets_rejected: list[str] = []

        for asset in assets:
            asset_id = asset["asset_id"]
            platform = asset.get("platform", "?")
            asset_type = asset.get("asset_type", "asset")

            emit("tool_call", {
                "tool": "audit_asset",
                "asset_id": asset_id,
                "platform": platform,
                "message": f"Scoring {platform} {asset_type.replace('_', ' ')} — brand fit, hook strength, compliance…",
            })

            # Brief pause so events arrive one-by-one rather than all at once
            await asyncio.sleep(0.1)

            scores = {
                "relevance": 9.1,
                "clarity": 9.3,
                "brand_alignment": 8.9,
                "cta_strength": 8.7,
                "creative_quality": 9.2,
            }
            weighted_avg = sum(scores.values()) / len(scores)
            passed = weighted_avg >= PASS_THRESHOLD

            audit_results.append({
                "asset_id": asset_id,
                "platform": platform,
                "asset_type": asset_type,
                "format": asset.get("format", ""),
                "scores": scores,
                "weighted_avg": round(weighted_avg, 2),
                "brand_score": scores["brand_alignment"],
                "hook_score": scores["cta_strength"],
                "platform_score": scores["relevance"],
                "passed": passed,
                "critique": "Strong brand alignment with clear CTA and compelling visual narrative." if passed else "Needs improvement.",
                "feedback": "Looks good — all criteria met." if passed else "Needs improvement.",
            })

            emit("tool_result", {
                "tool": "audit_asset",
                "asset_id": asset_id,
                "platform": platform,
                "message": f"{platform} {asset_type.replace('_', ' ')}: {round(weighted_avg, 1)}/10 — {'Passed ✓' if passed else 'Needs work'}",
            })

            if passed:
                assets_approved.append(asset_id)
            else:
                assets_rejected.append(asset_id)

        return {
            "audit_results": audit_results,
            "assets_approved": assets_approved,
            "assets_rejected": assets_rejected,
        }


auditor_agent = _StubAuditor()
