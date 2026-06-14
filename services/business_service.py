from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from repos import business_repo
from schemas.business import (
    AudienceFormSection,
    BrandFormSection,
    BusinessListResponse,
    BusinessResponse,
    CompanyFormSection,
    CompetitiveFormSection,
    CompetitorFormEntry,
    ComplianceFormSection,
    CreateBusinessRequest,
    MarketingFormSection,
    ProductFormSection,
    SocialProofFormSection,
    TestimonialFormEntry,
    UpdateBusinessRequest,
)
from services import bko_service
from utils.exceptions import NotFoundError
from utils.logger import get_logger

logger = get_logger(__name__)


def create(
    db: Session,
    data: CreateBusinessRequest,
    user_id: uuid.UUID,
) -> BusinessResponse:
    logger.info("Creating business for user_id=%s name='%s'", user_id, data.company.name)

    bko = bko_service.build_from_form(data)

    row = business_repo.create(
        db,
        user_id=user_id,
        name=data.company.name,
        website=data.company.website,
        industry=data.company.industry,
        bko=bko.model_dump(),
        onboarding_path=data.onboarding_path,
        onboarding_status="complete",
    )

    logger.info(
        "Business created id=%s user_id=%s completeness=%.0f%%",
        row["id"], user_id, bko.meta.completeness_score * 100,
    )
    return BusinessResponse(**row)


def get_one(
    db: Session,
    business_id: uuid.UUID,
    user_id: uuid.UUID,
) -> BusinessResponse:
    logger.debug("Fetching business id=%s user_id=%s", business_id, user_id)
    row = business_repo.get_by_id(db, business_id, user_id)
    if not row:
        logger.warning("Business not found: id=%s user_id=%s", business_id, user_id)
        raise NotFoundError(f"Business {business_id} not found")
    return BusinessResponse(**row)


def get_all(db: Session, user_id: uuid.UUID) -> BusinessListResponse:
    logger.debug("Listing businesses for user_id=%s", user_id)
    rows = business_repo.get_all_for_user(db, user_id)
    logger.info("Found %d businesses for user_id=%s", len(rows), user_id)
    return BusinessListResponse(
        businesses=[BusinessResponse(**r) for r in rows],
        total=len(rows),
    )


def update(
    db: Session,
    business_id: uuid.UUID,
    user_id: uuid.UUID,
    data: UpdateBusinessRequest,
) -> BusinessResponse:
    logger.info("Updating business id=%s user_id=%s", business_id, user_id)

    existing = business_repo.get_by_id(db, business_id, user_id)
    if not existing:
        logger.warning("Update failed — not found: id=%s user_id=%s", business_id, user_id)
        raise NotFoundError(f"Business {business_id} not found")

    rebuilt = _merge_update(existing, existing.get("bko") or {}, data)
    new_bko = bko_service.build_from_form(rebuilt)
    new_bko.meta.version = existing["bko_version"] + 1

    row = business_repo.update_bko(
        db,
        business_id=business_id,
        user_id=user_id,
        bko=new_bko.model_dump(),
        onboarding_status="complete",
    )
    if not row:
        raise NotFoundError(f"Business {business_id} not found")

    logger.info(
        "Business updated id=%s new_version=%d completeness=%.0f%%",
        business_id, new_bko.meta.version, new_bko.meta.completeness_score * 100,
    )
    return BusinessResponse(**row)


def delete(db: Session, business_id: uuid.UUID, user_id: uuid.UUID) -> None:
    logger.info("Deleting business id=%s user_id=%s", business_id, user_id)
    deleted = business_repo.delete(db, business_id, user_id)
    if not deleted:
        logger.warning("Delete failed — not found: id=%s user_id=%s", business_id, user_id)
        raise NotFoundError(f"Business {business_id} not found")
    logger.info("Business deleted id=%s", business_id)


# ── Merge helper for PATCH ────────────────────────────────────────────────────

def _merge_update(
    existing: dict,
    existing_bko: dict,
    data: UpdateBusinessRequest,
) -> CreateBusinessRequest:
    """Merge PATCH sections over stored BKO to produce a full CreateBusinessRequest."""

    def _s(key: str) -> dict:
        return existing_bko.get(key) or {}

    identity   = _s("identity")
    offerings  = _s("offerings")
    aud        = _s("audience")
    brand_data = _s("brand")
    comp_data  = _s("competitive_position")
    mkt_data   = _s("marketing_context")
    sp_data    = _s("social_proof")
    cpl_data   = _s("compliance")

    hero = (offerings.get("products_services") or [{}])[0]
    voice_data  = brand_data.get("voice") or {}
    visual_data = brand_data.get("visual_identity") or {}
    primary_aud = (aud.get("primary") or {})
    demo  = primary_aud.get("demographics") or {}
    psych = primary_aud.get("psychographics") or {}
    behav = primary_aud.get("behavioral") or {}

    company = data.company or CompanyFormSection(
        name=existing["name"],
        website=existing.get("website"),
        industry=existing.get("industry", ""),
        business_type=identity.get("business_type", "B2C"),
        company_size=identity.get("company_size", "startup"),
        description=identity.get("description", ""),
        tagline=identity.get("tagline"),
        mission=identity.get("mission"),
        brand_story=identity.get("brand_story"),
        founded_year=identity.get("founded_year"),
        headquarters=identity.get("headquarters"),
        employee_range=identity.get("employee_range"),
        sub_industry=identity.get("sub_industry"),
    )

    product = data.product or ProductFormSection(
        name=hero.get("name", ""),
        product_type=hero.get("type", "service"),
        description=hero.get("description", ""),
        key_features=hero.get("key_features", []),
        key_benefits=hero.get("benefits", []),
        unique_selling_points=hero.get("unique_selling_points", []),
        pricing_model=hero.get("pricing_model", "subscription"),
        pricing_tier=hero.get("pricing_tier", "mid"),
        pricing_details=hero.get("pricing_details"),
        primary_cta=offerings.get("primary_cta", "Learn more"),
        conversion_url=offerings.get("conversion_url"),
        free_trial_available=offerings.get("free_trial_available", False),
        demo_available=offerings.get("demo_available", False),
    )

    audience = data.audience or AudienceFormSection(
        age_range=demo.get("age_range"),
        occupation=demo.get("occupation", []),
        company_size_target=demo.get("company_size"),
        industry_vertical=demo.get("industry_vertical"),
        seniority=demo.get("seniority"),
        geography=demo.get("geography", ""),
        language=demo.get("language", "English"),
        values=psych.get("values", []),
        interests=psych.get("interests", []),
        personality_traits=psych.get("personality", []),
        lifestyle=psych.get("lifestyle"),
        online_platforms=behav.get("online_platforms", []),
        content_consumption=behav.get("content_consumption", []),
        purchase_behavior=behav.get("purchase_behavior"),
        device_usage=behav.get("device_usage"),
        buying_trigger=behav.get("buying_trigger"),
        pain_points=primary_aud.get("pain_points", []),
        desired_outcomes=primary_aud.get("desired_outcomes", []),
        objections=primary_aud.get("objections", []),
        emotional_state=primary_aud.get("emotional_state"),
        audience_awareness_level=aud.get("audience_awareness_level", "problem_aware"),
        persona_name=primary_aud.get("persona_name"),
    )

    brand = data.brand or BrandFormSection(
        personality_traits=brand_data.get("personality_traits", []),
        primary_tone=voice_data.get("primary_tone", "professional"),
        writing_style=voice_data.get("writing_style", "conversational"),
        pov=voice_data.get("pov", "second_person"),
        language_complexity=voice_data.get("language_complexity", "moderate"),
        humor_level=voice_data.get("humor_level", "none"),
        voice_examples=voice_data.get("examples", []),
        dos=brand_data.get("dos", []),
        donts=brand_data.get("donts", []),
        primary_colors=visual_data.get("primary_colors", []),
        secondary_colors=visual_data.get("secondary_colors", []),
        font_style=visual_data.get("font_style"),
        imagery_style=visual_data.get("imagery_style"),
        design_aesthetic=visual_data.get("design_aesthetic"),
        visual_do=visual_data.get("visual_do"),
        visual_dont=visual_data.get("visual_dont"),
    )

    comp_entries = [
        CompetitorFormEntry(
            name=c.get("name", ""),
            strengths=c.get("strengths", []),
            weaknesses=c.get("weaknesses", []),
            pricing_vs_us=c.get("pricing_vs_us"),
            our_differentiator=c.get("our_counter", ""),
        )
        for c in (comp_data.get("competitors") or [])
    ]
    competitive = data.competitive or CompetitiveFormSection(
        market_position=comp_data.get("market_position", "challenger"),
        positioning_statement=comp_data.get("positioning_statement", ""),
        primary_differentiators=comp_data.get("primary_differentiators", []),
        competitors=comp_entries,
        competitive_advantages_summary=comp_data.get("competitive_advantages_summary"),
    )

    testimonial_entries = [
        TestimonialFormEntry(
            quote=t.get("quote", ""),
            author=t.get("author", ""),
            title=t.get("title"),
            company=t.get("company"),
            use_in_ads=t.get("use_in_ads", True),
        )
        for t in (sp_data.get("testimonials") or [])
    ]
    social_proof = data.social_proof or SocialProofFormSection(
        key_stats=sp_data.get("key_stats", []),
        testimonials=testimonial_entries,
        guarantees=sp_data.get("guarantees", []),
        awards=sp_data.get("awards", []),
        notable_clients=sp_data.get("notable_clients", []),
    )

    marketing = data.marketing or MarketingFormSection(
        active_platforms=mkt_data.get("active_platforms", []),
        target_platforms_for_campaigns=mkt_data.get("target_platforms_for_campaigns", []),
        preferred_cta_styles=mkt_data.get("preferred_cta_styles", []),
        ad_style_preference=mkt_data.get("ad_style_preference"),
        primary_conversion_goal=mkt_data.get("primary_conversion_goal", "free_trial"),
        budget_tier=mkt_data.get("budget_tier", "medium"),
        average_sales_cycle=mkt_data.get("average_sales_cycle"),
        best_performing_content_types=mkt_data.get("best_performing_content_types", []),
        emotional_hooks=[],
        value_propositions=[],
    )

    compliance = data.compliance or ComplianceFormSection(
        industry_regulations=cpl_data.get("industry_regulations", []),
        restricted_claims=cpl_data.get("restricted_claims", []),
        required_disclaimers=cpl_data.get("required_ad_disclosures", []),
        forbidden_topics=cpl_data.get("content_policy_flags", []),
        certifications_to_mention=cpl_data.get("certifications_to_mention", []),
    )

    return CreateBusinessRequest(
        onboarding_path="form",
        company=company,
        product=product,
        audience=audience,
        brand=brand,
        competitive=competitive,
        social_proof=social_proof,
        marketing=marketing,
        compliance=compliance,
    )
