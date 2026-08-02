from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from repos import business_repo, product_repo
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
    SocialProofFormSection,
    TestimonialFormEntry,
    UpdateBusinessRequest,
)
from services import bko_service
from utils import storage
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

    if data.product is not None:
        p = data.product
        product_repo.create(
            db,
            business_id=row["id"],
            user_id=user_id,
            name=p.name,
            type=p.product_type,
            is_hero=True,
            description=p.description,
            key_features=p.key_features,
            benefits=p.key_benefits,
            pricing_model=p.pricing_model,
            pricing_tier=p.pricing_tier,
            pricing_details=p.pricing_details,
            unique_selling_points=p.unique_selling_points,
            target_use_case=p.target_use_case,
        )
        logger.info("Convenience-created product '%s' for business_id=%s", p.name, row["id"])

    row["bko"] = assemble_products_into_bko(db, row["id"], user_id, row.get("bko") or {})
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
    row["bko"] = assemble_products_into_bko(db, business_id, user_id, row.get("bko") or {})
    return BusinessResponse(**row)


def get_all(db: Session, user_id: uuid.UUID) -> BusinessListResponse:
    logger.debug("Listing businesses for user_id=%s", user_id)
    rows = business_repo.get_all_for_user(db, user_id)
    for r in rows:
        r["bko"] = assemble_products_into_bko(db, r["id"], user_id, r.get("bko") or {})
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
    row["bko"] = assemble_products_into_bko(db, business_id, user_id, row.get("bko") or {})
    return BusinessResponse(**row)


def delete(db: Session, business_id: uuid.UUID, user_id: uuid.UUID) -> None:
    logger.info("Deleting business id=%s user_id=%s", business_id, user_id)
    deleted = business_repo.delete(db, business_id, user_id)
    if not deleted:
        logger.warning("Delete failed — not found: id=%s user_id=%s", business_id, user_id)
        raise NotFoundError(f"Business {business_id} not found")
    storage.delete_business_assets_dir(str(business_id))
    logger.info("Business deleted id=%s", business_id)


# ── Brand asset uploads (logo, product photos) ────────────────────────────────
#
# These mutate the stored BKO dict directly and call business_repo.update_bko()
# — deliberately bypassing build_from_form()/_merge_update(). Routing an asset
# upload through the full form-rebuild pipeline would require reconstructing
# an entire CompanyFormSection/ProductFormSection just to change one URL, and
# risks the rebuild dropping fields the caller's payload doesn't happen to
# mention. A direct, surgical mutation of the one field that changed is both
# simpler and safer.

def _get_business_and_bko(db: Session, business_id: uuid.UUID, user_id: uuid.UUID) -> tuple[dict, dict]:
    existing = business_repo.get_by_id(db, business_id, user_id)
    if not existing:
        raise NotFoundError(f"Business {business_id} not found")
    return existing, (existing.get("bko") or {})


def _save_bko(db: Session, business_id: uuid.UUID, user_id: uuid.UUID,
              existing: dict, bko: dict) -> BusinessResponse:
    row = business_repo.update_bko(
        db, business_id=business_id, user_id=user_id,
        bko=bko, onboarding_status=existing.get("onboarding_status", "complete"),
    )
    if not row:
        raise NotFoundError(f"Business {business_id} not found")
    return BusinessResponse(**row)


def upload_logo(
    db: Session, business_id: uuid.UUID, user_id: uuid.UUID, file_bytes: bytes,
) -> BusinessResponse:
    logger.info("Uploading logo for business_id=%s", business_id)
    existing, bko = _get_business_and_bko(db, business_id, user_id)

    old_logo = (bko.get("identity") or {}).get("logo_url")
    path = storage.save_business_logo(str(business_id), file_bytes)
    if old_logo and old_logo != path:
        storage.delete_business_asset(old_logo)

    bko.setdefault("identity", {})["logo_url"] = path
    logger.info("Logo stored business_id=%s path=%s", business_id, path)
    return _save_bko(db, business_id, user_id, existing, bko)


def delete_logo(db: Session, business_id: uuid.UUID, user_id: uuid.UUID) -> BusinessResponse:
    logger.info("Deleting logo for business_id=%s", business_id)
    existing, bko = _get_business_and_bko(db, business_id, user_id)

    logo_url = (bko.get("identity") or {}).get("logo_url")
    if logo_url:
        storage.delete_business_asset(logo_url)
    bko.setdefault("identity", {})["logo_url"] = None
    return _save_bko(db, business_id, user_id, existing, bko)


# ── Products — assembled into the BKO at read time ────────────────────────────
#
# Products live in real relational tables (see repos/product_repo.py), not in
# the BKO JSONB blob — this bridge keeps every agent-facing consumer of
# bko.offerings.products_services unchanged (they read a list of plain dicts
# with name/description/unique_selling_points/is_hero, exactly what this
# produces) while giving products a stable ID and independent CRUD lifecycle.

def assemble_products_into_bko(
    db: Session, business_id: uuid.UUID | str, user_id: uuid.UUID | str, bko: dict,
) -> dict:
    rows = product_repo.list_with_images_for_business(db, business_id, user_id)
    products: list[dict] = []
    hero_name: str | None = None
    for r in rows:
        products.append({
            "id": str(r["id"]),
            "name": r["name"],
            "type": r["type"],
            "is_hero": r["is_hero"],
            "description": r["description"],
            "key_features": r["key_features"] or [],
            "benefits": r["benefits"] or [],
            "pricing_model": r["pricing_model"],
            "pricing_tier": r["pricing_tier"],
            "pricing_details": r["pricing_details"],
            "unique_selling_points": r["unique_selling_points"] or [],
            "target_use_case": r["target_use_case"],
            "image_urls": [img["storage_url"] for img in (r.get("images") or [])],
        })
        if r["is_hero"] and hero_name is None:
            hero_name = r["name"]

    bko = dict(bko)
    offerings = dict(bko.get("offerings") or {})
    offerings["products_services"] = products
    offerings["hero_product"] = hero_name or offerings.get("hero_product")
    bko["offerings"] = offerings
    bko["meta"] = bko_service.recompute_completeness_meta(bko)
    return bko


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
    aud        = _s("audience")
    brand_data = _s("brand")
    comp_data  = _s("competitive_position")
    mkt_data   = _s("marketing_context")
    sp_data    = _s("social_proof")
    cpl_data   = _s("compliance")

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
        logo_url=identity.get("logo_url"),
    )

    # Products no longer live in the BKO JSONB — nothing to reconstruct a
    # fallback from. `data.product` passes through as-is: None unless this
    # specific PATCH call explicitly included a product section (in which
    # case bko_service.build_from_form treats it as a fresh CTA/offer default,
    # since the real product list is assembled separately at read time).
    product = data.product

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
