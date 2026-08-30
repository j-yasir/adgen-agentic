"""Producer sub-agent skills.

Static-image: a two-phase skill pair (plan_static_image / generate_static_image).
Email template: reuses the same image machinery for its hero image
(plan_email_hero_image), adds its own layout decision (plan_email_layout,
never touches copy) and a pure-code render step (render_email_template).

All LLM calls share the same calling shape as agents/strategist/skills.py:
.ainvoke() + manual JSON parse/validate + one repair turn — not
.with_structured_output(), matching the established reason: kie.ai's proxy
has quirks around tool-call-style structured output.
"""

from __future__ import annotations

from pathlib import Path
from typing import Type, TypeVar

from jinja2 import Environment, FileSystemLoader, select_autoescape
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, ValidationError

from agents.producer.brand_assets import BrandAssetResolution
from agents.producer.prompts import (
    EMAIL_LAYOUT_PLAYBOOK,
    build_email_hero_input,
    build_email_layout_input,
    build_static_image_input,
    build_static_image_playbook,
)
from agents.producer.schemas import EmailTemplateDecision, GeneratedAsset, StaticImageGenPlan
from agents.producer.validation import ProducerError
from agents.strategist.validation import parse_json_object
from utils import storage
from utils.LLM.factory import get_llm_model
from utils.LLM.schemas import LLMConfig
from utils.logger import get_logger
from utils.MediaGen import ImageRequest, MediaGenConfig, MediaGenResponse, MediaGenService
from utils.retry import call_with_retries

logger = get_logger(__name__)

_PLANNING_LLM_CONFIG = LLMConfig(
    provider="kie",
    model_name="gemini-2.5-flash",
    temperature=0.5,
    max_tokens=2000,
)

_LAYOUT_LLM_CONFIG = LLMConfig(
    provider="kie",
    model_name="gemini-2.5-flash",
    temperature=0.4,
    max_tokens=500,   # small — this call never sees or writes copy
)

T = TypeVar("T", bound=BaseModel)


def _content_to_text(content) -> str:
    """Gemini via kie sometimes returns a list of content parts."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [p.get("text", "") if isinstance(p, dict) else str(p) for p in content]
        return "".join(parts)
    return str(content)


async def _call_llm(system_prompt: str, user_prompt: str, config: LLMConfig, label: str) -> str:
    llm = get_llm_model(config)

    async def _once() -> str:
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])
        return _content_to_text(response.content)

    return await call_with_retries(_once, label=label)


async def _generate_validated(
    output_model: Type[T],
    system_prompt: str,
    user_prompt: str,
    config: LLMConfig,
    label: str,
) -> T:
    """One flash call → parse → validate, with a single repair turn on failure."""
    raw = await _call_llm(system_prompt, user_prompt, config, label)

    for attempt in (1, 2):
        try:
            return output_model.model_validate(parse_json_object(raw))
        except (ValueError, ValidationError) as exc:
            if attempt == 2:
                raise ProducerError(
                    f"{label}: output failed validation after repair: {exc}"
                ) from exc
            logger.warning("%s: output invalid, running repair turn: %s", label, exc)
            raw = await _call_llm(
                system_prompt,
                f"{user_prompt}\n\n"
                f"## REPAIR\nYour previous response failed validation:\n{exc}\n\n"
                f"Previous response:\n{raw[:3000]}\n\n"
                f"Re-emit the COMPLETE corrected JSON object now — nothing else.",
                config, label,
            )

    raise ProducerError(f"{label}: unreachable")  # pragma: no cover


# ── Static image — Phase 1: creative planning ─────────────────────────────────

async def plan_static_image(
    *,
    asset: dict,
    bko: dict,
    strategy_doc: dict,
    brand_assets: BrandAssetResolution,
    platform_insight: dict | None = None,
    static_image_insights: dict | None = None,
    special_brief: str | None = None,
    tone_override: str | None = None,
    include_text: bool = True,
    include_logo: bool = True,
) -> StaticImageGenPlan:
    """Build the finished nano-banana prompt + composition decisions for one asset.

    include_text/include_logo are False for the email skill's hero-image
    reuse of this same function (see plan_email_hero_image below) — an
    email hero is text-free and never carries the logo (that's a header
    element in the HTML, not part of the photo).
    """
    brand_assets_available = {
        "product_name": brand_assets.product_name,
        "product_image_available": brand_assets.product_image_url is not None,
        "logo_available": (brand_assets.logo_url is not None) and include_logo,
    }
    user_prompt = build_static_image_input(
        asset=asset,
        bko=bko,
        strategy_doc=strategy_doc,
        brand_assets_available=brand_assets_available,
        platform_insight=platform_insight,
        static_image_insights=static_image_insights,
        special_brief=special_brief,
        tone_override=tone_override,
    )
    playbook = build_static_image_playbook(include_text=include_text)
    label = f"plan_static_image[{asset.get('asset_id')}]"
    plan = await _generate_validated(
        StaticImageGenPlan, playbook, user_prompt, _PLANNING_LLM_CONFIG, label,
    )

    # Hard-enforce availability/flags regardless of what the model decided —
    # a gap in resolve_brand_assets(), or a caller-forced flag, must never be
    # silently overridden by a creative call that assumes otherwise.
    if brand_assets.logo_url is None or not include_logo:
        plan.use_logo = False
    if brand_assets.product_image_url is None:
        plan.use_product_image = False

    return plan


# ── Static image — Phase 2: generation (pure code, no LLM) ───────────────────

def _generate_image_file(
    *, prompt: str, image_path: str | None, reference_image_path: str | None,
    aspect_ratio: str, output_path: str,
) -> MediaGenResponse:
    """The actual MediaGen (nano-banana) call. Shared by generate_static_image
    and the email skill's hero-image step — neither wraps LLM logic, both
    just need "prompt + optional references in, image file out"."""
    service = MediaGenService(MediaGenConfig(provider="nano-banana", model_name="nano-banana-pro"))
    return service.generate(ImageRequest(
        prompt=prompt,
        image_path=image_path,
        reference_image_path=reference_image_path,
        aspect_ratio=aspect_ratio,
        output_path=output_path,
    ))


def generate_static_image(
    *,
    asset: dict,
    plan: StaticImageGenPlan,
    brand_assets: BrandAssetResolution,
    campaign_id: str,
) -> GeneratedAsset:
    """Call MediaGen (nano-banana) and save the result. Never raises — a
    failure comes back as a GeneratedAsset(status="failed"), so one bad
    asset never aborts the rest of the batch."""
    asset_id = asset["asset_id"]
    try:
        image_path = brand_assets.product_image_url if plan.use_product_image else None
        reference_image_path = brand_assets.logo_url if plan.use_logo else None
        output_path = storage.asset_output_path(campaign_id, asset_id, "image")

        response = _generate_image_file(
            prompt=plan.final_prompt, image_path=image_path,
            reference_image_path=reference_image_path,
            aspect_ratio=asset["format"], output_path=output_path,
        )

        if not response.success:
            return GeneratedAsset(
                asset_id=asset_id, asset_type="image",
                platform=asset["platform"], format=asset["format"],
                prompt_used=plan.final_prompt, status="failed",
                error=response.error or "MediaGen generation failed with no error message.",
            )

        return GeneratedAsset(
            asset_id=asset_id, asset_type="image",
            platform=asset["platform"], format=asset["format"],
            storage_url=response.output_path or output_path,
            prompt_used=plan.final_prompt, status="stored",
        )
    except Exception as exc:  # noqa: BLE001 — deliberate: isolate this asset's failure from the batch
        logger.exception("generate_static_image failed asset_id=%s", asset_id)
        return GeneratedAsset(
            asset_id=asset_id, asset_type="image",
            platform=asset["platform"], format=asset["format"],
            prompt_used=plan.final_prompt,
            status="failed", error=str(exc),
        )


# ── Email — Step 1: hero image (reuses the static-image machinery) ───────────

_EMAIL_HERO_ASPECT_RATIO = "16:9"


async def plan_email_hero_image(
    *,
    asset: dict,
    bko: dict,
    strategy_doc: dict,
    brand_assets: BrandAssetResolution,
    special_brief: str | None = None,
    tone_override: str | None = None,
) -> StaticImageGenPlan:
    """Phase 1, reused: same call shape as plan_static_image, but with its
    own EmailPlan-shaped input builder (hero_image_brief, not image_prompt —
    see build_email_hero_input's docstring for why this isn't a field-mapping
    shim over the static-image builder) and include_text=False always."""
    brand_assets_available = {
        "product_name": brand_assets.product_name,
        "product_image_available": brand_assets.product_image_url is not None,
        "logo_available": False,
    }
    user_prompt = build_email_hero_input(
        asset=asset, bko=bko, strategy_doc=strategy_doc,
        brand_assets_available=brand_assets_available,
        special_brief=special_brief, tone_override=tone_override,
    )
    playbook = build_static_image_playbook(include_text=False)
    label = f"plan_email_hero_image[{asset.get('asset_id')}]"
    plan = await _generate_validated(
        StaticImageGenPlan, playbook, user_prompt, _PLANNING_LLM_CONFIG, label,
    )

    plan.use_logo = False   # logo is a header element in the HTML, never in the hero photo
    if brand_assets.product_image_url is None:
        plan.use_product_image = False

    return plan


def generate_email_hero_image(
    *, asset: dict, plan: StaticImageGenPlan, brand_assets: BrandAssetResolution, campaign_id: str,
) -> str | None:
    """Pure code — calls MediaGen and returns the saved file path, or None on
    failure. Unlike generate_static_image, this does NOT return a
    GeneratedAsset: the hero image is an intermediate artifact consumed by
    the HTML render step, not a deliverable of its own — no assets-table row
    for it."""
    asset_id = asset["asset_id"]
    try:
        image_path = brand_assets.product_image_url if plan.use_product_image else None
        output_path = storage.asset_output_path(campaign_id, f"{asset_id}_hero", "image")

        response = _generate_image_file(
            prompt=plan.final_prompt, image_path=image_path, reference_image_path=None,
            aspect_ratio=_EMAIL_HERO_ASPECT_RATIO, output_path=output_path,
        )
        if not response.success:
            logger.warning("Email hero image failed asset_id=%s error=%s", asset_id, response.error)
            return None
        return response.output_path or output_path
    except Exception:
        logger.exception("generate_email_hero_image failed asset_id=%s", asset_id)
        return None


# ── Email — Step 2: layout decision (never touches copy) ─────────────────────

async def plan_email_layout(*, asset: dict, bko: dict) -> EmailTemplateDecision:
    user_prompt = build_email_layout_input(asset=asset, bko=bko)
    label = f"plan_email_layout[{asset.get('asset_id')}]"
    return await _generate_validated(
        EmailTemplateDecision, EMAIL_LAYOUT_PLAYBOOK, user_prompt, _LAYOUT_LLM_CONFIG, label,
    )


# ── Email — Step 3: template render (pure code, no LLM) ──────────────────────

_TEMPLATES_DIR = Path(__file__).parent / "templates"
_jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)

_BUTTON_CSS = {
    "solid_rounded": "display:inline-block; padding:12px 28px; background-color:{color}; color:#ffffff; "
                      "text-decoration:none; border-radius:24px; font-weight:bold; font-size:15px;",
    "solid_square":  "display:inline-block; padding:12px 28px; background-color:{color}; color:#ffffff; "
                      "text-decoration:none; border-radius:2px; font-weight:bold; font-size:15px;",
    "outline":       "display:inline-block; padding:11px 27px; background-color:transparent; color:{color}; "
                      "text-decoration:none; border:1px solid {color}; border-radius:24px; font-weight:bold; font-size:15px;",
}


def render_email_template(
    *,
    email_plan: dict,
    decision: EmailTemplateDecision,
    hero_image_url: str | None,
    logo_url: str | None,
    sender_name: str,
    website_url: str | None,
    secondary_links: dict[str, str] | None,
    primary_color: str,
) -> str:
    """Pure code — fills the template decision picked with EmailPlan's copy,
    verbatim, never re-generated. Jinja2 auto-escapes body_paragraphs/headline
    (LLM-generated text) by default."""
    template = _jinja_env.get_template(f"{decision.template_name}.html")

    body_paragraphs = email_plan.get("body_paragraphs") or []
    button_css = _BUTTON_CSS[decision.button_style].format(color=primary_color)

    return template.render(
        subject_line=email_plan.get("subject_line", ""),
        preview_text=email_plan.get("preview_text", ""),
        headline=email_plan.get("headline", ""),
        intro_paragraph=body_paragraphs[0] if body_paragraphs else None,
        remaining_paragraphs=body_paragraphs[1:],
        cta_text=email_plan.get("cta_text", ""),
        cta_url=email_plan.get("cta_url", "#"),
        disclosures=email_plan.get("disclosures") or [],
        hero_image_url=hero_image_url,
        logo_url=logo_url,
        sender_name=sender_name,
        website_url=website_url,
        secondary_links=secondary_links or {},
        primary_color=primary_color,
        button_css=button_css,
    )
