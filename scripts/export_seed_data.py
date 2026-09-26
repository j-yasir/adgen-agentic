"""
One-time export: dump a FULL account (businesses, products, product images,
campaigns, generated assets, events) into seed_data/ at the repo root, so it
can be replayed into any new user's account via POST /seed/demo-data
(services/seed_service.py).

This is a dev-time authoring tool, not an API endpoint — exporting a real
account's full data is something you run deliberately once, not something
worth exposing as a standing HTTP surface.

Run from the project root:
    python -m scripts.export_seed_data --email pipeline-test-1785688123@example.com
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from db.session import SessionLocal
from repos import business_repo, campaign_repo, product_repo, user_repo

SEED_DIR = Path("seed_data")


def _copy_into_seed_dir(relative_path: str | None) -> str | None:
    """Copy a file (given as a repo-root-relative path, e.g.
    'business_assets/<id>/logo.png') into the same relative location under
    seed_data/. Returns the original relative path (used as the lookup key
    in fixtures.json), or None if the path is empty or the file is missing
    on disk (a stale storage_url shouldn't abort the whole export)."""
    if not relative_path:
        return None
    src = Path(relative_path)
    if not src.exists():
        print(f"    WARNING: file missing on disk, skipping: {relative_path}")
        return None
    dest = SEED_DIR / src
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    return relative_path


def export_account(email: str) -> None:
    db = SessionLocal()
    try:
        user = user_repo.get_by_email(db, email)
        if not user:
            raise SystemExit(f"No user found with email '{email}'")
        user_id = user["id"]
        print(f"Exporting account {email} (user_id={user_id})\n")

        if SEED_DIR.exists():
            shutil.rmtree(SEED_DIR)
        SEED_DIR.mkdir(parents=True)

        businesses_out = []

        for biz in business_repo.get_all_for_user(db, user_id):
            biz_id = str(biz["id"])
            print(f"Business: {biz['name']} ({biz_id})")

            # products_services is always assembled at READ time from the real
            # products/product_images tables (business_service.assemble_products_
            # into_bko) — never actually persisted in the bko column. Exporting
            # it as-is would bake a stale snapshot into a field that's supposed
            # to stay empty at rest, so it's stripped back out here, matching
            # what bko_service.build_from_form() itself always writes.
            bko = dict(biz.get("bko") or {})
            offerings = dict(bko.get("offerings") or {})
            offerings["products_services"] = []
            offerings["hero_product"] = None
            bko["offerings"] = offerings

            logo_url = (bko.get("identity") or {}).get("logo_url")
            logo_file = _copy_into_seed_dir(logo_url)

            products_out = []
            for p in product_repo.list_with_images_for_business(db, biz_id, user_id):
                print(f"  Product: {p['name']} ({len(p.get('images') or [])} image(s))")
                images_out = []
                for img in (p.get("images") or []):
                    img_file = _copy_into_seed_dir(img["storage_url"])
                    if img_file:
                        images_out.append({"is_primary": img["is_primary"], "file": img_file})
                products_out.append({
                    "name": p["name"], "type": p["type"], "is_hero": p["is_hero"],
                    "description": p["description"], "key_features": p["key_features"] or [],
                    "benefits": p["benefits"] or [], "pricing_model": p["pricing_model"],
                    "pricing_tier": p["pricing_tier"], "pricing_details": p["pricing_details"],
                    "unique_selling_points": p["unique_selling_points"] or [],
                    "target_use_case": p["target_use_case"],
                    "images": images_out,
                })

            campaigns_out = []
            for camp in campaign_repo.get_by_business(db, biz_id, user_id):
                camp_id = str(camp["id"])
                print(f"  Campaign: {camp.get('campaign_name') or camp['objective']} "
                      f"({camp_id}) status={camp['status']}")

                assets_out = []
                for asset in campaign_repo.get_assets(db, camp_id):
                    asset_file = _copy_into_seed_dir(asset["storage_url"])
                    assets_out.append({
                        "platform": asset["platform"], "format": asset["format"],
                        "asset_type": asset["asset_type"], "file": asset_file,
                        "prompt_used": asset["prompt_used"], "status": asset["status"],
                        "metadata": asset.get("metadata") or {},
                    })
                print(f"    {len(assets_out)} asset(s)")

                events_out = [
                    {"event_type": e["event_type"], "agent": e["agent"], "payload": e["payload"]}
                    for e in campaign_repo.get_events(db, camp_id)
                ]

                # Copy the whole generations/{campaign_id}/ tree too (not just
                # the DB-tracked asset files) — this also captures the
                # supplementary JSON snapshots (research_report.json,
                # strategy_doc.json, campaign_overview.json, audit_results.json)
                # a real pipeline run writes alongside the assets, so a seeded
                # campaign's on-disk footprint matches a real one's.
                gen_dir = Path("generations") / camp_id
                generations_dir = None
                if gen_dir.exists():
                    shutil.copytree(gen_dir, SEED_DIR / gen_dir, dirs_exist_ok=True)
                    generations_dir = str(gen_dir)

                campaigns_out.append({
                    "campaign_name": camp.get("campaign_name"), "objective": camp["objective"],
                    "platforms": camp["platforms"] or [], "asset_types": camp.get("asset_types") or [],
                    "funnel_stage": camp["funnel_stage"], "num_variants": camp["num_variants"],
                    "hero_products": camp.get("hero_products") or [],
                    "tone_override": camp.get("tone_override"), "special_brief": camp.get("special_brief"),
                    "status": camp["status"], "strategy_doc": camp.get("strategy_doc"),
                    "audit_score": camp.get("audit_score"), "retry_count": camp.get("retry_count", 0),
                    "resumable": camp.get("resumable", False), "failed_node": camp.get("failed_node"),
                    "error": camp.get("error"),
                    "generations_dir": generations_dir,
                    "assets": assets_out, "events": events_out,
                })

            business_events_out = [
                {"event_type": e["event_type"], "agent": e["agent"], "payload": e["payload"]}
                for e in business_repo.get_events(db, biz_id)
            ]

            businesses_out.append({
                "name": biz["name"], "website": biz.get("website"), "industry": biz.get("industry"),
                "onboarding_path": biz["onboarding_path"], "onboarding_status": biz["onboarding_status"],
                "bko": bko, "logo_file": logo_file,
                "products": products_out, "campaigns": campaigns_out, "events": business_events_out,
            })
            print()

        fixtures = {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "source_email": email,
            "businesses": businesses_out,
        }
        (SEED_DIR / "fixtures.json").write_text(
            json.dumps(fixtures, indent=2, default=str), encoding="utf-8"
        )

        n_products = sum(len(b["products"]) for b in businesses_out)
        n_images = sum(len(p["images"]) for b in businesses_out for p in b["products"])
        n_campaigns = sum(len(b["campaigns"]) for b in businesses_out)
        n_assets = sum(len(c["assets"]) for b in businesses_out for c in b["campaigns"])
        print(
            f"Exported {len(businesses_out)} businesses, {n_products} products, "
            f"{n_images} product images, {n_campaigns} campaigns, {n_assets} assets "
            f"→ {SEED_DIR}/"
        )
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True, help="Email of the account to export")
    args = parser.parse_args()
    export_account(args.email)
