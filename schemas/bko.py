"""
BKO — Business Knowledge Object
The single source of truth consumed by all four agents.
Every field is optional so partial BKOs are valid; completeness_score tracks fill level.
"""
from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field


# ── Section 1: Identity ───────────────────────────────────────────────────────

class BKOIdentity(BaseModel):
    company_name: str
    legal_name: Optional[str] = None
    founded_year: Optional[int] = None
    headquarters: Optional[str] = None
    website: Optional[str] = None
    business_type: Literal["B2B", "B2C", "B2B2C", "D2C", "marketplace"]
    company_size: Literal["startup", "smb", "mid-market", "enterprise"]
    employee_range: Optional[str] = None
    industry: str
    sub_industry: Optional[str] = None
    description: str
    mission: Optional[str] = None
    tagline: Optional[str] = None
    brand_story: Optional[str] = None


# ── Section 2: Offerings ──────────────────────────────────────────────────────

class Product(BaseModel):
    name: str
    type: Literal[
        "saas_product", "physical", "service", "subscription", "digital", "marketplace"
    ]
    is_hero: bool = False
    description: str
    key_features: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    pricing_model: Literal[
        "one_time", "subscription", "freemium", "pay_per_use", "enterprise", "free"
    ]
    pricing_tier: Literal["free", "low", "mid", "premium", "enterprise"]
    pricing_details: Optional[str] = None
    unique_selling_points: list[str] = Field(default_factory=list)
    target_use_case: Optional[str] = None


class BKOOfferings(BaseModel):
    products_services: list[Product] = Field(default_factory=list)
    hero_product: Optional[str] = None
    free_trial_available: bool = False
    demo_available: bool = False
    primary_cta: str
    conversion_url: Optional[str] = None


# ── Section 3: Audience ───────────────────────────────────────────────────────

class Demographics(BaseModel):
    age_range: Optional[str] = None
    gender: Optional[str] = None
    income_level: Optional[Literal["low", "mid", "high", "ultra-high"]] = None
    education: Optional[str] = None
    occupation: list[str] = Field(default_factory=list)
    company_size: Optional[str] = None
    industry_vertical: Optional[str] = None
    seniority: Optional[str] = None
    geography: Optional[str] = None
    language: str = "English"


class Psychographics(BaseModel):
    values: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    personality: list[str] = Field(default_factory=list)
    lifestyle: Optional[str] = None


class Behavioral(BaseModel):
    online_platforms: list[str] = Field(default_factory=list)
    content_consumption: list[str] = Field(default_factory=list)
    purchase_behavior: Optional[str] = None
    device_usage: Optional[str] = None
    buying_trigger: Optional[str] = None


class AudienceSegment(BaseModel):
    persona_name: Optional[str] = None
    demographics: Demographics
    psychographics: Psychographics = Field(default_factory=Psychographics)
    behavioral: Behavioral = Field(default_factory=Behavioral)
    pain_points: list[str] = Field(default_factory=list)
    desired_outcomes: list[str] = Field(default_factory=list)
    objections: list[str] = Field(default_factory=list)
    emotional_state: Optional[str] = None


class BKOAudience(BaseModel):
    primary: AudienceSegment
    secondary: Optional[AudienceSegment] = None
    audience_awareness_level: Literal[
        "unaware", "problem_aware", "solution_aware", "product_aware", "most_aware"
    ] = "problem_aware"


# ── Section 4: Brand ──────────────────────────────────────────────────────────

class BrandVoice(BaseModel):
    primary_tone: Literal[
        "professional", "casual", "playful", "authoritative",
        "empathetic", "bold", "inspirational", "professional_casual"
    ]
    writing_style: Literal["conversational", "formal", "technical", "punchy"]
    pov: Literal["first_person", "second_person", "third_person"] = "second_person"
    language_complexity: Literal["simple", "moderate", "technical"] = "moderate"
    sentence_style: Optional[str] = None
    humor_level: Literal["none", "light", "moderate", "heavy"] = "none"
    examples: list[str] = Field(default_factory=list)


class VisualIdentity(BaseModel):
    primary_colors: list[str] = Field(default_factory=list)
    secondary_colors: list[str] = Field(default_factory=list)
    font_style: Optional[Literal[
        "modern_sans", "serif", "bold", "minimal", "script", "monospace"
    ]] = None
    imagery_style: Optional[str] = None
    design_aesthetic: Optional[Literal[
        "clean_minimal", "bold_vibrant", "luxury", "playful",
        "corporate", "dark_tech", "warm_earthy"
    ]] = None
    logo_style: Optional[str] = None
    visual_do: Optional[str] = None
    visual_dont: Optional[str] = None


class BKOBrand(BaseModel):
    personality_traits: list[str] = Field(default_factory=list)
    voice: BrandVoice
    visual_identity: VisualIdentity = Field(default_factory=VisualIdentity)
    dos: list[str] = Field(default_factory=list)
    donts: list[str] = Field(default_factory=list)


# ── Section 5: Competitive Position ──────────────────────────────────────────

class Competitor(BaseModel):
    name: str
    type: Literal["direct", "indirect", "aspirational"] = "direct"
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    pricing_vs_us: Optional[Literal["cheaper", "similar", "pricier"]] = None
    positioning: Optional[str] = None
    our_counter: Optional[str] = None


class BKOCompetitivePosition(BaseModel):
    market_position: Literal["leader", "challenger", "niche", "emerging"] = "challenger"
    positioning_statement: Optional[str] = None
    primary_differentiators: list[str] = Field(default_factory=list)
    competitors: list[Competitor] = Field(default_factory=list)
    competitive_advantages_summary: Optional[str] = None


# ── Section 6: Marketing Context ─────────────────────────────────────────────

class FunnelStrategy(BaseModel):
    tofu: Optional[str] = None
    mofu: Optional[str] = None
    bofu: Optional[str] = None


class SeasonalPeak(BaseModel):
    period: str
    reason: str


class BKOMarketingContext(BaseModel):
    active_platforms: list[str] = Field(default_factory=list)
    target_platforms_for_campaigns: list[str] = Field(default_factory=list)
    best_performing_content_types: list[str] = Field(default_factory=list)
    ad_style_preference: Optional[Literal[
        "lifestyle", "product_demo", "testimonial", "minimalist",
        "bold_graphic", "ugc_style", "animated", "comparison"
    ]] = None
    preferred_cta_styles: list[str] = Field(default_factory=list)
    past_campaign_themes: list[str] = Field(default_factory=list)
    funnel_strategy: FunnelStrategy = Field(default_factory=FunnelStrategy)
    seasonal_peaks: list[SeasonalPeak] = Field(default_factory=list)
    budget_tier: Literal["small", "medium", "large"] = "medium"
    average_sales_cycle: Optional[str] = None
    primary_conversion_goal: Literal[
        "purchase", "free_trial", "demo_booking", "lead_form",
        "app_install", "newsletter", "call"
    ] = "free_trial"


# ── Section 7: Social Proof ───────────────────────────────────────────────────

class ReviewPlatform(BaseModel):
    platform: str
    rating: float
    review_count: int


class Testimonial(BaseModel):
    quote: str
    author: str
    title: Optional[str] = None
    company: Optional[str] = None
    use_in_ads: bool = True


class BKOSocialProof(BaseModel):
    key_stats: list[str] = Field(default_factory=list)
    review_platforms: list[ReviewPlatform] = Field(default_factory=list)
    testimonials: list[Testimonial] = Field(default_factory=list)
    notable_clients: list[str] = Field(default_factory=list)
    awards: list[str] = Field(default_factory=list)
    press_mentions: list[dict] = Field(default_factory=list)
    guarantees: list[str] = Field(default_factory=list)


# ── Section 8: Messaging ──────────────────────────────────────────────────────

class KeyMessagesByFunnel(BaseModel):
    awareness: Optional[str] = None
    consideration: Optional[str] = None
    conversion: Optional[str] = None


class BKOMessaging(BaseModel):
    primary_value_propositions: list[str] = Field(default_factory=list)
    emotional_hooks: list[str] = Field(default_factory=list)
    proof_points: list[str] = Field(default_factory=list)
    headline_formulas: list[str] = Field(default_factory=list)
    key_messages_by_funnel: KeyMessagesByFunnel = Field(default_factory=KeyMessagesByFunnel)
    forbidden_topics: list[str] = Field(default_factory=list)
    required_disclaimers: list[str] = Field(default_factory=list)
    localization: dict = Field(
        default_factory=lambda: {"primary_language": "en-US", "regional_variants": []}
    )


# ── Section 9: Compliance ─────────────────────────────────────────────────────

class BKOCompliance(BaseModel):
    industry_regulations: list[str] = Field(default_factory=list)
    restricted_claims: list[str] = Field(default_factory=list)
    required_ad_disclosures: list[str] = Field(default_factory=list)
    content_policy_flags: list[str] = Field(default_factory=list)
    certifications_to_mention: list[str] = Field(default_factory=list)


# ── Section 10: BKO Meta ──────────────────────────────────────────────────────

class BKOMeta(BaseModel):
    version: int = 1
    onboarding_path: Literal["url", "free_text", "form"]
    completeness_score: float = 0.0
    missing_fields: list[str] = Field(default_factory=list)
    generated_by: str = "form"


# ── Root ──────────────────────────────────────────────────────────────────────

class BKO(BaseModel):
    identity: BKOIdentity
    offerings: BKOOfferings
    audience: BKOAudience
    brand: BKOBrand
    competitive_position: BKOCompetitivePosition
    marketing_context: BKOMarketingContext
    social_proof: BKOSocialProof
    messaging: BKOMessaging
    compliance: BKOCompliance
    meta: BKOMeta
