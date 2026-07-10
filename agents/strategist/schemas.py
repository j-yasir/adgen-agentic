from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field, TypeAdapter

# ── Shared enums ──────────────────────────────────────────────────────────────

AssetType = Literal["static_image", "video_ad", "email"]
Platform = Literal["instagram", "facebook", "tiktok", "youtube", "google", "linkedin", "email"]
AssetFormat = Literal["9:16", "4:5", "1:1", "16:9", "email"]
FunnelStage = Literal["tofu", "mofu", "bofu"]
CampaignRole = Literal["attention", "consideration", "conversion"]


# ── Stage 1 — Planner output ──────────────────────────────────────────────────

class AssetBrief(BaseModel):
    """Strategy-level brief for ONE asset. No copy — the specialist skills write that."""
    asset_id: str = Field(description="Stable ID for tracking (asset-1, asset-2, ...)")
    asset_type: AssetType
    platform: Platform
    format: AssetFormat = Field(description="Aspect ratio, or 'email' for email assets")
    funnel_stage: FunnelStage = Field(description="Resolved per asset, even when the campaign is 'balanced'")
    role_in_campaign: CampaignRole = Field(description="The job this asset does in the campaign sequence")
    angle: str = Field(description="Campaign angle (from research recommended_angles)")
    hero_product: str = Field(description="Exact product name from the BKO")
    target_emotion: str = Field(description="Primary emotion this asset should evoke")
    hook_direction: str = Field(description="1-2 sentence creative direction a copywriter can execute")
    key_message: str = Field(description="THE one thing this asset must communicate")
    tone: str = Field(description="Resolved tone for this asset")
    compliance_notes: str = Field(default="", description="Disclaimers or restrictions that apply to this asset")


class DistributionPlan(BaseModel):
    """The planner's decision: what to make and why. Copy is produced separately."""
    campaign_theme: str = Field(description="The overarching creative thread")
    target_emotion: str = Field(description="Campaign-level primary emotion")
    narrative_arc: str = Field(description="How the assets connect as one story told in sequence")
    asset_briefs: list[AssetBrief] = Field(description="Exactly num_variants entries")
    key_messages: list[str] = Field(description="3-5 campaign-wide messages")
    what_to_avoid: list[str] = Field(description="From BKO compliance, brand don'ts, and research")


# ── Stage 2 — Specialist skill outputs (copy only) ────────────────────────────

class TextOverlay(BaseModel):
    """Text composited onto the image AFTER generation — never part of image_prompt."""
    text: str
    placement: str = Field(description="e.g. bottom-left, centered upper third")
    style_note: str = Field(default="", description="Font/contrast direction")


class ScriptBeat(BaseModel):
    """One timed beat. Visual, voiceover, and overlay text are separate fields
    because the Producer routes them to different systems."""
    timing: str = Field(description="e.g. 0-2s")
    visual: str = Field(description="What is on screen")
    voiceover: str | None = Field(default=None, description="Spoken line, if any")
    on_screen_text: str = Field(default="", description="Overlay/caption text — must carry meaning on mute")


class StaticCopy(BaseModel):
    hook: str = Field(description="The scroll-stopping idea in one line")
    hook_alternatives: list[str] = Field(default_factory=list)
    headline: str
    body_copy: str = Field(description="Platform caption — first line is a second hook")
    cta: str
    image_prompt: str = Field(description="Pure visual scene for the image model — no text, no logos")
    text_overlay: TextOverlay
    visual_avoid: list[str] = Field(default_factory=list)


class VideoCopy(BaseModel):
    hook: str = Field(description="First-frame concept in one line")
    hook_alternatives: list[str] = Field(default_factory=list)
    headline: str
    caption: str = Field(description="Platform caption incl. first-line hook")
    cta: str
    duration_seconds: int = Field(gt=0, le=120)
    script: list[ScriptBeat] = Field(min_length=3, description="At minimum: hook, story, cta beats")
    sound_direction: str
    visual_style: str
    visual_avoid: list[str] = Field(default_factory=list)


class EmailCopy(BaseModel):
    hook: str = Field(description="The subject-line idea in one line")
    hook_alternatives: list[str] = Field(default_factory=list)
    subject_line: str = Field(max_length=50)
    preview_text: str = Field(max_length=90)
    headline: str
    body_paragraphs: list[str] = Field(min_length=2, description="Short scannable paragraphs, value first")
    cta_text: str
    cta_url: str
    hero_image_brief: str
    layout_notes: str = ""
    disclosures: list[str] = Field(default_factory=list)


# ── Stage 3 — Final per-asset plans (brief + copy merged) ─────────────────────

class AssetStrategy(BaseModel):
    """Shared strategy header carried by every asset plan."""
    asset_id: str
    platform: Platform
    format: AssetFormat
    funnel_stage: FunnelStage
    role_in_campaign: CampaignRole
    angle: str
    hero_product: str
    target_emotion: str
    key_message: str
    copy_tone: str
    hook: str
    hook_alternatives: list[str] = Field(default_factory=list)
    compliance_notes: str = ""


class StaticImagePlan(AssetStrategy):
    asset_type: Literal["static_image"] = "static_image"
    headline: str
    body_copy: str
    cta: str
    image_prompt: str
    text_overlay: TextOverlay
    visual_avoid: list[str] = Field(default_factory=list)


class VideoAdPlan(AssetStrategy):
    asset_type: Literal["video_ad"] = "video_ad"
    headline: str
    caption: str
    cta: str
    duration_seconds: int
    script: list[ScriptBeat]
    sound_direction: str
    visual_style: str
    visual_avoid: list[str] = Field(default_factory=list)


class EmailPlan(AssetStrategy):
    asset_type: Literal["email"] = "email"
    subject_line: str = Field(max_length=50)
    preview_text: str = Field(max_length=90)
    headline: str
    body_paragraphs: list[str]
    cta_text: str
    cta_url: str
    hero_image_brief: str
    layout_notes: str = ""
    disclosures: list[str] = Field(default_factory=list)


AssetPlan = Annotated[
    Union[StaticImagePlan, VideoAdPlan, EmailPlan],
    Field(discriminator="asset_type"),
]

# Validates a raw dict into the correct AssetPlan variant (used on HITL revision
# to rehydrate kept assets from the previously persisted strategy_doc).
AssetPlanAdapter: TypeAdapter[AssetPlan] = TypeAdapter(AssetPlan)


class StrategyDoc(BaseModel):
    """The contract with the Producer.

    asset_type is the sub-agent router: static_image → image sub-agent,
    video_ad → video sub-agent, email → email renderer. Every plan is fully
    specified — no creative decisions remain downstream.
    """
    campaign_theme: str
    target_emotion: str
    narrative_arc: str
    asset_plan: list[AssetPlan]
    key_messages: list[str]
    what_to_avoid: list[str]


# ── HITL revision ─────────────────────────────────────────────────────────────

class RevisionPlan(BaseModel):
    """Targeted revision after human rejection: regenerate only what feedback touches."""
    keep: list[str] = Field(description="asset_ids to keep untouched from the previous strategy")
    regenerate: list[AssetBrief] = Field(
        default_factory=list,
        description="Revised briefs for the assets to regenerate (same asset_ids)",
    )
    campaign_theme: str | None = None
    narrative_arc: str | None = None
    key_messages: list[str] | None = None
    what_to_avoid: list[str] | None = None
