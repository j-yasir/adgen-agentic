from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class StaticImageGenPlan(BaseModel):
    """Phase 1 output — the static-image skill's finished creative + generation
    decision. `final_prompt` is production-ready for nano-banana; it supersedes
    (never quotes verbatim) the Strategist's `image_prompt` draft direction."""

    final_prompt: str = Field(description="Complete narrative generation prompt — single continuous string")
    use_avatar: bool = Field(description="Whether a person/avatar appears in the composition")
    avatar_description: str | None = Field(
        default=None, description="Short persona description if use_avatar is true, else null"
    )
    use_logo: bool = Field(description="Whether the resolved logo image should be fed as a reference input")
    use_product_image: bool = Field(description="Whether the resolved product image should be fed as a reference input")
    reasoning: str = Field(description="Short rationale for the above choices — audit/debug trail")


class GeneratedAsset(BaseModel):
    """One Producer output record — the shape orchestrator/nodes.py persists via
    campaign_repo.create_asset(). asset_type here is the DB-legal value
    (image|video|voice|email), not the StrategyDoc's asset_type discriminator
    (static_image|video_ad|email)."""

    asset_id: str
    asset_type: Literal["image", "video", "voice", "email"]
    platform: str
    format: str
    storage_url: str | None = None
    prompt_used: str | None = None
    status: Literal["stored", "failed"]
    error: str | None = None
    metadata: dict = Field(default_factory=dict)


class EmailTemplateDecision(BaseModel):
    """Email skill Step 2 output — a layout/style decision, never touches copy.

    template_name selects from a small fixed library of hand-built HTML files
    (agents/producer/templates/) — bounded creative space, not free-form
    LLM-authored markup, for the same reliability reason the static-image
    skill only chooses among resolved reference images rather than inventing
    file paths.
    """

    template_name: Literal["hero_banner", "minimal_text_forward", "story_long_form", "product_split"]
    hero_treatment: Literal["full_width_banner", "inset_padded"]
    button_style: Literal["solid_rounded", "solid_square", "outline"]
    accent_usage: str = Field(description="Short narrative note on applying brand color within the template's fixed slots")
    reasoning: str = Field(description="Short rationale for the above choices — audit/debug trail")
