from __future__ import annotations

from typing import Any


class _StubResearcher:
    """Stub Researcher — returns a hardcoded ResearchReport without calling any LLM."""

    async def ainvoke(self, input: dict[str, Any], **_kwargs) -> dict[str, Any]:
        return {
            "research_report": {
                "competitor_analysis": {
                    "top_competitors": ["CompetitorA", "CompetitorB"],
                    "key_differentiators": ["lower price", "faster delivery"],
                },
                "target_audience": {
                    "demographics": {"age": "25-45", "gender": "all"},
                    "psychographics": ["value-driven", "digitally savvy"],
                    "pain_points": ["lack of trust", "slow service"],
                },
                "market_insights": {
                    "trending_content_formats": ["short-form video", "carousel"],
                    "peak_engagement_times": {"instagram": "18:00-21:00"},
                    "benchmark_ctr": 0.027,
                },
                "tone_recommendations": ["conversational", "aspirational"],
                "past_campaign_learnings": [],
            }
        }


researcher_agent = _StubResearcher()
