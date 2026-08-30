"""Producer pipeline — routes each StrategyDoc asset_plan entry to a
sub-agent by asset_type, like the Strategist routes copy skills by asset_type.

static_image and email are implemented. video_ad is not built yet (no video/
voice generation provider exists anywhere in this codebase — see
docs/agents/BUILDER_AGENT_DATA_AUDIT.md §4) — entries of that type are logged
and omitted from the returned list rather than forced into a misleading DB
state (assets.status has no 'skipped' value).

Not a ReAct agent: this mirrors agents/strategist/graph.py's own reasoning —
a fixed, mostly-deterministic per-asset pipeline with targeted LLM calls,
not open-ended tool-calling.
"""

from __future__ import annotations

import asyncio
from typing import Callable

from agents.producer.brand_assets import resolve_brand_assets
from agents.producer.schemas import GeneratedAsset
from agents.producer.skills import (
    generate_email_hero_image,
    generate_static_image,
    plan_email_hero_image,
    plan_email_layout,
    plan_static_image,
    render_email_template,
)
from agents.strategist.schemas import AssetPlanAdapter
from utils import storage
from utils.logger import get_logger

logger = get_logger(__name__)

_CONCURRENCY = 3  # MediaGen calls poll for up to ~6 minutes each (_kie_ai_base.py)
_DEFAULT_ACCENT_COLOR = "#4f46e5"


def _product_image_override(bko: dict, product_id: str | None) -> str | None:
    if not product_id:
        return None
    products = ((bko.get("offerings") or {}).get("products_services")) or []
    for product in products:
        if product.get("id") == product_id:
            gallery = product.get("image_urls") or []
            return gallery[0] if gallery else None
    return None


def _matching_platform_insight(research_report: dict | None, platform: str) -> dict | None:
    if not research_report:
        return None
    for insight in research_report.get("platform_insights") or []:
        if insight.get("platform") == platform:
            return insight
    return None


def _to_url_path(storage_path: str | None) -> str | None:
    """Local disk paths are served at a root-relative URL — see
    api/main.py's StaticFiles mounts. generations/... maps straight through
    to /generations/..., but business_assets/... (disk, underscore) is
    mounted at /business-assets/... (URL, hyphen) — mirrors
    frontend/src/shared/lib/utils.ts::toAssetUrl()'s exact same rewrite, kept
    in sync deliberately since both convert the same raw storage_url shape.
    Root-relative, not fully-qualified: fine for browser viewing (iframe/
    direct), not yet for real email sending (no SMTP/ESP integration exists
    — see EMAIL_TEMPLATE_AGENT.md §8)."""
    if not storage_path:
        return None
    normalized = storage_path.replace("\\", "/").lstrip("/")
    if normalized.startswith("business_assets/"):
        return "/business-assets/" + normalized[len("business_assets/"):]
    return "/" + normalized


async def _run_static_image(
    asset_dict: dict,
    *,
    bko: dict,
    strategy_doc: dict,
    research_report: dict | None,
    special_brief: str | None,
    tone_override: str | None,
    product_overrides: dict[str, str],
    campaign_id: str,
    semaphore: asyncio.Semaphore,
    on_event: Callable | None = None,
) -> GeneratedAsset:
    asset_id = asset_dict["asset_id"]
    platform = asset_dict.get("platform", "?")
    emit = on_event or (lambda *_: None)

    async with semaphore:
        try:
            override_id = product_overrides.get(asset_id)
            brand_assets = resolve_brand_assets(
                bko,
                asset_dict.get("hero_product"),
                product_image_override=_product_image_override(bko, override_id),
            )
            static_insights = ((research_report or {}).get("asset_type_insights") or {}).get("static_image")

            emit("tool_call", {
                "tool": "plan_image",
                "platform": platform,
                "message": f"Planning {platform} image composition for {asset_dict.get('hero_product', 'product')}…",
            })
            plan = await plan_static_image(
                asset=asset_dict,
                bko=bko,
                strategy_doc=strategy_doc,
                brand_assets=brand_assets,
                platform_insight=_matching_platform_insight(research_report, asset_dict.get("platform")),
                static_image_insights=static_insights,
                special_brief=special_brief,
                tone_override=tone_override,
            )
            emit("tool_result", {
                "tool": "plan_image",
                "platform": platform,
                "message": f"Visual plan ready — sending {platform} to image generator…",
            })

            emit("tool_call", {
                "tool": "generate_static_image",
                "platform": platform,
                "message": f"Generating {platform} image (this takes a moment)…",
            })
            result = generate_static_image(
                asset=asset_dict, plan=plan, brand_assets=brand_assets, campaign_id=campaign_id,
            )
            emit("tool_result", {
                "tool": "generate_static_image",
                "platform": platform,
                "message": f"{platform} image generated and saved ✓",
            })
            return result
        except Exception as exc:  # noqa: BLE001 — isolate this asset's failure from the batch
            logger.exception("Static image asset failed asset_id=%s", asset_id)
            emit("tool_result", {
                "tool": "generate_static_image",
                "platform": platform,
                "message": f"{platform} image failed: {str(exc)[:60]}",
            })
            return GeneratedAsset(
                asset_id=asset_id, asset_type="image",
                platform=asset_dict.get("platform", "unknown"),
                format=asset_dict.get("format", "unknown"),
                status="failed", error=str(exc),
            )


async def _run_email_template(
    asset_dict: dict,
    *,
    bko: dict,
    strategy_doc: dict,
    special_brief: str | None,
    tone_override: str | None,
    product_overrides: dict[str, str],
    secondary_links: dict[str, str],
    campaign_id: str,
    semaphore: asyncio.Semaphore,
    on_event: Callable | None = None,
) -> GeneratedAsset:
    asset_id = asset_dict["asset_id"]
    emit = on_event or (lambda *_: None)

    async with semaphore:
        try:
            override_id = product_overrides.get(asset_id)
            brand_assets = resolve_brand_assets(
                bko,
                asset_dict.get("hero_product"),
                product_image_override=_product_image_override(bko, override_id),
            )

            emit("tool_call", {
                "tool": "plan_email_hero_image",
                "message": "Planning email layout and hero image composition…",
            })
            # Steps 1 (hero image) and 2 (layout decision) are independent —
            # run concurrently, per the approved architecture (EMAIL_TEMPLATE_AGENT.md §4).
            hero_plan, decision = await asyncio.gather(
                plan_email_hero_image(
                    asset=asset_dict, bko=bko, strategy_doc=strategy_doc,
                    brand_assets=brand_assets, special_brief=special_brief, tone_override=tone_override,
                ),
                plan_email_layout(asset=asset_dict, bko=bko),
            )
            emit("tool_result", {
                "tool": "plan_email_hero_image",
                "message": "Email plan ready — generating hero image…",
            })

            emit("tool_call", {
                "tool": "generate_email_hero",
                "message": "Generating email hero image…",
            })
            hero_image_path = generate_email_hero_image(
                asset=asset_dict, plan=hero_plan, brand_assets=brand_assets, campaign_id=campaign_id,
            )
            emit("tool_result", {
                "tool": "generate_email_hero",
                "message": "Hero image ready — rendering email template…",
            })

            identity = bko.get("identity") or {}
            visual_identity = (bko.get("brand") or {}).get("visual_identity") or {}
            primary_colors = visual_identity.get("primary_colors") or []
            primary_color = primary_colors[0] if primary_colors else _DEFAULT_ACCENT_COLOR

            emit("tool_call", {
                "tool": "render_email",
                "message": "Assembling final email template with branding…",
            })
            html = render_email_template(
                email_plan=asset_dict,
                decision=decision,
                hero_image_url=_to_url_path(hero_image_path),
                logo_url=_to_url_path(brand_assets.logo_url),
                sender_name=identity.get("company_name") or "",
                website_url=identity.get("website"),
                secondary_links=secondary_links,
                primary_color=primary_color,
            )

            output_path = storage.asset_output_path(campaign_id, asset_id, "email")
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(html)

            emit("tool_result", {
                "tool": "render_email",
                "message": "Email template rendered and saved ✓",
            })
            return GeneratedAsset(
                asset_id=asset_id, asset_type="email",
                platform=asset_dict.get("platform", "email"), format=asset_dict.get("format", "email"),
                storage_url=output_path,
                prompt_used=hero_plan.final_prompt,
                status="stored",
                metadata={
                    "subject_line": asset_dict.get("subject_line"),
                    "preview_text": asset_dict.get("preview_text"),
                    "sender_name": identity.get("company_name"),
                    "template_used": decision.template_name,
                },
            )
        except Exception as exc:  # noqa: BLE001 — isolate this asset's failure from the batch
            logger.exception("Email asset failed asset_id=%s", asset_id)
            emit("tool_result", {
                "tool": "render_email",
                "message": f"Email template failed: {str(exc)[:60]}",
            })
            return GeneratedAsset(
                asset_id=asset_id, asset_type="email",
                platform=asset_dict.get("platform", "email"),
                format=asset_dict.get("format", "email"),
                status="failed", error=str(exc),
            )


class ProducerPipeline:
    SUPPORTED_TYPES = {"static_image", "email"}
    # Formats that cannot be image-generated (text-only ad units)
    TEXT_ONLY_FORMATS = {"search_ad", "responsive", "banner"}

    async def ainvoke(self, state: dict, on_event: Callable | None = None) -> dict:
        strategy_doc = state["strategy_doc"] or {}
        raw_asset_plan = strategy_doc.get("asset_plan") or []
        bko = state["bko"]
        campaign_id = state["campaign_id"]
        product_overrides = state.get("product_overrides") or {}
        secondary_links = state.get("secondary_links") or {}

        semaphore = asyncio.Semaphore(_CONCURRENCY)
        tasks = []
        for raw_asset in raw_asset_plan:
            asset_type = raw_asset.get("asset_type")
            asset_format = raw_asset.get("format", "")
            if asset_type not in self.SUPPORTED_TYPES or asset_format in self.TEXT_ONLY_FORMATS:
                logger.info(
                    "Skipping asset_id=%s asset_type=%s format=%s — not yet implemented",
                    raw_asset.get("asset_id"), asset_type, asset_format,
                )
                continue

            typed_asset = AssetPlanAdapter.validate_python(raw_asset)
            asset_dict = typed_asset.model_dump()

            if asset_type == "static_image":
                tasks.append(_run_static_image(
                    asset_dict,
                    bko=bko,
                    strategy_doc=strategy_doc,
                    research_report=state.get("research_report"),
                    special_brief=state.get("special_brief"),
                    tone_override=state.get("tone_override"),
                    product_overrides=product_overrides,
                    campaign_id=campaign_id,
                    semaphore=semaphore,
                    on_event=on_event,
                ))
            elif asset_type == "email":
                tasks.append(_run_email_template(
                    asset_dict,
                    bko=bko,
                    strategy_doc=strategy_doc,
                    special_brief=state.get("special_brief"),
                    tone_override=state.get("tone_override"),
                    product_overrides=product_overrides,
                    secondary_links=secondary_links.get(asset_dict["asset_id"], {}),
                    campaign_id=campaign_id,
                    semaphore=semaphore,
                    on_event=on_event,
                ))

        results: list[GeneratedAsset] = await asyncio.gather(*tasks) if tasks else []
        return {"generated_assets": [asset.model_dump() for asset in results]}


producer_agent = ProducerPipeline()
