"""
Seeds a fully pre-built demo account (businesses, products, product images,
campaigns, generated assets, events) into any user's account — built from the
static snapshot at seed_data/ (see scripts/export_seed_data.py for how that
snapshot is produced).

Every ID (business, product, image, campaign, asset) is freshly generated at
seed time — never reused from the source account — so seeding never collides
with, or is traceable back to, the original exported account. Files are
copied (not moved/linked) from seed_data/ into the real business_assets/ and
generations/ trees under the new IDs.
"""

from __future__ import annotations

import json
import shutil
import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from repos import business_repo, campaign_repo, product_repo
from utils.exceptions import ConflictError, NotFoundError
from utils.logger import get_logger

logger = get_logger(__name__)

SEED_DIR = Path("seed_data")
FIXTURES_PATH = SEED_DIR / "fixtures.json"


def _remap_id_segment(original_path: str, index: int, new_id: str) -> str:
    """Swap one path segment (by index) of a business_assets/... or
    generations/... relative path for a freshly generated id, leaving every
    other segment (subfolders, filename) unchanged."""
    parts = list(Path(original_path).parts)
    parts[index] = new_id
    return str(Path(*parts))


def _copy_seed_file(seed_relative_path: str, dest_relative_path: str) -> None:
    src = SEED_DIR / seed_relative_path
    dest = Path(dest_relative_path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)


def seed_demo_data(db: Session, user_id: uuid.UUID | str, *, force: bool = False) -> dict:
    if not FIXTURES_PATH.exists():
        raise NotFoundError(
            "No seed data found at seed_data/fixtures.json — run "
            "`python -m scripts.export_seed_data --email <account>` first."
        )

    if not force:
        existing = business_repo.get_all_for_user(db, user_id)
        if existing:
            raise ConflictError(
                "This account already has businesses. Pass force=true to seed "
                "anyway — this ADDS the demo data alongside what's already "
                "there, it does not replace or deduplicate it."
            )

    fixtures = json.loads(FIXTURES_PATH.read_text(encoding="utf-8"))

    counts = {"businesses": 0, "products": 0, "product_images": 0,
              "campaigns": 0, "assets": 0, "events": 0}

    for biz_fixture in fixtures["businesses"]:
        bko = dict(biz_fixture["bko"])

        business = business_repo.create(
            db, user_id=user_id, name=biz_fixture["name"], website=biz_fixture["website"],
            industry=biz_fixture["industry"], bko=bko,
            onboarding_path=biz_fixture["onboarding_path"],
            onboarding_status=biz_fixture["onboarding_status"],
        )
        new_business_id = str(business["id"])
        counts["businesses"] += 1

        if biz_fixture.get("logo_file"):
            new_logo_path = _remap_id_segment(biz_fixture["logo_file"], 1, new_business_id)
            _copy_seed_file(biz_fixture["logo_file"], new_logo_path)
            bko.setdefault("identity", {})["logo_url"] = new_logo_path
            business_repo.update_bko(
                db, business_id=new_business_id, user_id=user_id,
                bko=bko, onboarding_status=biz_fixture["onboarding_status"],
            )

        for event in biz_fixture.get("events", []):
            business_repo.insert_event(
                db, business_id=new_business_id, event_type=event["event_type"],
                agent=event["agent"], payload=event["payload"],
            )
            counts["events"] += 1

        for product_fixture in biz_fixture["products"]:
            product = product_repo.create(
                db, business_id=new_business_id, user_id=user_id,
                name=product_fixture["name"], type=product_fixture["type"],
                is_hero=product_fixture["is_hero"], description=product_fixture["description"],
                key_features=product_fixture["key_features"], benefits=product_fixture["benefits"],
                pricing_model=product_fixture["pricing_model"], pricing_tier=product_fixture["pricing_tier"],
                pricing_details=product_fixture["pricing_details"],
                unique_selling_points=product_fixture["unique_selling_points"],
                target_use_case=product_fixture["target_use_case"],
            )
            new_product_id = str(product["id"])
            counts["products"] += 1

            # Insert in the original primary-first order (already guaranteed
            # by the export's own query ordering) — sp_add_product_image
            # auto-sets is_primary on the FIRST image inserted for a product,
            # so preserving order reproduces the original primary image
            # without a separate set_primary_image() call.
            for image_fixture in product_fixture["images"]:
                new_image_path = _remap_id_segment(image_fixture["file"], 1, new_business_id)
                new_image_path = _remap_id_segment(new_image_path, 3, new_product_id)
                _copy_seed_file(image_fixture["file"], new_image_path)
                product_repo.add_image(
                    db, product_id=new_product_id, user_id=user_id, storage_url=new_image_path,
                )
                counts["product_images"] += 1

        for campaign_fixture in biz_fixture["campaigns"]:
            campaign = campaign_repo.create(
                db, user_id=user_id, business_id=new_business_id,
                campaign_name=campaign_fixture["campaign_name"], objective=campaign_fixture["objective"],
                platforms=campaign_fixture["platforms"], asset_types=campaign_fixture["asset_types"],
                funnel_stage=campaign_fixture["funnel_stage"], num_variants=campaign_fixture["num_variants"],
                hero_products=campaign_fixture["hero_products"],
                tone_override=campaign_fixture["tone_override"],
                special_brief=campaign_fixture["special_brief"],
            )
            new_campaign_id = str(campaign["id"])
            counts["campaigns"] += 1

            # Copy the whole generations/{campaign_id}/ tree first (JSON
            # snapshots included) so the individual per-asset copies below
            # land in an already-existing, correctly-named folder.
            if campaign_fixture.get("generations_dir"):
                dest_gen_dir = _remap_id_segment(campaign_fixture["generations_dir"], 1, new_campaign_id)
                shutil.copytree(SEED_DIR / campaign_fixture["generations_dir"], dest_gen_dir, dirs_exist_ok=True)

            campaign_repo.update_status(
                db, campaign_id=new_campaign_id, status=campaign_fixture["status"],
                strategy_doc=campaign_fixture["strategy_doc"], audit_score=campaign_fixture["audit_score"],
                error=campaign_fixture["error"], resumable=campaign_fixture["resumable"],
                failed_node=campaign_fixture["failed_node"],
            )

            for asset_fixture in campaign_fixture["assets"]:
                storage_url = ""
                if asset_fixture.get("file"):
                    storage_url = _remap_id_segment(asset_fixture["file"], 1, new_campaign_id)
                    # Already copied via the whole-tree copytree above when
                    # generations_dir was present; copy individually as a
                    # fallback for the (rare) case that tree was missing.
                    if not Path(storage_url).exists():
                        _copy_seed_file(asset_fixture["file"], storage_url)
                campaign_repo.create_asset(
                    db, campaign_id=new_campaign_id, platform=asset_fixture["platform"],
                    format=asset_fixture["format"], asset_type=asset_fixture["asset_type"],
                    storage_url=storage_url, prompt_used=asset_fixture["prompt_used"],
                    metadata=asset_fixture["metadata"], status=asset_fixture["status"],
                )
                counts["assets"] += 1

            for event in campaign_fixture.get("events", []):
                campaign_repo.insert_event(
                    db, campaign_id=new_campaign_id, event_type=event["event_type"],
                    agent=event["agent"], payload=event["payload"],
                )
                counts["events"] += 1

    logger.info("Seeded demo data for user_id=%s: %s", user_id, counts)
    return counts
