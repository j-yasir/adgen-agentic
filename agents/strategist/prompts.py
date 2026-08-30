from __future__ import annotations

import json
from typing import Any

from agents.strategist.schemas import AssetBrief

# ══════════════════════════════════════════════════════════════════════════════
# Stage 1 — Distribution Planner
# ══════════════════════════════════════════════════════════════════════════════

# Only {num_variants} and {schema_example} are format placeholders — the JSON
# braces live in _PLANNER_SCHEMA_EXAMPLE, which is passed in as an argument.
_PLANNER_SYSTEM_TEMPLATE = """\
You are the Campaign Architect in an ad generation pipeline. You do NOT write
copy. You design the campaign structure: which assets to make, what job each
one does, and the creative direction each one follows. Specialist copywriters
will execute your briefs exactly — so every brief must be decisive and
specific enough to execute without asking questions.

## How the three asset types work together
- video_ad — ATTENTION. Cold reach. Stops the scroll, introduces the story.
  Best for tofu and emotional narrative.
- static_image — FREQUENCY. Retargeting and reinforcement. One message per
  glance. Best for mofu/bofu reminders and offers.
- email — CONVERSION. The owned-audience closer. The only long-copy format.
  Best for mofu nurture and bofu offers.

A person may see the video first, the static second, the email last. Design
them as ONE story told in sequence, not as independent ads. Write a
narrative_arc explaining how the assets connect, and give every asset a
role_in_campaign and a key_message that builds on the previous step.

## Distribution logic
Weight the mix by objective:
- awareness: video-heavy
- traffic / engagement: video + static balanced, curiosity hooks
- conversion: static + email heavy (retarget + close), video only as proof/demo
- lead_gen: email is the star, video/static feed it

Hard constraints:
- Exactly {num_variants} asset briefs. Not more, not fewer.
- Every requested platform gets at least one asset.
- Every requested asset type appears at least once if the count allows.
- Never use an asset type that was not requested. If TikTok or YouTube is
  in the platform list but "video_ad" is NOT in the asset types, use
  static_image with format "9:16" for those platforms — do NOT invent a
  video_ad entry.
- hero_product must be chosen from the "Hero products" list in the Campaign
  Brief when that list is non-empty — never substitute a different BKO
  catalog product (e.g. the umbrella/parent product line name). Spread
  across the named hero products — no single one on every asset.
- For funnel_stage "balanced", assign tofu/mofu/bofu per asset yourself. For
  any OTHER funnel_stage value (tofu/mofu/bofu), every asset MUST use
  exactly that stage — do not introduce other stages, even for a video
  meant to grab attention.
- Choose each asset's format from the platform specs in the research report
  (e.g. tiktok is 9:16 only; email assets always use platform "email" and
  format "email").
- Google display ads: use asset_type "static_image" with format "1:1" or
  "16:9". Text-only Google ad units (search_ad, responsive, banner) are also
  valid formats for static_image on Google. Google MUST get its own asset_brief
  when it is in the platform list — never skip it.
- Set compliance_notes on any asset that needs a disclaimer or restriction,
  using the Compliance section of the input.

## Audience awareness
The Campaign Brief lists both the BKO's default audience_awareness_level and
the campaign's special_brief. If the special_brief states or implies a
different awareness level (e.g. "the audience already knows the brand"),
follow the special_brief for THIS campaign — it overrides the BKO default.
Do not write introductory/discovery-style hooks ("here's who we are",
brand-vs-generic-alternative comparisons) for an audience described as
already aware; write hooks that assume familiarity and push toward action.

## Process
1. Read the research report: competitor gaps, recommended angles, platform
   specs, audience triggers and objections.
2. Call retrieve_past_campaigns once. If it returns no past data, move on
   without further consideration.
3. Assign angles from the research's recommended_angles to the platforms and
   funnel stages where they fit best. Write a hook_direction for each asset
   that a copywriter can execute without asking questions.
4. Emit the final JSON.

## Output
Return ONLY a JSON object with this exact structure — no markdown fences,
no commentary:

{schema_example}
"""

_PLANNER_SCHEMA_EXAMPLE = """\
{
  "campaign_theme": "the overarching creative thread",
  "target_emotion": "campaign-level primary emotion",
  "narrative_arc": "how the assets connect as one story told in sequence",
  "asset_briefs": [
    {
      "asset_id": "asset-1",
      "asset_type": "video_ad",
      "platform": "tiktok",
      "format": "9:16",
      "funnel_stage": "tofu",
      "role_in_campaign": "attention",
      "angle": "angle name from research",
      "hero_product": "exact product name",
      "target_emotion": "curiosity",
      "hook_direction": "1-2 sentence creative direction for the hook",
      "key_message": "the ONE thing this asset must communicate",
      "tone": "resolved tone for this asset",
      "compliance_notes": ""
    },
    {
      "asset_id": "asset-2",
      "asset_type": "email",
      "platform": "email",
      "format": "email",
      "funnel_stage": "bofu",
      "role_in_campaign": "conversion",
      "angle": "angle name",
      "hero_product": "product name",
      "target_emotion": "urgency",
      "hook_direction": "subject-line direction",
      "key_message": "...",
      "tone": "...",
      "compliance_notes": "do not claim health benefits"
    }
  ],
  "key_messages": ["message 1", "message 2", "message 3"],
  "what_to_avoid": ["from compliance + brand don'ts + research"]
}"""


def build_planner_prompt(num_variants: int) -> str:
    """Planner system prompt, formatted per run."""
    return _PLANNER_SYSTEM_TEMPLATE.format(
        num_variants=num_variants,
        schema_example=_PLANNER_SCHEMA_EXAMPLE,
    )


# ── Shared BKO summarisers ────────────────────────────────────────────────────

def _brand_voice_summary(bko: dict) -> str:
    voice = (bko.get("brand") or {}).get("voice") or {}
    return (
        f"Tone: {voice.get('primary_tone', 'N/A')}, "
        f"Style: {voice.get('writing_style', 'N/A')}, "
        f"POV: {voice.get('pov', 'N/A')}"
    )


def _visual_identity_summary(bko: dict) -> str:
    visual = (bko.get("brand") or {}).get("visual_identity") or {}
    return (
        f"Colors: {', '.join(visual.get('primary_colors', []) or ['N/A'])}, "
        f"Font: {visual.get('font_style', 'N/A')}, "
        f"Aesthetic: {visual.get('design_aesthetic', 'N/A')}, "
        f"Imagery: {visual.get('imagery_style', 'N/A')}"
    )


def _products_summary(state: dict) -> str:
    bko = state.get("bko") or {}
    hero_products = state.get("hero_products") or []
    products = (bko.get("offerings") or {}).get("products_services") or []
    if not products:
        return "none listed"
    lines = []
    for p in products[:8]:
        is_hero = " [HERO]" if p.get("name") in hero_products or p.get("is_hero") else ""
        usps = ", ".join(p.get("unique_selling_points", []) or [])
        lines.append(f"- {p.get('name', 'Unknown')}{is_hero}: {p.get('description', 'N/A')} | USPs: {usps}")
    return "\n".join(lines)


def _compliance_block(bko: dict) -> str:
    compliance = bko.get("compliance") or {}
    messaging = bko.get("messaging") or {}
    return (
        f"Regulations: {', '.join(compliance.get('industry_regulations', []) or ['none'])}\n"
        f"Restricted claims (NEVER use): {', '.join(compliance.get('restricted_claims', []) or ['none'])}\n"
        f"Forbidden topics: {', '.join(messaging.get('forbidden_topics', []) or ['none'])}\n"
        f"Required disclosures: {', '.join(compliance.get('required_ad_disclosures', []) or ['none'])}"
    )


def build_planner_input(state: dict) -> str:
    """The planner's user message: campaign brief + BKO summary + research report."""
    bko = state.get("bko") or {}
    identity = bko.get("identity") or {}
    brand = bko.get("brand") or {}
    messaging = bko.get("messaging") or {}

    tone = state.get("tone_override") or ((brand.get("voice") or {}).get("primary_tone")) or "professional"
    research = state.get("research_report") or {}

    platforms = state.get("platforms") or []
    asset_types = state.get("asset_types") or []
    video_platforms = {"tiktok", "youtube"}
    tiktok_no_video = (
        any(p in video_platforms for p in platforms) and "video_ad" not in asset_types
    )
    tiktok_note = (
        "NOTE: TikTok/YouTube are in the platform list but 'video_ad' is NOT "
        "in the asset types. Use static_image with format '9:16' for TikTok/YouTube — "
        "do NOT use video_ad.\n"
        if tiktok_no_video else ""
    )

    brief = (
        f"## Campaign Brief\n"
        f"Campaign: {state.get('campaign_name') or 'N/A'}\n"
        f"Objective: {state.get('objective', 'N/A')}\n"
        f"Platforms: {', '.join(platforms)}\n"
        f"Asset types to produce: {', '.join(asset_types)} — use ONLY these types, no others.\n"
        f"{tiktok_note}"
        f"Funnel stage: {state.get('funnel_stage', 'N/A')}\n"
        f"Number of variants: {state.get('num_variants', 3)}\n"
        f"Hero products: {', '.join(state.get('hero_products') or []) or 'none specified'}\n"
        f"Tone (use for every asset): {tone}\n"
        f"Audience awareness level (BKO default): "
        f"{(bko.get('audience') or {}).get('audience_awareness_level', 'N/A')}\n"
        f"Special brief from the user: {state.get('special_brief') or 'none'}\n\n"
    )
    return brief + (
        f"## Brand\n"
        f"Company: {identity.get('company_name', 'Unknown')} "
        f"({identity.get('industry', 'Unknown')})\n"
        f"Description: {identity.get('description', 'N/A')}\n"
        f"Voice: {_brand_voice_summary(bko)}\n"
        f"Brand dos: {', '.join(brand.get('dos', []) or ['none'])}\n"
        f"Brand don'ts: {', '.join(brand.get('donts', []) or ['none'])}\n\n"
        f"## Products\n{_products_summary(state)}\n\n"
        f"## Audience (from BKO)\n"
        f"{json.dumps(bko.get('audience') or {}, indent=2, default=str)}\n\n"
        f"## Messaging Guidelines\n"
        f"Value propositions: {', '.join(messaging.get('primary_value_propositions', []) or ['N/A'])}\n"
        f"Emotional hooks: {', '.join(messaging.get('emotional_hooks', []) or ['N/A'])}\n\n"
        f"## Compliance\n{_compliance_block(bko)}\n\n"
        f"## Research Report\n"
        f"{json.dumps(research, indent=2, default=str)}\n\n"
        f"Design the campaign now. Emit the DistributionPlan JSON with exactly "
        f"{state.get('num_variants', 3)} asset briefs."
    )


# ══════════════════════════════════════════════════════════════════════════════
# Stage 2 — Specialist skill inputs (piping matrix: each skill gets its slice)
# ══════════════════════════════════════════════════════════════════════════════

def build_copy_context(state: dict) -> dict[str, Any]:
    """Extract the shared, reusable slices of BKO + research for the copy skills."""
    bko = state.get("bko") or {}
    research = state.get("research_report") or {}
    audience_intel = research.get("audience_intelligence") or {}
    asset_insights = research.get("asset_type_insights") or {}

    # BKO audience pain points (primary segment)
    audience = bko.get("audience") or {}
    primary = audience.get("primary") or audience
    pain_points = list((primary.get("pain_points") if isinstance(primary, dict) else None) or [])

    return {
        "company_name": (bko.get("identity") or {}).get("company_name", "the brand"),
        "brand_voice": _brand_voice_summary(bko),
        "visual_identity": _visual_identity_summary(bko),
        "pain_points": pain_points,
        "purchase_triggers": list(audience_intel.get("purchase_triggers") or []),
        "objections": list(audience_intel.get("common_objections") or []),
        "compliance": _compliance_block(bko),
        "conversion_url": (bko.get("offerings") or {}).get("conversion_url") or "",
        "value_props": list(((bko.get("messaging") or {}).get("primary_value_propositions")) or []),
        # Researcher uses the key "email_template" for email insights.
        "static_insights": asset_insights.get("static_image") or {},
        "video_insights": asset_insights.get("video_ad") or {},
        "email_insights": asset_insights.get("email_template") or {},
        "platform_insights": research.get("platform_insights") or [],
        "objective": state.get("objective", "N/A"),
        "special_brief": state.get("special_brief") or "",
    }


def _platform_spec_block(ctx: dict, platform: str, format_: str) -> str:
    for insight in ctx.get("platform_insights") or []:
        if isinstance(insight, dict) and insight.get("platform") == platform:
            specs = [
                s for s in insight.get("ad_specs") or []
                if isinstance(s, dict) and (s.get("aspect_ratio") in (format_, None) or format_ == "email")
            ] or insight.get("ad_specs") or []
            return json.dumps(
                {
                    "ad_specs": specs,
                    "dos": insight.get("dos", []),
                    "donts": insight.get("donts", []),
                    "content_themes": insight.get("content_themes", []),
                },
                indent=2, default=str,
            )
    return "no platform spec available — use platform best practices"


def _product_block(state: dict, product_name: str) -> str:
    products = ((state.get("bko") or {}).get("offerings") or {}).get("products_services") or []
    for p in products:
        if isinstance(p, dict) and p.get("name", "").lower() in product_name.lower():
            return (
                f"{p.get('name')}: {p.get('description', 'N/A')} | "
                f"USPs: {', '.join(p.get('unique_selling_points', []) or [])}"
            )
        if isinstance(p, dict) and product_name.lower() in p.get("name", "").lower():
            return (
                f"{p.get('name')}: {p.get('description', 'N/A')} | "
                f"USPs: {', '.join(p.get('unique_selling_points', []) or [])}"
            )
    return product_name


def _brief_block(brief: AssetBrief, ctx: dict, state: dict, narrative_arc: str) -> str:
    """The shared portion of every skill's user prompt."""
    return (
        f"## Asset Brief\n"
        f"Asset: {brief.asset_id} — {brief.asset_type} on {brief.platform} ({brief.format})\n"
        f"Funnel stage: {brief.funnel_stage} | Role in campaign: {brief.role_in_campaign}\n"
        f"Angle: {brief.angle}\n"
        f"Featured product: {_product_block(state, brief.hero_product)}\n"
        f"Target emotion: {brief.target_emotion}\n"
        f"Hook direction: {brief.hook_direction}\n"
        f"Key message (the ONE thing to communicate): {brief.key_message}\n"
        f"Tone: {brief.tone}\n"
        f"Compliance notes for this asset: {brief.compliance_notes or 'none'}\n\n"
        f"## Campaign Context\n"
        f"Brand: {ctx['company_name']} | Objective: {ctx['objective']}\n"
        f"Narrative arc (this asset is one step of it): {narrative_arc}\n"
        f"Brand voice: {ctx['brand_voice']}\n"
        f"Value propositions: {', '.join(ctx['value_props']) or 'N/A'}\n"
        f"Audience pain points: {', '.join(ctx['pain_points']) or 'N/A'}\n"
        f"Purchase triggers: {', '.join(ctx['purchase_triggers']) or 'N/A'}\n"
        f"Common objections: {', '.join(ctx['objections']) or 'N/A'}\n"
        f"Special brief from the user: {ctx['special_brief'] or 'none'}\n\n"
        f"## Compliance (hard rules)\n{ctx['compliance']}\n"
    )


def build_static_input(brief: AssetBrief, ctx: dict, state: dict, narrative_arc: str) -> str:
    return (
        _brief_block(brief, ctx, state, narrative_arc)
        + f"\n## Brand Visual Identity (use in image_prompt)\n{ctx['visual_identity']}\n"
        + f"\n## Platform Spec ({brief.platform}, {brief.format})\n"
        + _platform_spec_block(ctx, brief.platform, brief.format)
        + f"\n\n## Static Ad Insights (from research)\n"
        + json.dumps(ctx["static_insights"], indent=2, default=str)
        + "\n\nWrite the static ad now. Return ONLY the JSON object."
    )


def build_video_input(brief: AssetBrief, ctx: dict, state: dict, narrative_arc: str, max_duration: int) -> str:
    return (
        _brief_block(brief, ctx, state, narrative_arc)
        + f"\n## Brand Visual Identity (respect in visual_style)\n{ctx['visual_identity']}\n"
        + f"\n## Platform Spec ({brief.platform}, {brief.format})\n"
        + _platform_spec_block(ctx, brief.platform, brief.format)
        + f"\nMax duration for this platform: {max_duration} seconds — do not exceed it.\n"
        + f"\n## Video Ad Insights (from research)\n"
        + json.dumps(ctx["video_insights"], indent=2, default=str)
        + "\n\nWrite the video script now. Return ONLY the JSON object."
    )


def build_email_input(brief: AssetBrief, ctx: dict, state: dict, narrative_arc: str) -> str:
    cta_url = ctx["conversion_url"] or "https://example.com/shop"
    return (
        _brief_block(brief, ctx, state, narrative_arc)
        + f"\nCTA URL (use exactly this in cta_url): {cta_url}\n"
        + f"\n## Email Insights (from research)\n"
        + json.dumps(ctx["email_insights"], indent=2, default=str)
        + "\n\nWrite the email now. Return ONLY the JSON object."
    )


# ══════════════════════════════════════════════════════════════════════════════
# HITL revision
# ══════════════════════════════════════════════════════════════════════════════

REVISION_SYSTEM_PROMPT = """\
You are the Campaign Architect revising a rejected campaign strategy. A human
reviewed the previous strategy and gave feedback. Revise ONLY what the
feedback touches — approved work must not be regenerated.

Rules:
- Every asset_id from the previous strategy appears in exactly one of "keep"
  or "regenerate".
- "regenerate" entries are full revised briefs (same asset_id, but you may
  change angle, platform, format, hook_direction, etc. if the feedback asks).
- Only set campaign_theme / narrative_arc / key_messages / what_to_avoid if
  the feedback requires changing them; otherwise leave them null.
- If the feedback is vague, interpret it conservatively: regenerate the
  smallest set of assets that plausibly addresses it.

Return ONLY a JSON object — no markdown fences:
{
  "keep": ["asset-1", "asset-3"],
  "regenerate": [
    {
      "asset_id": "asset-2",
      "asset_type": "video_ad",
      "platform": "tiktok",
      "format": "9:16",
      "funnel_stage": "tofu",
      "role_in_campaign": "attention",
      "angle": "...",
      "hero_product": "...",
      "target_emotion": "...",
      "hook_direction": "revised direction addressing the feedback",
      "key_message": "...",
      "tone": "...",
      "compliance_notes": ""
    }
  ],
  "campaign_theme": null,
  "narrative_arc": null,
  "key_messages": null,
  "what_to_avoid": null
}
"""


def build_revision_input(state: dict, previous_doc: dict, feedback: str) -> str:
    return (
        f"## Human Feedback (the reason the strategy was rejected)\n"
        f"{feedback}\n\n"
        f"## Previous Strategy Document\n"
        f"{json.dumps(previous_doc, indent=2, default=str)}\n\n"
        f"## Campaign Brief (unchanged)\n"
        f"Objective: {state.get('objective', 'N/A')} | "
        f"Platforms: {', '.join(state.get('platforms') or [])} | "
        f"Asset types: {', '.join(state.get('asset_types') or [])} | "
        f"Variants: {state.get('num_variants', 3)}\n\n"
        f"Produce the RevisionPlan JSON now."
    )
