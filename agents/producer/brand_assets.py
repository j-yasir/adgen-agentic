"""Brand asset resolution for the Builder (Producer) agent.

Storing real logo/product images and *using* them for generation are separate
problems. `bko` (as handed to every pipeline node by `load_bko`) already has
real products/images assembled in — see
`services/business_service.assemble_products_into_bko`. This module is the
missing link: given one asset being built, decide which real file(s), if any,
to ground generation in, with an explicit gap signal when nothing resolves so
the caller can make an informed fallback decision instead of silently
proceeding as if brand grounding didn't matter.

Pure, DB-free code — everything it needs is already in the `bko` dict.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class BrandAssetResolution(BaseModel):
    logo_url: str | None = None
    product_id: str | None = None
    product_name: str | None = None
    product_image_url: str | None = None
    product_image_gallery: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)


def _match_product(products: list[dict], hero_product: str | None) -> dict | None:
    """Find the product this asset is about.

    Matching mirrors `agents/strategist/validation.py::validate_plan`'s own
    leniency (case-insensitive substring match either direction) — the
    `hero_product` string reaching this function passed through that same
    validation upstream, so this is a lookup, not a fuzzy-match problem.
    """
    if hero_product:
        needle = hero_product.strip().lower()
        for p in products:
            name = (p.get("name") or "").strip().lower()
            if name and (needle in name or name in needle):
                return p

    # No hero_product given, or it didn't match anything — fall back to
    # whichever product is flagged as hero (assemble_products_into_bko sorts
    # is_hero first, so this is the first is_hero=True entry).
    for p in products:
        if p.get("is_hero"):
            return p

    return None


def resolve_brand_assets(
    bko: dict,
    hero_product: str | None,
    *,
    logo_override: str | None = None,
    product_image_override: str | None = None,
) -> BrandAssetResolution:
    """Resolve the real logo/product image to ground one asset's generation in.

    Precedence (mirrors the `tone_override` pattern already used for the
    Strategist — see `agents/strategist/prompts.py`):
        logo:          logo_override        > bko.identity.logo_url        > None
        product image: product_image_override > product's primary image    > None

    `hero_product` is normally `AssetStrategy.hero_product` from the
    StrategyDoc — i.e. resolution happens once per asset, not once per
    campaign, since different assets in the same campaign can feature
    different products.
    """
    identity = bko.get("identity") or {}
    offerings = bko.get("offerings") or {}
    products = offerings.get("products_services") or []

    gaps: list[str] = []

    logo_url = logo_override or identity.get("logo_url") or None
    if not logo_url:
        gaps.append("no_logo")

    product = _match_product(products, hero_product)
    if product is None:
        gaps.append("no_product_match")
        return BrandAssetResolution(logo_url=logo_url, gaps=gaps)

    gallery = list(product.get("image_urls") or [])
    product_image_url = product_image_override or (gallery[0] if gallery else None)
    if not product_image_url:
        gaps.append("no_product_image")

    return BrandAssetResolution(
        logo_url=logo_url,
        product_id=product.get("id"),
        product_name=product.get("name"),
        product_image_url=product_image_url,
        product_image_gallery=gallery,
        gaps=gaps,
    )
