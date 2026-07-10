from __future__ import annotations

from pydantic import BaseModel, Field


class CompetitorHook(BaseModel):
    hook_text: str = Field(description="Actual ad copy or hook text used")
    format: str = Field(description="Ad format (reel, carousel, static, story, video)")
    platform: str = Field(description="Platform where this was seen")


class CompetitorPattern(BaseModel):
    competitor_name: str = Field(description="Name of the competitor")
    ad_formats: list[str] = Field(description="Ad formats they use")
    hooks_used: list[CompetitorHook] = Field(
        default_factory=list,
        description="Specific hooks with format and platform context",
    )
    positioning: str = Field(description="How they position themselves")
    strengths: list[str] = Field(default_factory=list, description="What they do well")
    weaknesses_to_exploit: list[str] = Field(
        default_factory=list,
        description="Gaps we can capitalize on",
    )


class PlatformAdSpec(BaseModel):
    format: str = Field(description="Ad format name (reel, carousel, static, story)")
    aspect_ratio: str = Field(description="Aspect ratio (9:16, 1:1, 4:5, 16:9)")
    max_duration: int | None = Field(default=None, description="Max duration in seconds for video")
    character_limit: int | None = Field(default=None, description="Caption/text character limit")
    notes: str | None = Field(default=None, description="Platform-specific notes or restrictions")


class PlatformInsight(BaseModel):
    platform: str = Field(description="Platform name")
    ad_specs: list[PlatformAdSpec] = Field(
        default_factory=list,
        description="Technical specs for each ad format on this platform",
    )
    trending_formats: list[str] = Field(description="Currently trending content formats")
    optimal_posting_times: str = Field(description="Best times to post for engagement")
    benchmark_ctr: float | None = Field(default=None, description="Industry benchmark CTR")
    benchmark_engagement_rate: float | None = Field(default=None, description="Industry benchmark engagement rate")
    content_themes: list[str] = Field(description="Themes performing well on this platform")
    dos: list[str] = Field(default_factory=list, description="Platform-specific best practices")
    donts: list[str] = Field(default_factory=list, description="Things to avoid on this platform")


class RecommendedAngle(BaseModel):
    angle_name: str = Field(description="Short name for the angle")
    rationale: str = Field(description="Why this angle works — link to competitor gaps, trends, or audience needs")
    target_emotion: str = Field(description="Primary emotion to evoke (nostalgia, pride, urgency, trust, etc.)")
    best_platforms: list[str] = Field(description="Platforms where this angle fits best")
    suggested_formats: list[str] = Field(description="Content formats that suit this angle")
    funnel_fit: str = Field(description="Which funnel stage this angle serves (tofu, mofu, bofu)")
    hook_direction: str = Field(description="A specific direction for the opening hook")


class StaticImageInsights(BaseModel):
    best_practices: list[str] = Field(default_factory=list, description="What works for static ads in this industry")
    visual_patterns: list[str] = Field(default_factory=list, description="Composition, color, text overlay trends")
    cta_patterns: list[str] = Field(default_factory=list, description="Effective CTA text and placement")


class VideoAdInsights(BaseModel):
    best_practices: list[str] = Field(default_factory=list, description="What works for video ads")
    hook_timing: str = Field(default="1-3 seconds", description="How many seconds for the hook")
    script_structure: str = Field(default="", description="Hook > story > CTA timing breakdown")
    sound_trends: list[str] = Field(default_factory=list, description="Music, voiceover, ASMR, silent with captions")


class EmailTemplateInsights(BaseModel):
    subject_line_patterns: list[str] = Field(default_factory=list, description="High-performing subject line formats")
    layout_best_practices: list[str] = Field(default_factory=list, description="Layout, hero image, CTA placement")
    optimal_send_times: str = Field(default="", description="Best send times for this audience")
    benchmark_open_rate: float | None = Field(default=None, description="Industry benchmark open rate")
    benchmark_click_rate: float | None = Field(default=None, description="Industry benchmark click rate")


class AssetTypeInsights(BaseModel):
    static_image: StaticImageInsights = Field(default_factory=StaticImageInsights)
    video_ad: VideoAdInsights = Field(default_factory=VideoAdInsights)
    email_template: EmailTemplateInsights = Field(default_factory=EmailTemplateInsights)


class AudienceIntelligence(BaseModel):
    current_behavior_trends: list[str] = Field(
        default_factory=list,
        description="How the target audience currently behaves online",
    )
    purchase_triggers: list[str] = Field(
        default_factory=list,
        description="What makes this audience buy — urgency drivers, social proof, etc.",
    )
    common_objections: list[str] = Field(
        default_factory=list,
        description="Reasons they hesitate — price, trust, alternatives",
    )
    content_preferences: list[str] = Field(
        default_factory=list,
        description="What type of content they engage with most",
    )


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
        description="Platform-specific trends, specs, benchmarks, and content insights",
    )
    audience_intelligence: AudienceIntelligence = Field(
        default_factory=AudienceIntelligence,
        description="Current audience behavior, triggers, objections, and preferences",
    )
    asset_type_insights: AssetTypeInsights = Field(
        default_factory=AssetTypeInsights,
        description="Best practices and benchmarks for each asset type (static, video, email)",
    )
    seasonal_context: list[str] = Field(
        default_factory=list,
        description="Upcoming events, holidays, or cultural moments relevant to the campaign",
    )
    recommended_angles: list[RecommendedAngle] = Field(
        default_factory=list,
        description="3-5 structured campaign angles with rationale and format suggestions",
    )
    tone_recommendations: list[str] = Field(
        default_factory=list,
        description="Recommended tones based on audience psychology and platform norms",
    )
    sources: list[str] = Field(
        default_factory=list,
        description="URLs or source names consulted during research",
    )
