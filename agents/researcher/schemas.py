from __future__ import annotations

from pydantic import BaseModel, Field


class CompetitorPattern(BaseModel):
    competitor_name: str = Field(description="Name of the competitor")
    ad_formats: list[str] = Field(description="Ad formats they use (carousel, reels, video, static)")
    hooks_used: list[str] = Field(description="Opening hooks from their recent ads")
    positioning: str = Field(description="How they position themselves in the market")
    weaknesses_to_exploit: list[str] = Field(description="Gaps or weaknesses we can capitalize on")


class PlatformInsight(BaseModel):
    platform: str = Field(description="Platform name (instagram, facebook, tiktok, etc.)")
    trending_formats: list[str] = Field(description="Currently trending content formats")
    optimal_posting_times: str = Field(description="Best times to post for engagement")
    benchmark_ctr: float | None = Field(default=None, description="Industry benchmark CTR if available")
    content_themes: list[str] = Field(description="Themes performing well on this platform")


class ResearchReport(BaseModel):
    """Structured output from the Researcher agent.

    Contains all campaign-specific external intelligence gathered during
    the research phase. This report feeds directly into the Strategist agent.
    """
    competitor_ad_patterns: list[CompetitorPattern] = Field(
        default_factory=list,
        description="Analysis of competitor advertising patterns and strategies",
    )
    platform_insights: list[PlatformInsight] = Field(
        default_factory=list,
        description="Platform-specific trends, benchmarks, and content insights",
    )
    audience_insights: list[str] = Field(
        default_factory=list,
        description="Current behavioral trends and preferences of the target audience",
    )
    seasonal_context: list[str] = Field(
        default_factory=list,
        description="Upcoming events, holidays, or cultural moments relevant to the campaign",
    )
    recommended_angles: list[str] = Field(
        default_factory=list,
        description="3-5 suggested campaign angles with rationale",
    )
    tone_recommendations: list[str] = Field(
        default_factory=list,
        description="Recommended tones based on audience psychology and platform norms",
    )
    sources: list[str] = Field(
        default_factory=list,
        description="URLs or sources consulted during research",
    )
