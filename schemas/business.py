from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ── Form onboarding input sections ───────────────────────────────────────────
# Each section mirrors a BKO section but uses flat, user-friendly field names.

class CompanyFormSection(BaseModel):
    name: str
    website: Optional[str] = None
    industry: str
    sub_industry: Optional[str] = None
    business_type: Literal["B2B", "B2C", "B2B2C", "D2C", "marketplace"]
    company_size: Literal["startup", "smb", "mid-market", "enterprise"]
    employee_range: Optional[str] = None
    founded_year: Optional[int] = None
    headquarters: Optional[str] = None
    tagline: Optional[str] = None
    description: str = Field(..., min_length=30, description="Plain-English description, at least one sentence")
    mission: Optional[str] = None
    brand_story: Optional[str] = None


class ProductFormSection(BaseModel):
    name: str
    product_type: Literal[
        "saas_product", "physical", "service", "subscription", "digital", "marketplace"
    ]
    description: str
    key_features: list[str] = Field(..., min_length=1, max_length=8)
    key_benefits: list[str] = Field(..., min_length=1, max_length=8)
    unique_selling_points: list[str] = Field(..., min_length=1, max_length=5)
    pricing_model: Literal[
        "one_time", "subscription", "freemium", "pay_per_use", "enterprise", "free"
    ]
    pricing_tier: Literal["free", "low", "mid", "premium", "enterprise"]
    pricing_details: Optional[str] = None
    target_use_case: Optional[str] = None
    primary_cta: str = Field(..., description="e.g. 'Start free trial' or 'Book a demo'")
    conversion_url: Optional[str] = None
    free_trial_available: bool = False
    demo_available: bool = False


class AudienceFormSection(BaseModel):
    age_range: Optional[str] = None
    occupation: list[str] = Field(default_factory=list)
    company_size_target: Optional[str] = None
    industry_vertical: Optional[str] = None
    seniority: Optional[str] = None
    geography: str
    language: str = "English"
    values: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    personality_traits: list[str] = Field(default_factory=list)
    lifestyle: Optional[str] = None
    online_platforms: list[str] = Field(default_factory=list)
    content_consumption: list[str] = Field(default_factory=list)
    purchase_behavior: Optional[str] = None
    device_usage: Optional[str] = None
    buying_trigger: Optional[str] = None
    pain_points: list[str] = Field(..., min_length=1, max_length=6)
    desired_outcomes: list[str] = Field(..., min_length=1, max_length=6)
    objections: list[str] = Field(default_factory=list, max_length=5)
    emotional_state: Optional[str] = None
    audience_awareness_level: Literal[
        "unaware", "problem_aware", "solution_aware", "product_aware", "most_aware"
    ] = "problem_aware"
    persona_name: Optional[str] = None


class BrandFormSection(BaseModel):
    personality_traits: list[str] = Field(..., min_length=1, max_length=6)
    primary_tone: Literal[
        "professional", "casual", "playful", "authoritative",
        "empathetic", "bold", "inspirational", "professional_casual"
    ]
    writing_style: Literal["conversational", "formal", "technical", "punchy"]
    pov: Literal["first_person", "second_person", "third_person"] = "second_person"
    language_complexity: Literal["simple", "moderate", "technical"] = "moderate"
    humor_level: Literal["none", "light", "moderate", "heavy"] = "none"
    voice_examples: list[str] = Field(default_factory=list, max_length=5,
                                      description="Real sample sentences that capture your brand voice")
    dos: list[str] = Field(default_factory=list, max_length=8)
    donts: list[str] = Field(default_factory=list, max_length=8)
    primary_colors: list[str] = Field(default_factory=list, description="Hex codes e.g. #1A1A2E")
    secondary_colors: list[str] = Field(default_factory=list)
    font_style: Optional[Literal[
        "modern_sans", "serif", "bold", "minimal", "script", "monospace"
    ]] = None
    imagery_style: Optional[str] = None
    design_aesthetic: Optional[Literal[
        "clean_minimal", "bold_vibrant", "luxury", "playful",
        "corporate", "dark_tech", "warm_earthy"
    ]] = None
    visual_do: Optional[str] = None
    visual_dont: Optional[str] = None


class CompetitorFormEntry(BaseModel):
    name: str
    strengths: list[str] = Field(default_factory=list, max_length=4)
    weaknesses: list[str] = Field(default_factory=list, max_length=4)
    pricing_vs_us: Optional[Literal["cheaper", "similar", "pricier"]] = None
    our_differentiator: str = Field(..., description="One sentence: why we win against this competitor")


class CompetitiveFormSection(BaseModel):
    market_position: Literal["leader", "challenger", "niche", "emerging"] = "challenger"
    positioning_statement: str
    primary_differentiators: list[str] = Field(..., min_length=1, max_length=5)
    competitors: list[CompetitorFormEntry] = Field(default_factory=list, max_length=5)
    competitive_advantages_summary: Optional[str] = None


class TestimonialFormEntry(BaseModel):
    quote: str
    author: str
    title: Optional[str] = None
    company: Optional[str] = None
    use_in_ads: bool = True


class SocialProofFormSection(BaseModel):
    key_stats: list[str] = Field(default_factory=list, max_length=6,
                                  description="e.g. '10,000+ customers', '4.8★ on G2'")
    testimonials: list[TestimonialFormEntry] = Field(default_factory=list, max_length=5)
    guarantees: list[str] = Field(default_factory=list)
    awards: list[str] = Field(default_factory=list)
    notable_clients: list[str] = Field(default_factory=list)


class MarketingFormSection(BaseModel):
    active_platforms: list[str] = Field(default_factory=list)
    target_platforms_for_campaigns: list[str] = Field(default_factory=list)
    preferred_cta_styles: list[str] = Field(default_factory=list)
    ad_style_preference: Optional[Literal[
        "lifestyle", "product_demo", "testimonial", "minimalist",
        "bold_graphic", "ugc_style", "animated", "comparison"
    ]] = None
    primary_conversion_goal: Literal[
        "purchase", "free_trial", "demo_booking", "lead_form",
        "app_install", "newsletter", "call"
    ] = "free_trial"
    budget_tier: Literal["small", "medium", "large"] = "medium"
    average_sales_cycle: Optional[str] = None
    best_performing_content_types: list[str] = Field(default_factory=list)
    emotional_hooks: list[str] = Field(default_factory=list,
                                        description="e.g. Relief, FOMO, Confidence, Aspiration")
    value_propositions: list[str] = Field(default_factory=list)


class ComplianceFormSection(BaseModel):
    industry_regulations: list[str] = Field(default_factory=list)
    restricted_claims: list[str] = Field(default_factory=list)
    required_disclaimers: list[str] = Field(default_factory=list)
    forbidden_topics: list[str] = Field(default_factory=list)
    certifications_to_mention: list[str] = Field(default_factory=list)


# ── Top-level request ─────────────────────────────────────────────────────────

class CreateBusinessRequest(BaseModel):
    onboarding_path: Literal["form"] = "form"   # only form implemented for now
    company: CompanyFormSection
    product: ProductFormSection
    audience: AudienceFormSection
    brand: BrandFormSection
    competitive: CompetitiveFormSection
    social_proof: SocialProofFormSection
    marketing: MarketingFormSection
    compliance: ComplianceFormSection = Field(default_factory=ComplianceFormSection)


class UpdateBusinessRequest(BaseModel):
    """Re-submit form data to regenerate the BKO at a higher version."""
    company: Optional[CompanyFormSection] = None
    product: Optional[ProductFormSection] = None
    audience: Optional[AudienceFormSection] = None
    brand: Optional[BrandFormSection] = None
    competitive: Optional[CompetitiveFormSection] = None
    social_proof: Optional[SocialProofFormSection] = None
    marketing: Optional[MarketingFormSection] = None
    compliance: Optional[ComplianceFormSection] = None


# ── Responses ─────────────────────────────────────────────────────────────────

class BusinessResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    website: Optional[str]
    industry: Optional[str]
    onboarding_path: str
    onboarding_status: str
    bko: Optional[dict]
    bko_version: int
    created_at: datetime
    updated_at: datetime


class BusinessListResponse(BaseModel):
    businesses: list[BusinessResponse]
    total: int
