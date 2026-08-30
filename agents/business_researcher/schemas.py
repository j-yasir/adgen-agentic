"""URL-based business onboarding — the intermediate shape between the two
stages (see agents/business_researcher/skills.py for the full pipeline).

BusinessFindings is deliberately loose (freeform notes per topic, not the
strict BKO shape) — Stage 1 (research) is a ReAct loop that gathers whatever
it can find; Stage 2 (structuring) does the strict mapping into
schemas.business.CreateBusinessRequest. Splitting it this way mirrors the
Strategist's own plan (loose) -> specialist (strict schema) division.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class BusinessFindings(BaseModel):
    company_name: str | None = None
    website: str | None = None
    industry_notes: str = Field(default="", description="Industry, sub-industry, business type/size signals")
    identity_notes: str = Field(default="", description="What the company does, founding info, HQ, mission/tagline signals")
    offerings_notes: str = Field(default="", description="Products/services found, with names, pricing, features, USPs")
    audience_notes: str = Field(default="", description="Who the site/messaging/reviews suggest they target")
    brand_voice_notes: str = Field(default="", description="Tone, personality, visual style cues observed")
    competitive_notes: str = Field(default="", description="Named competitors found, market positioning signals")
    social_proof_notes: str = Field(default="", description="Testimonials, stats, awards, press actually found — not invented")
    compliance_notes: str = Field(default="", description="Disclaimers, certifications, regulated-industry signals found")
    marketing_notes: str = Field(default="", description="Active platforms, CTA style, campaign themes observed")
    sources: list[str] = Field(default_factory=list, description="URLs actually consulted")
    gaps: list[str] = Field(default_factory=list, description="Sections where little or nothing was found")


class ProductFindings(BaseModel):
    """Same idea as BusinessFindings, scoped to one product/service instead
    of a whole business — deliberately smaller, since CreateProductRequest
    (schemas/product.py) is a single flat object, not 8 nested sections."""

    product_name: str | None = None
    product_page_url: str | None = Field(
        default=None,
        description="The most specific URL where this product actually lives — "
                     "may be deeper than the input URL if the agent found a dedicated "
                     "product page. This is what the deterministic image-lookup step "
                     "(utils/product_image_finder.py) fetches — it does its own page "
                     "read, not the LLM, since finding an og:image/JSON-LD tag is a "
                     "parsing task, not a research one.",
    )
    description_notes: str = Field(default="", description="What the product/service is, in the site's own words")
    features_notes: str = Field(default="", description="Concrete features/specs actually found")
    benefits_notes: str = Field(default="", description="Customer-facing benefits actually found or reasonably implied")
    pricing_notes: str = Field(default="", description="Price, pricing model/tier signals found — leave blank if not found, never invent a number")
    use_case_notes: str = Field(default="", description="Who/what this product is for, if stated or clearly implied")
    sources: list[str] = Field(default_factory=list, description="URLs actually consulted")
    gaps: list[str] = Field(default_factory=list, description="What little or nothing was found for")
