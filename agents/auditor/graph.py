from __future__ import annotations

from typing import Any

PASS_THRESHOLD = 7.5


class _StubAuditor:
    """Stub Auditor — scores all assets above the pass threshold (8.0 > 7.5)."""

    async def ainvoke(self, input: dict[str, Any], **_kwargs) -> dict[str, Any]:
        assets: list[dict] = input.get("generated_assets", [])

        audit_results = []
        assets_approved: list[str] = []
        assets_rejected: list[str] = []

        for asset in assets:
            asset_id = asset["asset_id"]
            scores = {
                "relevance": 8.0,
                "clarity": 8.5,
                "brand_alignment": 8.0,
                "cta_strength": 7.8,
                "creative_quality": 8.2,
            }
            weighted_avg = sum(scores.values()) / len(scores)
            passed = weighted_avg >= PASS_THRESHOLD

            audit_results.append({
                "asset_id": asset_id,
                "scores": scores,
                "weighted_avg": round(weighted_avg, 2),
                "passed": passed,
                "feedback": "Looks good — all criteria met." if passed else "Needs improvement.",
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
