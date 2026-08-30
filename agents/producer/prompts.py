"""Static-image Producer sub-agent — Phase 1 (creative planning) prompt.

build_static_image_playbook() returns the full system prompt for the one LLM
call this sub-agent makes (and that the email skill's hero-image step reuses
— see agents/producer/skills.py::plan_static_image's include_text/include_logo
params). It is used verbatim (never .format()-ed), so the JSON schema example
below uses normal single braces — same convention as
agents/strategist/playbooks.py.

Structure follows examples/nano_banana_propmt.yaml's rubric, generalized from
its original domain (identity-preserving hairstyle transformation) to
brand/product-grounded ad imagery: Nano Banana is a reasoning model that
wants a narrative director's brief, not a keyword list, built from mandatory
parts in a fixed order, with positive framing throughout (never "avoid",
"don't", "no").
"""

from __future__ import annotations

_PART_6_WITH_TEXT = """\
   PART 6 — MINIMAL ON-IMAGE TEXT: instruct the model to render a short
   headline phrase and, if there is a distinct call-to-action, a brief
   button-style CTA label — both kept deliberately minimal (a few words each,
   never a full sentence or paragraph), legible, high-contrast, and placed in
   the composition's negative space. Never instruct the model to render the
   full platform caption/body copy inside the image.
"""

_PART_6_NO_TEXT = """\
   PART 6 — PURELY VISUAL COMPOSITION: every element in the frame belongs to
   the physical scene itself — the image is entirely typography-free, its
   message communicated through composition, lighting, and product
   presentation alone. Any headline or call-to-action for this asset is
   rendered separately, outside the image.
"""


def build_static_image_playbook(include_text: bool = True) -> str:
    """The static-image / email-hero-image Phase 1 system prompt.

    include_text=False is used by the email skill's hero-image step: an
    EmailPlan's hero_image_brief is explicitly a text-free scene (the HTML
    template carries all copy), so Part 6 swaps to a purely-visual directive
    instead of the minimal-text one. Everything else — fidelity preservation,
    scene/composition, brand identity, photorealism — applies identically to
    both callers.
    """
    part_6 = _PART_6_WITH_TEXT if include_text else _PART_6_NO_TEXT
    return _PLAYBOOK_TEMPLATE.format(part_6=part_6)


_PLAYBOOK_TEMPLATE = """\
You are an expert AI image-generation prompt engineer specializing in
brand-accurate, product-grounded advertising imagery, generating with Google
Nano Banana (Gemini Pro Image / Flash Image).

## Critical model behavior
Nano Banana is a REASONING model that interprets full narrative briefs — it
is not a keyword-matching model. Write every prompt like a creative director
briefing a senior advertising photographer, in flowing prose. Never write a
comma-separated tag list or a Seedream-style technical parameter string.

When real reference images are provided alongside your prompt (the product
photo and/or the logo), your prompt text must CORROBORATE what the model
already sees in those images, not attempt to reconstruct the product from
memory. When no reference image is available for something, describe it
faithfully from the brand data you're given instead of inventing details not
present anywhere in the input.

POSITIVE FRAMING IS MANDATORY throughout the entire prompt. Every instruction
describes what TO render. Never write "do not", "avoid", "no", or "without" —
if you need the model to preserve something, say "preserve X exactly" or
"keep X unchanged", never "don't change X".

## Your two jobs, in this exact order
1. Decide the creative composition: whether this ad needs an avatar/person,
   and whether the resolved logo and/or product image should actually be fed
   to the model as reference inputs (only mark one of these true if the
   input tells you that reference is genuinely available — never claim a
   reference exists when the input says it doesn't).
2. Write `final_prompt` — the complete, finished, production-ready generation
   prompt — as ONE continuous string, structured in these parts, in order:

   PART 1 — CONTEXT FRAME (1 sentence): state the ad's purpose and platform.
   Nano Banana's reasoning improves sharply when given a purpose, not just a
   subject. Example: "This is a photorealistic paid social advertisement
   image for a premium food brand, intended for an Instagram feed post."

   PART 2 — SUBJECT DESCRIPTOR (1-2 sentences): name the real product from
   the brand data — its category, form, and key visual attributes — so your
   text corroborates the product reference image passed alongside it (when
   one is provided), or faithfully describes it from the brand's own
   description (when no reference photo exists). Never invent a product
   detail that appears nowhere in the input.

   PART 3 — FIDELITY PRESERVATION (positive framing MANDATORY): when a
   product reference image is provided, instruct the model to preserve the
   product's real packaging, label text, shape, and color exactly as shown.
   When a logo reference image is provided, instruct the model to reproduce
   the logo's exact proportions, colors, and wordmark unaltered. Use language
   like "preserve the exact packaging and label as shown in the reference
   image" and "reproduce the logo exactly as provided, with unaltered
   proportions and colors" — never negative phrasing.

   PART 4 — SCENE & COMPOSITION: describe the setting, lighting, mood,
   camera angle, and framing appropriate to the target aspect ratio and the
   platform's ad style. If you decided an avatar appears, describe that
   person here (age range, styling, and how they interact with the product)
   as a wholly original description — there is no reference photo for a
   person, so this part is fully your creative invention, grounded in the
   target audience's demographics for plausibility. If no avatar, keep the
   composition product/lifestyle-focused with no person present.

   PART 5 — BRAND VISUAL IDENTITY: translate the brand's colors, imagery
   style, and design aesthetic into narrative scene-setting language (e.g.
   "the palette leans on the brand's warm terracotta and cream tones" rather
   than listing hex codes). Reflect the brand's stated visual dos, and steer
   the composition away from its stated visual don'ts by describing what to
   render instead — still positive framing.

{part_6}
   PART 7 — PHOTOREALISM & QUALITY (positive framing MANDATORY): describe the
   desired lighting quality, material/texture rendering, and a professional
   advertising-photography context (e.g. "shot with the clarity of a
   high-end commercial product photograph") — professional context lets the
   model infer appropriate technical quality without needing raw camera
   parameters. Never use negative phrasing like "no artifacts" or "not
   cartoonish" — instead state the positive quality directly ("rendered with
   crisp, photorealistic detail").

   PART 8 — CLOSING PRESERVATION CONFIRMATION (1 sentence, positive framing):
   assert that the product's real appearance, the logo's real appearance
   (whichever were actually provided as references), and the brand's palette
   remain faithful throughout the image.

Do not reference this pipeline, the brand's internal field names, or any
JSON/schema terminology inside `final_prompt` — it must read as a complete,
self-contained creative brief with no external context required.

## Output rules
- Return ONLY a JSON object matching the schema below — no markdown fences,
  no commentary before or after.
- `final_prompt` is a single continuous string — no bullet points, no
  numbered parts, no newline characters, no markdown formatting.
- Every field fully written. No placeholders ("TBD", "insert here", lorem).

## Output schema
{{
  "final_prompt": "the complete 8-part narrative prompt as one continuous string",
  "use_avatar": false,
  "avatar_description": null,
  "use_logo": true,
  "use_product_image": true,
  "reasoning": "one or two sentences on why these choices fit this asset"
}}
"""


def build_static_image_input(
    *,
    asset: dict,
    bko: dict,
    strategy_doc: dict,
    brand_assets_available: dict,
    platform_insight: dict | None,
    static_image_insights: dict | None,
    special_brief: str | None,
    tone_override: str | None,
) -> str:
    """Assemble the Phase-1 user prompt for one static_image asset.

    `brand_assets_available` carries only booleans + the resolved product's
    name — never raw file paths, which the LLM has no use for (Phase 2
    resolves paths deterministically from the same brand_assets object).
    """
    identity = bko.get("identity") or {}
    visual_identity = (bko.get("brand") or {}).get("visual_identity") or {}
    audience = ((bko.get("audience") or {}).get("primary")) or {}

    lines = [
        "## This asset",
        f"platform: {asset.get('platform')}",
        f"format (aspect ratio): {asset.get('format')}",
        f"role_in_campaign: {asset.get('role_in_campaign')}",
        f"angle: {asset.get('angle')}",
        f"hero_product (name): {asset.get('hero_product')}",
        f"target_emotion: {asset.get('target_emotion')}",
        f"key_message: {asset.get('key_message')}",
        f"copy_tone: {asset.get('copy_tone')}",
        f"hook: {asset.get('hook')}",
        f"headline: {asset.get('headline')}",
        f"cta: {asset.get('cta')}",
        f"draft creative direction (image_prompt, NOT final — write your own): {asset.get('image_prompt')}",
        f"text_overlay: {asset.get('text_overlay')}",
        f"visual_avoid: {asset.get('visual_avoid')}",
        f"compliance_notes: {asset.get('compliance_notes') or 'none'}",
        "",
        "## Campaign context",
        f"campaign_theme: {strategy_doc.get('campaign_theme')}",
        f"target_emotion (campaign-level): {strategy_doc.get('target_emotion')}",
        f"what_to_avoid: {strategy_doc.get('what_to_avoid')}",
        f"special_brief: {special_brief or 'none'}",
        f"tone_override: {tone_override or 'none'}",
        "",
        "## Brand",
        f"business description: {identity.get('description')}",
        f"business_type: {identity.get('business_type')}",
        f"primary_colors: {visual_identity.get('primary_colors')}",
        f"secondary_colors: {visual_identity.get('secondary_colors')}",
        f"font_style: {visual_identity.get('font_style')}",
        f"imagery_style: {visual_identity.get('imagery_style')}",
        f"design_aesthetic: {visual_identity.get('design_aesthetic')}",
        f"visual_do: {visual_identity.get('visual_do')}",
        f"visual_dont: {visual_identity.get('visual_dont')}",
        f"ad_style_preference: {(bko.get('marketing_context') or {}).get('ad_style_preference')}",
        "",
        "## Target audience (for avatar plausibility, only if you decide to use one)",
        f"persona_name: {audience.get('persona_name')}",
        f"demographics: {audience.get('demographics')}",
        "",
        "## Real reference images actually available for this asset",
        f"resolved_product_name: {brand_assets_available.get('product_name')}",
        f"product_image_available: {brand_assets_available.get('product_image_available')}",
        f"logo_available: {brand_assets_available.get('logo_available')}",
        "(Only set use_product_image/use_logo true when the corresponding "
        "*_available flag above is true.)",
    ]

    if platform_insight:
        lines += [
            "",
            "## Platform research insight",
            f"dos: {platform_insight.get('dos')}",
            f"donts: {platform_insight.get('donts')}",
            f"content_themes: {platform_insight.get('content_themes')}",
        ]

    if static_image_insights:
        lines += [
            "",
            "## Static-image best practices (research)",
            f"best_practices: {static_image_insights.get('best_practices')}",
            f"visual_patterns: {static_image_insights.get('visual_patterns')}",
            f"cta_patterns: {static_image_insights.get('cta_patterns')}",
        ]

    return "\n".join(lines)


def build_email_hero_input(
    *,
    asset: dict,
    bko: dict,
    strategy_doc: dict,
    brand_assets_available: dict,
    special_brief: str | None,
    tone_override: str | None,
) -> str:
    """Assemble the Phase-1 user prompt for one email asset's hero image.

    A separate function from build_static_image_input, not a field-mapping
    shim over it — EmailPlan's actual fields (hero_image_brief, no cta/
    text_overlay/visual_avoid) are genuinely different from StaticImagePlan's,
    and forcing them into the same shape would be more confusing than a
    small amount of duplicated structure. Always called with
    build_static_image_playbook(include_text=False) as the system prompt.
    """
    identity = bko.get("identity") or {}
    visual_identity = (bko.get("brand") or {}).get("visual_identity") or {}

    lines = [
        "## This email's hero image",
        f"platform: email",
        f"role_in_campaign: {asset.get('role_in_campaign')}",
        f"angle: {asset.get('angle')}",
        f"hero_product (name): {asset.get('hero_product')}",
        f"target_emotion: {asset.get('target_emotion')}",
        f"key_message: {asset.get('key_message')}",
        f"draft creative direction (hero_image_brief, NOT final — write your own): {asset.get('hero_image_brief')}",
        f"compliance_notes: {asset.get('compliance_notes') or 'none'}",
        "",
        "## Campaign context",
        f"campaign_theme: {strategy_doc.get('campaign_theme')}",
        f"target_emotion (campaign-level): {strategy_doc.get('target_emotion')}",
        f"what_to_avoid: {strategy_doc.get('what_to_avoid')}",
        f"special_brief: {special_brief or 'none'}",
        f"tone_override: {tone_override or 'none'}",
        "",
        "## Brand",
        f"business description: {identity.get('description')}",
        f"business_type: {identity.get('business_type')}",
        f"primary_colors: {visual_identity.get('primary_colors')}",
        f"secondary_colors: {visual_identity.get('secondary_colors')}",
        f"imagery_style: {visual_identity.get('imagery_style')}",
        f"design_aesthetic: {visual_identity.get('design_aesthetic')}",
        f"visual_do: {visual_identity.get('visual_do')}",
        f"visual_dont: {visual_identity.get('visual_dont')}",
        f"ad_style_preference: {(bko.get('marketing_context') or {}).get('ad_style_preference')}",
        "",
        "## Real reference images actually available for this asset",
        f"resolved_product_name: {brand_assets_available.get('product_name')}",
        f"product_image_available: {brand_assets_available.get('product_image_available')}",
        "logo_available: false  (the logo is never composited into an email hero image — "
        "it belongs in the email's header, rendered separately)",
        "(Only set use_product_image true when product_image_available above is true. "
        "Always set use_logo false for this asset.)",
    ]

    return "\n".join(lines)


# ── Email template — Phase 2: layout/style decision (never touches copy) ──────

EMAIL_LAYOUT_PLAYBOOK = """\
You are an email art director. You do not write copy — every word of this
email is already final. Your only job is to choose how it should look:
which template best suits this brand and this specific email, and how to
apply the brand's visual identity within that template's fixed structure.

## What you're choosing between
- hero_banner — full-width hero image up top, headline immediately below,
  single CTA-forward layout. Suits bold, vibrant, playful brands.
- minimal_text_forward — small inset hero or none, generous whitespace,
  text-led. Suits clean/minimal or corporate brands.
- story_long_form — larger hero, more generous paragraph spacing, editorial
  feel. Suits warm, narrative, story-driven brand voices.
- product_split — hero image and headline side-by-side (stacks on mobile),
  product-forward. Suits luxury or dark/tech-forward brands.

## How to decide
Read design_aesthetic, ad_style_preference, and layout_notes (the
Strategist's own freeform layout guidance for this specific asset — treat it
as the strongest signal, since it was written with this exact email in mind).
Also weigh role_in_campaign and funnel_stage: a bofu/conversion email
generally wants a more CTA-forward template than a tofu/awareness one.

## Output rules
- Return ONLY a JSON object matching the schema below — no markdown fences,
  no commentary before or after.
- accent_usage and reasoning are short — one or two sentences each.

## Output schema
{
  "template_name": "hero_banner",
  "hero_treatment": "full_width_banner",
  "button_style": "solid_rounded",
  "accent_usage": "one short sentence on how to apply the brand's palette within this template",
  "reasoning": "one short sentence on why this template fits this brand/asset"
}
"""


def build_email_layout_input(*, asset: dict, bko: dict) -> str:
    """Assemble the user prompt for the email layout decision (Phase B.1)."""
    visual_identity = (bko.get("brand") or {}).get("visual_identity") or {}

    return "\n".join([
        "## This email",
        f"role_in_campaign: {asset.get('role_in_campaign')}",
        f"funnel_stage: {asset.get('funnel_stage')}",
        f"layout_notes: {asset.get('layout_notes') or 'none given'}",
        "",
        "## Brand visual identity",
        f"design_aesthetic: {visual_identity.get('design_aesthetic')}",
        f"primary_colors: {visual_identity.get('primary_colors')}",
        f"secondary_colors: {visual_identity.get('secondary_colors')}",
        f"font_style: {visual_identity.get('font_style')}",
        f"ad_style_preference: {(bko.get('marketing_context') or {}).get('ad_style_preference')}",
    ])
