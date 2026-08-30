"""Deterministic validation for the strategist pipeline.

Everything here is pure code — no LLM calls. Violations are returned as
human-readable strings so they can be quoted back to the model verbatim in a
repair turn.
"""

from __future__ import annotations

import json
import re
import unicodedata
from typing import Any

from agents.strategist.schemas import AssetBrief, DistributionPlan

# Fullwidth → ASCII map for characters the kie.ai proxy substitutes.
_FULLWIDTH_MAP = str.maketrans(
    "＆＊＠！？，。；：",
    "&*@!?,.;:",
)

def _norm(s: str) -> str:
    """Normalise a product name for fuzzy comparison.

    Converts fullwidth Unicode punctuation (e.g. ＆ → &) that LLMs sometimes
    emit when the kie.ai proxy has mangled the input, then lowercases.
    """
    return unicodedata.normalize("NFKC", s).translate(_FULLWIDTH_MAP).lower()


class StrategistError(Exception):
    """Raised when a pipeline stage cannot produce valid output after repairs."""

    def __init__(self, message: str, violations: list[str] | None = None):
        super().__init__(message)
        self.violations = violations or []


# ── JSON extraction ───────────────────────────────────────────────────────────

def parse_json_object(text: str) -> dict:
    """Extract a JSON object from an LLM response.

    Tolerates markdown fences and prose around the object; raises ValueError
    with a repair-friendly message when no valid object is found.
    """
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in the response.")

    try:
        parsed = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON: {exc}") from exc

    if not isinstance(parsed, dict):
        raise ValueError("Top-level JSON value must be an object.")
    return parsed


# ── Plan-level rules ──────────────────────────────────────────────────────────

# Which formats are legal on which platform.
PLATFORM_FORMATS: dict[str, set[str]] = {
    "instagram": {"9:16", "4:5", "1:1"},
    "facebook":  {"9:16", "4:5", "1:1", "16:9"},
    "tiktok":    {"9:16"},
    "youtube":   {"9:16", "16:9"},
    "google":    {"1:1", "16:9", "search_ad", "responsive", "banner"},
    "linkedin":  {"1:1", "4:5", "16:9"},
    "email":     {"email"},
}

# Fallback video duration ceilings (seconds) when research provides no ad_specs.
DEFAULT_MAX_DURATION: dict[str, int] = {
    "tiktok": 60,
    "instagram": 90,
    "facebook": 90,
    "youtube": 60,
}


def _known_product_names(state: dict) -> list[str]:
    products = ((state.get("bko") or {}).get("offerings") or {}).get("products_services") or []
    names = [p.get("name", "") for p in products if isinstance(p, dict) and p.get("name")]
    names += [n for n in (state.get("hero_products") or []) if n]
    return names


def validate_plan(plan: DistributionPlan, state: dict) -> list[str]:
    """Business rules for the DistributionPlan. Returns violations (empty = valid)."""
    violations: list[str] = []
    briefs = plan.asset_briefs

    num_variants = int(state.get("num_variants") or 3)
    if len(briefs) != num_variants:
        violations.append(
            f"asset_briefs has {len(briefs)} entries but exactly {num_variants} are required."
        )

    ids = [b.asset_id for b in briefs]
    if len(ids) != len(set(ids)):
        violations.append("asset_id values must be unique (found duplicates).")

    # Platform coverage — email assets live on the 'email' pseudo-platform, so
    # only non-email briefs count as social platform slots.
    requested_platforms = set(state.get("platforms") or [])
    social_briefs = [b for b in briefs if b.platform != "email"]
    used_platforms = {b.platform for b in social_briefs}
    missing = requested_platforms - used_platforms
    # Only flag if there are enough social slots to cover every platform.
    if missing and len(social_briefs) >= len(requested_platforms):
        platform_hints = []
        if "google" in missing:
            platform_hints.append(
                "For Google, add a static_image asset with format '1:1' or '16:9' "
                "(display ad) — or 'search_ad'/'responsive'/'banner' for text-only."
            )
        hint = (" " + " ".join(platform_hints)) if platform_hints else ""
        violations.append(
            f"Requested platforms not covered by any asset: {sorted(missing)}. "
            f"You MUST include at least one asset_brief for EACH of these platforms.{hint}"
        )

    # Asset-type coverage when the variant count allows it.
    requested_types = set(state.get("asset_types") or [])
    used_types = {b.asset_type for b in briefs}
    missing_types = requested_types - used_types
    if missing_types and len(briefs) >= len(requested_types):
        violations.append(
            f"Requested asset types not covered: {sorted(missing_types)}."
        )
    extra_types = used_types - requested_types if requested_types else set()
    if extra_types:
        violations.append(
            f"Asset types used that were not requested: {sorted(extra_types)}. "
            f"You MUST use ONLY these asset types: {sorted(requested_types)}. "
            f"For TikTok without video_ad, use static_image with format 9:16 instead."
        )

    for b in briefs:
        # Type/platform pairing
        if b.asset_type == "email" and b.platform != "email":
            violations.append(f"{b.asset_id}: email assets must use platform 'email'.")
        if b.asset_type != "email" and b.platform == "email":
            violations.append(f"{b.asset_id}: platform 'email' is only valid for email assets.")

        # Format legality
        legal = PLATFORM_FORMATS.get(b.platform, set())
        if b.format not in legal:
            violations.append(
                f"{b.asset_id}: format '{b.format}' is not valid for {b.platform} "
                f"(valid: {sorted(legal)})."
            )

    # Funnel-stage pinning — only "balanced" campaigns may vary per asset.
    requested_funnel = state.get("funnel_stage")
    if requested_funnel and requested_funnel != "balanced":
        for b in briefs:
            if b.funnel_stage != requested_funnel:
                violations.append(
                    f"{b.asset_id}: funnel_stage '{b.funnel_stage}' does not match "
                    f"the campaign's fixed funnel_stage '{requested_funnel}' — only "
                    f"'balanced' campaigns may vary funnel_stage per asset."
                )

    # Hero product existence — every hero_product must be a real BKO product.
    known = _known_product_names(state)
    known_norm = [_norm(n) for n in known]
    if known:
        for b in briefs:
            hp = _norm(b.hero_product)
            if not any(hp in k or k in hp for k in known_norm):
                violations.append(
                    f"{b.asset_id}: hero_product '{b.hero_product}' is not a known "
                    f"product (known: {known})."
                )

    # Hero product SELECTION — when the campaign named specific hero products,
    # every asset must feature one of those exact products, not just any
    # product from the wider BKO catalog (e.g. not the umbrella/parent name).
    campaign_hero_products = [n for n in (state.get("hero_products") or []) if n]
    if campaign_hero_products:
        hero_norm = [_norm(n) for n in campaign_hero_products]
        for b in briefs:
            hp = _norm(b.hero_product)
            if not any(hp in h or h in hp for h in hero_norm):
                violations.append(
                    f"{b.asset_id}: hero_product '{b.hero_product}' must be one of "
                    f"the campaign's specified hero products {campaign_hero_products} "
                    f"— not a different BKO catalog product."
                )
        if len(briefs) > 1 and len(hero_norm) > 1:
            featured = {_norm(b.hero_product) for b in briefs}
            if len(featured) == 1:
                violations.append(
                    "All assets feature the same hero_product — distribute across "
                    "the campaign's specified hero products."
                )
    elif known and len(briefs) > 1 and len(set(known_norm)) > 1:
        # No campaign-specific list was given — fall back to the looser
        # "don't dominate the whole plan with one catalog product" check.
        featured = {_norm(b.hero_product) for b in briefs}
        if len(featured) == 1:
            violations.append(
                "All assets feature the same hero_product — distribute across products."
            )

    return violations


# ── Content-level rules (per asset, after copy generation) ────────────────────

_PLACEHOLDER_RE = re.compile(
    r"\b(TBD|TODO|lorem ipsum|placeholder|insert [a-z]+ here|write (?:something|copy) here)\b",
    re.IGNORECASE,
)

# Words that indicate the model tried to render text inside the image prompt.
_IMAGE_TEXT_RE = re.compile(
    r"\b(text|font|typography|overlay|caption|headline|logo|watermark|lettering)s?\b",
    re.IGNORECASE,
)

# Negated mentions ("no text", "without logos", "avoid any lettering") are
# fine in an image prompt — strip them before scanning for violations.
_NEGATED_IMAGE_TEXT_RE = re.compile(
    r"\b(?:no|without|avoid(?:ing)?|free of|never(?: any)?|not?(?: any)?)\s+(?:any\s+)?"
    r"(?:visible\s+)?(?:text|fonts?|typography|overlays?|captions?|headlines?|logos?|"
    r"watermarks?|lettering|words?|writing)[^.,;]*",
    re.IGNORECASE,
)


def _iter_strings(value: Any):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from _iter_strings(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from _iter_strings(item)


def _compliance_phrases(state: dict) -> list[str]:
    bko = state.get("bko") or {}
    compliance = bko.get("compliance") or {}
    messaging = bko.get("messaging") or {}
    phrases = list(compliance.get("restricted_claims") or [])
    phrases += list(messaging.get("forbidden_topics") or [])
    # Only phrases long enough to be meaningful as a substring match.
    return [p for p in phrases if isinstance(p, str) and len(p.strip()) > 3]


def max_video_duration(state: dict, platform: str) -> int:
    """Resolve the max video duration for a platform from research ad_specs."""
    research = state.get("research_report") or {}
    for insight in research.get("platform_insights") or []:
        if not isinstance(insight, dict) or insight.get("platform") != platform:
            continue
        durations = [
            s.get("max_duration")
            for s in insight.get("ad_specs") or []
            if isinstance(s, dict) and s.get("max_duration")
        ]
        if durations:
            return max(durations)
    return DEFAULT_MAX_DURATION.get(platform, 60)


def validate_copy_content(copy_data: dict, brief: AssetBrief, state: dict) -> list[str]:
    """Content rules for one asset's generated copy. Returns violations."""
    violations: list[str] = []

    all_text = " ".join(_iter_strings(copy_data))

    match = _PLACEHOLDER_RE.search(all_text)
    if match:
        violations.append(f"Placeholder text found: '{match.group(0)}' — write real copy.")

    for phrase in _compliance_phrases(state):
        if phrase.lower() in all_text.lower():
            violations.append(
                f"Compliance violation: copy contains the restricted phrase '{phrase}'."
            )

    if brief.asset_type == "static_image":
        image_prompt = copy_data.get("image_prompt", "")
        scannable = _NEGATED_IMAGE_TEXT_RE.sub("", image_prompt)
        match = _IMAGE_TEXT_RE.search(scannable)
        if match:
            violations.append(
                f"image_prompt contains '{match.group(0)}' — the image prompt must "
                "describe the scene only; all text/overlay direction belongs in "
                "text_overlay."
            )

    if brief.asset_type == "video_ad":
        limit = max_video_duration(state, brief.platform)
        duration = copy_data.get("duration_seconds") or 0
        if duration > limit:
            violations.append(
                f"duration_seconds is {duration} but {brief.platform} allows at most {limit}s."
            )
        script = copy_data.get("script") or []
        if script and not (script[0].get("on_screen_text") or "").strip():
            violations.append(
                "The hook beat (first script entry) has empty on_screen_text — "
                "the hook must work muted."
            )

    if brief.asset_type == "email":
        cta_text = (copy_data.get("cta_text") or "").strip().lower()
        body_paragraphs = copy_data.get("body_paragraphs") or []
        if cta_text and any(
            isinstance(p, str) and p.strip().lower() == cta_text for p in body_paragraphs
        ):
            violations.append(
                f"body_paragraphs contains the CTA text ('{copy_data.get('cta_text')}') "
                "as its own paragraph — remove it; the CTA belongs only in cta_text."
            )

    return violations
