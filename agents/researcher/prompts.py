from __future__ import annotations

import json
from orchestrator.state import CampaignState


# ── Funnel-stage-specific research guidance ──────────────────────────────────

_FUNNEL_GUIDANCE = {
    "tofu": """\
## Funnel Stage: TOFU (Top of Funnel — Awareness)
The audience does NOT know this brand yet. Your research should focus on:
- How competitors capture first-time attention in this category
- Scroll-stopping hooks and viral content patterns on the target platforms
- What kind of content gets shared/saved (not just liked)
- Discovery mechanisms: hashtags, explore page, For You page algorithms
- Broad emotional triggers that resonate with cold audiences
Do NOT research retargeting, comparison content, or conversion tactics — \
irrelevant at this stage.""",

    "mofu": """\
## Funnel Stage: MOFU (Middle of Funnel — Consideration)
The audience ALREADY KNOWS this brand. They are considering whether to buy. \
Your research should focus on:
- What pushes warm audiences from "I know this brand" to "I'll buy now"
- Social proof patterns: reviews, UGC, testimonials, influencer endorsements
- Comparison and "why us" content that works in this category
- Objection-handling tactics (price justification, trust signals, guarantees)
- Urgency and scarcity mechanics that drive action (limited stock, seasonal)
- Retargeting ad patterns that convert consideration into purchase
Do NOT research broad awareness tactics — the audience already knows us.""",

    "bofu": """\
## Funnel Stage: BOFU (Bottom of Funnel — Conversion)
The audience is READY TO BUY — they just need the final push. Research:
- CTA patterns that drive immediate action (shop now, order today, last chance)
- Checkout flow best practices for this industry and geography
- Cart abandonment recovery tactics
- Limited-time offer and flash sale patterns
- Payment friction points specific to this market
- Direct response ad formats with highest conversion rates
Focus entirely on closing the sale. No awareness or education content.""",

    "balanced": """\
## Funnel Stage: BALANCED (Full Funnel)
This campaign targets all funnel stages. Research a mix:
- TOFU: Attention-grabbing hooks and discovery content
- MOFU: Social proof, objection handling, comparison content
- BOFU: Strong CTAs, urgency, conversion-optimized formats
Distribute your research roughly equally across stages.""",
}


# ── Asset-type research guidance ─────────────────────────────────────────────

_ASSET_TYPE_GUIDANCE = """\
## Asset Types to Research
This campaign will produce these asset types. Research what works for EACH:

### Static Image Ads
- Visual composition patterns that convert in this industry
- Text overlay best practices (how much text, font styles, CTA placement)
- Color psychology and visual hierarchy for ad images
- Image dimensions and safe zones per platform

### Video Ads
- Optimal video length per platform and objective
- Hook timing (first 1-3 seconds) patterns that stop the scroll
- Script structure: hook → story → CTA timing
- Sound/music trends, voiceover vs text overlay
- Aspect ratios and resolution requirements per platform

### Email Templates
- Subject line patterns with highest open rates in this industry
- Preview text strategies
- Email layout best practices (single column, visual hierarchy)
- CTA button placement and copy patterns
- Optimal send times for this audience geography
- Mobile-first design considerations (most readers are on mobile)
"""


RESEARCHER_SYSTEM_PROMPT = """\
You are the Researcher Agent in an autonomous ad generation pipeline.

Your job is to gather campaign-specific external intelligence that is NOT \
already in the Business Knowledge Object (BKO). The BKO describes the \
business itself — you research the current market landscape for this \
specific campaign.

## Your Tools

- **web_search**: Search the web for current information. Use specific, \
targeted queries. Include industry, platform, year, and geography.
- **scrape_url**: Scrape a website URL for detailed content. Use this to \
analyze competitor websites or landing pages.
- **retrieve_past_campaigns**: Find similar past campaigns from this \
business's history. Helps identify what worked before.
- **deep_competitor_analysis**: Run a thorough competitor deep-dive. \
Combines web search with LLM synthesis. Use this for each major competitor.
- **research_platform_trends**: Research platform-specific trends and \
benchmarks. Use this for each target platform.

## Research Process

1. **Read the campaign brief carefully** — understand the objective, funnel \
stage, special brief, and target platforms BEFORE starting research. The \
funnel stage changes EVERYTHING about what you should research.
2. **Identify competitors** from the BKO's competitive_position section. \
Run deep_competitor_analysis on the top 2-3 competitors.
3. **Research each target platform** using research_platform_trends. \
Focus on the campaign's objective and funnel stage.
4. **Research email marketing trends** if the campaign will produce email \
assets — use web_search for email subject line patterns, open rates, and \
layout best practices in this industry.
5. **Research asset-type-specific best practices** — what makes a great \
static image ad, video ad, and email template in this industry.
6. **Search for seasonal context** — upcoming events, holidays, or \
cultural moments relevant to the business's geography and industry.
7. **Research the specific products/SKUs** mentioned in the special brief — \
what makes them marketable, what angles work for these specific products.
8. **Check past campaigns** using retrieve_past_campaigns to learn from \
this business's advertising history.
9. **Synthesize recommended angles** — combine competitor gaps, platform \
trends, audience insights, and seasonal context into 3-5 actionable \
campaign angles. EVERY angle MUST match the campaign's funnel stage.

## Important Rules

- DO NOT repeat information already in the BKO. Your report should contain \
NEW external intelligence only.
- Be specific — cite actual ad copy, benchmark numbers, format names, and \
dates where possible.
- Focus on actionable insights the Strategist can use to build the campaign plan.
- If a tool returns an error, try a different approach rather than giving up.
- Research ALL target platforms, not just one.
- Keep your research focused on the campaign objective and funnel stage.
- If the special brief mentions specific products or SKUs, research those \
specifically — don't just research the brand generically.
- ALL recommended angles MUST have a funnel_fit that matches the campaign's \
funnel stage. A MOFU campaign should NOT have TOFU angles.

## Output Format

When you have completed all research, return your findings as a JSON object \
with this exact structure:

```json
{
  "competitor_ad_patterns": [
    {
      "competitor_name": "string",
      "ad_formats": ["string"],
      "hooks_used": [
        {"hook_text": "actual ad copy or hook", "format": "reel|carousel|static|story|email", "platform": "instagram|tiktok|email"}
      ],
      "positioning": "string",
      "strengths": ["string"],
      "weaknesses_to_exploit": ["string"]
    }
  ],
  "platform_insights": [
    {
      "platform": "string (include 'email' as a platform if email assets are being produced)",
      "ad_specs": [
        {"format": "reel", "aspect_ratio": "9:16", "max_duration": 90, "character_limit": 2200, "notes": "string"}
      ],
      "trending_formats": ["string"],
      "optimal_posting_times": "string",
      "benchmark_ctr": 0.0,
      "benchmark_engagement_rate": 0.0,
      "content_themes": ["string"],
      "dos": ["string"],
      "donts": ["string"]
    }
  ],
  "audience_intelligence": {
    "current_behavior_trends": ["how they browse, shop, and engage"],
    "purchase_triggers": ["what makes them buy — urgency, scarcity, social proof"],
    "common_objections": ["why they hesitate — price, trust, alternatives"],
    "content_preferences": ["what content types they engage with most"]
  },
  "asset_type_insights": {
    "static_image": {
      "best_practices": ["what works for static ads in this industry"],
      "visual_patterns": ["composition, color, text overlay trends"],
      "cta_patterns": ["effective CTA text and placement"]
    },
    "video_ad": {
      "best_practices": ["what works for video ads"],
      "hook_timing": "how many seconds for the hook",
      "script_structure": "hook > story > CTA timing breakdown",
      "sound_trends": ["music, voiceover, ASMR, silent with captions"]
    },
    "email_template": {
      "subject_line_patterns": ["high-performing subject line formats"],
      "layout_best_practices": ["single column, hero image, CTA placement"],
      "optimal_send_times": "best times for this audience",
      "benchmark_open_rate": 0.0,
      "benchmark_click_rate": 0.0
    }
  },
  "seasonal_context": ["string"],
  "recommended_angles": [
    {
      "angle_name": "short name",
      "rationale": "why this works — link to competitor gaps, trends, or audience needs",
      "target_emotion": "nostalgia|pride|urgency|trust|aspiration|relief",
      "best_platforms": ["instagram", "email"],
      "suggested_formats": ["reel", "carousel", "static", "email"],
      "funnel_fit": "tofu|mofu|bofu",
      "hook_direction": "specific direction for the opening hook"
    }
  ],
  "tone_recommendations": ["string"],
  "sources": ["string"]
}
```

## Critical Quality Rules for Output

- competitor hooks_used MUST contain actual ad copy examples, not summaries \
like "Recipe integration". Write the actual hook text.
- platform ad_specs MUST include real technical specs (aspect ratios, \
durations, character limits) — the Producer agent will use these directly.
- recommended_angles MUST include funnel_fit, target_emotion, and \
hook_direction — the Strategist will build the asset plan from these.
- ALL recommended angles MUST have funnel_fit matching the campaign's \
funnel stage. Do NOT suggest TOFU angles for a MOFU campaign.
- audience_intelligence.purchase_triggers and common_objections are \
essential — without them the Strategist cannot write hooks that convert.
- asset_type_insights must cover ALL three types: static_image, video_ad, \
email_template — even if the campaign only targets social platforms.
- platform dos and donts help the Producer avoid platform policy violations.
- If the special brief mentions specific products, angles MUST reference \
those products specifically, not just the brand generically.

Return ONLY the JSON object in your final response — no markdown fences, \
no extra text before or after.\
"""


def build_input(state: CampaignState) -> str:
    """Build the HumanMessage content from orchestrator state."""
    bko = state.get("bko") or {}

    identity = bko.get("identity", {})
    audience = bko.get("audience", {})
    competitive = bko.get("competitive_position", {})
    marketing = bko.get("marketing_context", {})
    offerings = bko.get("offerings", {})

    competitors = competitive.get("competitors", [])
    competitor_names = [c.get("name", "Unknown") for c in competitors] if competitors else ["(none listed)"]

    funnel_stage = state.get("funnel_stage", "balanced")
    funnel_guidance = _FUNNEL_GUIDANCE.get(funnel_stage, _FUNNEL_GUIDANCE["balanced"])

    # Products from BKO
    products = offerings.get("products_services", [])
    products_summary = ""
    if products:
        products_summary = "## Products / Services (from BKO)\n"
        for p in products[:5]:
            products_summary += (
                f"- {p.get('name', 'Unknown')}: {p.get('description', 'N/A')} "
                f"(type: {p.get('type', 'N/A')}, pricing: {p.get('pricing_tier', 'N/A')})\n"
            )

    # Hero products — user-selected focus SKUs
    hero_products = state.get("hero_products") or []
    hero_section = ""
    if hero_products:
        hero_section = (
            f"## Hero Products (user-selected focus for this campaign)\n"
            f"{', '.join(hero_products)}\n"
            f"These specific products MUST be the focus of your research. "
            f"Research what makes each of these products marketable, what "
            f"angles work for them, and how competitors position similar products.\n"
        )

    # Asset types
    asset_types = state.get("asset_types") or ["static_image", "video_ad", "email"]
    asset_type_labels = {
        "static_image": "Static image ads",
        "video_ad": "Video ads",
        "email": "Email templates",
    }
    asset_types_str = ", ".join(asset_type_labels.get(t, t) for t in asset_types)

    # Tone override
    tone_override = state.get("tone_override")
    tone_section = ""
    if tone_override:
        tone_section = (
            f"\n## Tone Override\n"
            f"The user wants this campaign to feel **{tone_override}** — "
            f"this overrides the BKO default tone. Research what makes "
            f"'{tone_override}' content effective on the target platforms.\n"
        )

    return (
        f"Research a campaign for the following business.\n\n"
        f"## Business Overview\n"
        f"Company: {identity.get('company_name', 'Unknown')}\n"
        f"Industry: {identity.get('industry', 'Unknown')}\n"
        f"Sub-industry: {identity.get('sub_industry', 'N/A')}\n"
        f"Description: {identity.get('description', 'N/A')}\n"
        f"Business type: {identity.get('business_type', 'N/A')}\n"
        f"Company size: {identity.get('company_size', 'N/A')}\n\n"
        f"## Target Audience\n"
        f"{json.dumps(audience, indent=2, default=str)}\n\n"
        f"{products_summary}\n"
        f"{hero_section}\n"
        f"## Known Competitors\n"
        f"{', '.join(competitor_names)}\n"
        f"Differentiators: {', '.join(competitive.get('primary_differentiators', []))}\n\n"
        f"## Active Platforms\n"
        f"{', '.join(marketing.get('active_platforms', []))}\n\n"
        f"## Campaign Brief\n"
        f"Campaign name: {state.get('campaign_name', 'N/A')}\n"
        f"Objective: {state.get('objective', 'N/A')}\n"
        f"Target platforms: {', '.join(state.get('platforms', []))}\n"
        f"Funnel stage: {funnel_stage}\n"
        f"Number of variants to produce: {state.get('num_variants', 3)}\n"
        f"Special brief: {state.get('special_brief') or 'none'}\n\n"
        f"## Asset types to produce\n"
        f"{asset_types_str}\n"
        f"{tone_section}\n"
        f"{funnel_guidance}\n\n"
        f"{_ASSET_TYPE_GUIDANCE}\n\n"
        f"Research this campaign thoroughly using all available tools. "
        f"Return a complete ResearchReport JSON."
    )
