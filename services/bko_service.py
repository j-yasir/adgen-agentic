"""
BKO Service — builds a Business Knowledge Object from different onboarding paths.
Currently implements: form path (synchronous, no external calls).
Future: url path (Firecrawl + Gemini), free_text path (Gemini).
"""
from __future__ import annotations

from schemas.bko import (
    AudienceSegment,
    Behavioral,
    BKO,
    BKOAudience,
    BKOBrand,
    BKOCompetitivePosition,
    BKOCompliance,
    BKOIdentity,
    BKOMarketingContext,
    BKOMeta,
    BKOMessaging,
    BKOOfferings,
    BKOSocialProof,
    BrandVoice,
    Competitor,
    Demographics,
    FunnelStrategy,
    KeyMessagesByFunnel,
    Product,
    Psychographics,
    ReviewPlatform,
    Testimonial,
    VisualIdentity,
)
from schemas.business import CreateBusinessRequest
from utils.logger import get_logger

logger = get_logger(__name__)

# ── Completeness weights ──────────────────────────────────────────────────────
# Each tuple: (dot-path description, checker function)
# Used to compute completeness_score and missing_fields list.

def _check(value: object) -> bool:
    """True if value is considered 'filled'."""
    if value is None:
        return False
    if isinstance(value, (list, dict, str)) and len(value) == 0:
        return False
    return True


def _compute_completeness(bko: BKO) -> tuple[float, list[str]]:
    checks: list[tuple[str, object]] = [
        # identity
        ("identity.founded_year",           bko.identity.founded_year),
        ("identity.headquarters",           bko.identity.headquarters),
        ("identity.mission",                bko.identity.mission),
        ("identity.tagline",                bko.identity.tagline),
        ("identity.brand_story",            bko.identity.brand_story),
        # offerings
        ("offerings.products_services",     bko.offerings.products_services),
        ("offerings.conversion_url",        bko.offerings.conversion_url),
        # audience
        ("audience.primary.pain_points",    bko.audience.primary.pain_points),
        ("audience.primary.desired_outcomes", bko.audience.primary.desired_outcomes),
        ("audience.primary.objections",     bko.audience.primary.objections),
        ("audience.primary.demographics.age_range", bko.audience.primary.demographics.age_range),
        ("audience.primary.psychographics.values",  bko.audience.primary.psychographics.values),
        ("audience.primary.behavioral.online_platforms", bko.audience.primary.behavioral.online_platforms),
        # brand
        ("brand.voice.examples",            bko.brand.voice.examples),
        ("brand.visual_identity.primary_colors", bko.brand.visual_identity.primary_colors),
        ("brand.dos",                       bko.brand.dos),
        ("brand.donts",                     bko.brand.donts),
        # competitive
        ("competitive_position.positioning_statement", bko.competitive_position.positioning_statement),
        ("competitive_position.competitors",           bko.competitive_position.competitors),
        # marketing
        ("marketing_context.preferred_cta_styles",    bko.marketing_context.preferred_cta_styles),
        ("marketing_context.funnel_strategy.tofu",    bko.marketing_context.funnel_strategy.tofu),
        # social proof
        ("social_proof.key_stats",          bko.social_proof.key_stats),
        ("social_proof.testimonials",       bko.social_proof.testimonials),
        ("social_proof.guarantees",         bko.social_proof.guarantees),
        # messaging
        ("messaging.primary_value_propositions", bko.messaging.primary_value_propositions),
        ("messaging.emotional_hooks",       bko.messaging.emotional_hooks),
    ]

    missing = [path for path, value in checks if not _check(value)]
    score = round(1.0 - len(missing) / len(checks), 2)
    return score, missing


# ── Form path builder ─────────────────────────────────────────────────────────

def build_from_form(req: CreateBusinessRequest) -> BKO:
    logger.info("Building BKO from form for business: %s", req.company.name)

    c = req.company
    p = req.product
    a = req.audience
    b = req.brand
    comp = req.competitive
    sp = req.social_proof
    mkt = req.marketing
    cpl = req.compliance

    # ── identity ──────────────────────────────────────────────────────────────
    identity = BKOIdentity(
        company_name=c.name,
        founded_year=c.founded_year,
        headquarters=c.headquarters,
        website=c.website,
        business_type=c.business_type,
        company_size=c.company_size,
        employee_range=c.employee_range,
        industry=c.industry,
        sub_industry=c.sub_industry,
        description=c.description,
        mission=c.mission,
        tagline=c.tagline,
        brand_story=c.brand_story,
    )

    # ── offerings ─────────────────────────────────────────────────────────────
    product = Product(
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
    offerings = BKOOfferings(
        products_services=[product],
        hero_product=p.name,
        free_trial_available=p.free_trial_available,
        demo_available=p.demo_available,
        primary_cta=p.primary_cta,
        conversion_url=p.conversion_url,
    )

    # ── audience ──────────────────────────────────────────────────────────────
    demographics = Demographics(
        age_range=a.age_range,
        occupation=a.occupation,
        company_size=a.company_size_target,
        industry_vertical=a.industry_vertical,
        seniority=a.seniority,
        geography=a.geography,
        language=a.language,
    )
    psychographics = Psychographics(
        values=a.values,
        interests=a.interests,
        personality=a.personality_traits,
        lifestyle=a.lifestyle,
    )
    behavioral = Behavioral(
        online_platforms=a.online_platforms,
        content_consumption=a.content_consumption,
        purchase_behavior=a.purchase_behavior,
        device_usage=a.device_usage,
        buying_trigger=a.buying_trigger,
    )
    primary_segment = AudienceSegment(
        persona_name=a.persona_name,
        demographics=demographics,
        psychographics=psychographics,
        behavioral=behavioral,
        pain_points=a.pain_points,
        desired_outcomes=a.desired_outcomes,
        objections=a.objections,
        emotional_state=a.emotional_state,
    )
    audience = BKOAudience(
        primary=primary_segment,
        audience_awareness_level=a.audience_awareness_level,
    )

    # ── brand ─────────────────────────────────────────────────────────────────
    voice = BrandVoice(
        primary_tone=b.primary_tone,
        writing_style=b.writing_style,
        pov=b.pov,
        language_complexity=b.language_complexity,
        humor_level=b.humor_level,
        examples=b.voice_examples,
    )
    visual = VisualIdentity(
        primary_colors=b.primary_colors,
        secondary_colors=b.secondary_colors,
        font_style=b.font_style,
        imagery_style=b.imagery_style,
        design_aesthetic=b.design_aesthetic,
        visual_do=b.visual_do,
        visual_dont=b.visual_dont,
    )
    brand = BKOBrand(
        personality_traits=b.personality_traits,
        voice=voice,
        visual_identity=visual,
        dos=b.dos,
        donts=b.donts,
    )

    # ── competitive position ──────────────────────────────────────────────────
    competitors = [
        Competitor(
            name=entry.name,
            strengths=entry.strengths,
            weaknesses=entry.weaknesses,
            pricing_vs_us=entry.pricing_vs_us,
            our_counter=entry.our_differentiator,
        )
        for entry in comp.competitors
    ]
    competitive_position = BKOCompetitivePosition(
        market_position=comp.market_position,
        positioning_statement=comp.positioning_statement,
        primary_differentiators=comp.primary_differentiators,
        competitors=competitors,
        competitive_advantages_summary=comp.competitive_advantages_summary,
    )

    # ── marketing context ─────────────────────────────────────────────────────
    # Derive funnel messages from positioning + pain points + primary CTA
    tofu = (
        f"{primary_segment.pain_points[0]} — there's a better way."
        if primary_segment.pain_points else None
    )
    mofu = (
        f"{p.name} gives you {primary_segment.desired_outcomes[0]}."
        if primary_segment.desired_outcomes else None
    )
    bofu = f"{p.primary_cta}." if p.primary_cta else None

    marketing_context = BKOMarketingContext(
        active_platforms=mkt.active_platforms,
        target_platforms_for_campaigns=mkt.target_platforms_for_campaigns,
        best_performing_content_types=mkt.best_performing_content_types,
        ad_style_preference=mkt.ad_style_preference,
        preferred_cta_styles=mkt.preferred_cta_styles,
        funnel_strategy=FunnelStrategy(tofu=tofu, mofu=mofu, bofu=bofu),
        budget_tier=mkt.budget_tier,
        average_sales_cycle=mkt.average_sales_cycle,
        primary_conversion_goal=mkt.primary_conversion_goal,
    )

    # ── social proof ──────────────────────────────────────────────────────────
    testimonials = [
        Testimonial(
            quote=t.quote,
            author=t.author,
            title=t.title,
            company=t.company,
            use_in_ads=t.use_in_ads,
        )
        for t in sp.testimonials
    ]
    social_proof = BKOSocialProof(
        key_stats=sp.key_stats,
        testimonials=testimonials,
        guarantees=sp.guarantees,
        awards=sp.awards,
        notable_clients=sp.notable_clients,
    )

    # ── messaging ─────────────────────────────────────────────────────────────
    # Build proof points from stats + USPs
    proof_points = list(sp.key_stats) + list(p.unique_selling_points)

    # Build headline formulas from competitive position
    headline_formulas = [
        f"Stop [pain] — start [outcome].",
        f"What if your {_audience_label(a.occupation)} could [desired outcome] without [objection]?",
        f"The {c.industry} tool that {comp.positioning_statement or 'puts your team first'}.",
    ]

    messaging = BKOMessaging(
        primary_value_propositions=mkt.value_propositions or comp.primary_differentiators,
        emotional_hooks=mkt.emotional_hooks,
        proof_points=proof_points,
        headline_formulas=headline_formulas,
        key_messages_by_funnel=KeyMessagesByFunnel(tofu=tofu, mofu=mofu, bofu=bofu),
        forbidden_topics=cpl.forbidden_topics,
        required_disclaimers=cpl.required_disclaimers,
    )

    # ── compliance ────────────────────────────────────────────────────────────
    compliance = BKOCompliance(
        industry_regulations=cpl.industry_regulations,
        restricted_claims=cpl.restricted_claims,
        required_ad_disclosures=cpl.required_disclaimers,
        content_policy_flags=cpl.forbidden_topics,
        certifications_to_mention=cpl.certifications_to_mention,
    )

    # ── assemble & score ──────────────────────────────────────────────────────
    bko = BKO(
        identity=identity,
        offerings=offerings,
        audience=audience,
        brand=brand,
        competitive_position=competitive_position,
        marketing_context=marketing_context,
        social_proof=social_proof,
        messaging=messaging,
        compliance=compliance,
        meta=BKOMeta(version=1, onboarding_path="form", generated_by="form"),
    )

    score, missing = _compute_completeness(bko)
    bko.meta.completeness_score = score
    bko.meta.missing_fields = missing

    logger.info(
        "BKO built for '%s' — completeness=%.0f%% missing=%d fields",
        c.name, score * 100, len(missing),
    )
    if missing:
        logger.debug("Missing BKO fields: %s", missing)

    return bko


# ── Helpers ───────────────────────────────────────────────────────────────────

def _audience_label(occupation: list[str]) -> str:
    if occupation:
        return occupation[0].lower()
    return "team"
