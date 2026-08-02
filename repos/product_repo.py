from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from utils.logger import get_logger

logger = get_logger(__name__)


# ── Products ──────────────────────────────────────────────────────────────────

def create(
    db: Session,
    *,
    business_id: uuid.UUID | str,
    user_id: uuid.UUID | str,
    name: str,
    type: str,
    is_hero: bool,
    description: str,
    key_features: list[str],
    benefits: list[str],
    pricing_model: str,
    pricing_tier: str,
    pricing_details: Optional[str],
    unique_selling_points: list[str],
    target_use_case: Optional[str],
) -> Optional[dict]:
    logger.debug("Creating product for business_id=%s name=%s", business_id, name)
    row = db.execute(
        text(
            "SELECT * FROM sp_create_product("
            ":business_id, :user_id, :name, :type, :is_hero, :description, "
            ":key_features, :benefits, :pricing_model, :pricing_tier, "
            ":pricing_details, :unique_selling_points, :target_use_case"
            ")"
        ),
        {
            "business_id": str(business_id),
            "user_id": str(user_id),
            "name": name,
            "type": type,
            "is_hero": is_hero,
            "description": description,
            "key_features": key_features,
            "benefits": benefits,
            "pricing_model": pricing_model,
            "pricing_tier": pricing_tier,
            "pricing_details": pricing_details,
            "unique_selling_points": unique_selling_points,
            "target_use_case": target_use_case,
        },
    ).mappings().first()
    db.commit()
    return dict(row) if row else None


def get_by_id(
    db: Session,
    product_id: uuid.UUID | str,
    user_id: uuid.UUID | str,
) -> Optional[dict]:
    logger.debug("Fetching product id=%s for user_id=%s", product_id, user_id)
    row = db.execute(
        text("SELECT * FROM sp_get_product_by_id(:product_id, :user_id)"),
        {"product_id": str(product_id), "user_id": str(user_id)},
    ).mappings().first()
    return dict(row) if row else None


def list_with_images_for_business(
    db: Session,
    business_id: uuid.UUID | str,
    user_id: uuid.UUID | str,
) -> list[dict]:
    logger.debug("Listing products for business_id=%s", business_id)
    rows = db.execute(
        text("SELECT * FROM sp_list_products_with_images_by_business(:business_id, :user_id)"),
        {"business_id": str(business_id), "user_id": str(user_id)},
    ).mappings().all()
    return [dict(r) for r in rows]


def update(
    db: Session,
    *,
    product_id: uuid.UUID | str,
    user_id: uuid.UUID | str,
    name: Optional[str] = None,
    type: Optional[str] = None,
    is_hero: Optional[bool] = None,
    description: Optional[str] = None,
    key_features: Optional[list[str]] = None,
    benefits: Optional[list[str]] = None,
    pricing_model: Optional[str] = None,
    pricing_tier: Optional[str] = None,
    pricing_details: Optional[str] = None,
    unique_selling_points: Optional[list[str]] = None,
    target_use_case: Optional[str] = None,
) -> Optional[dict]:
    logger.debug("Updating product id=%s", product_id)
    row = db.execute(
        text(
            "SELECT * FROM sp_update_product("
            ":product_id, :user_id, :name, :type, :is_hero, :description, "
            ":key_features, :benefits, :pricing_model, :pricing_tier, "
            ":pricing_details, :unique_selling_points, :target_use_case"
            ")"
        ),
        {
            "product_id": str(product_id),
            "user_id": str(user_id),
            "name": name,
            "type": type,
            "is_hero": is_hero,
            "description": description,
            "key_features": key_features,
            "benefits": benefits,
            "pricing_model": pricing_model,
            "pricing_tier": pricing_tier,
            "pricing_details": pricing_details,
            "unique_selling_points": unique_selling_points,
            "target_use_case": target_use_case,
        },
    ).mappings().first()
    db.commit()
    return dict(row) if row else None


def delete(
    db: Session,
    product_id: uuid.UUID | str,
    user_id: uuid.UUID | str,
) -> bool:
    logger.debug("Deleting product id=%s for user_id=%s", product_id, user_id)
    result = db.execute(
        text("SELECT sp_delete_product(:product_id, :user_id)"),
        {"product_id": str(product_id), "user_id": str(user_id)},
    ).scalar()
    db.commit()
    return bool(result)


# ── Product images ───────────────────────────────────────────────────────────

def add_image(
    db: Session,
    *,
    product_id: uuid.UUID | str,
    user_id: uuid.UUID | str,
    storage_url: str,
) -> Optional[dict]:
    logger.debug("Adding image for product_id=%s", product_id)
    row = db.execute(
        text("SELECT * FROM sp_add_product_image(:product_id, :user_id, :storage_url)"),
        {"product_id": str(product_id), "user_id": str(user_id), "storage_url": storage_url},
    ).mappings().first()
    db.commit()
    return dict(row) if row else None


def list_images(
    db: Session,
    product_id: uuid.UUID | str,
    user_id: uuid.UUID | str,
) -> list[dict]:
    rows = db.execute(
        text("SELECT * FROM sp_list_product_images(:product_id, :user_id)"),
        {"product_id": str(product_id), "user_id": str(user_id)},
    ).mappings().all()
    return [dict(r) for r in rows]


def delete_image(
    db: Session,
    *,
    product_id: uuid.UUID | str,
    image_id: uuid.UUID | str,
    user_id: uuid.UUID | str,
) -> Optional[str]:
    """Returns the deleted row's storage_url (for the caller to also delete
    the file), or None if nothing was found/owned."""
    logger.debug("Deleting product image id=%s product_id=%s", image_id, product_id)
    row = db.execute(
        text("SELECT * FROM sp_delete_product_image(:product_id, :image_id, :user_id)"),
        {"product_id": str(product_id), "image_id": str(image_id), "user_id": str(user_id)},
    ).mappings().first()
    db.commit()
    return row["storage_url"] if row else None


def set_primary_image(
    db: Session,
    *,
    product_id: uuid.UUID | str,
    image_id: uuid.UUID | str,
    user_id: uuid.UUID | str,
) -> Optional[dict]:
    logger.debug("Setting primary image id=%s for product_id=%s", image_id, product_id)
    row = db.execute(
        text("SELECT * FROM sp_set_primary_product_image(:product_id, :image_id, :user_id)"),
        {"product_id": str(product_id), "image_id": str(image_id), "user_id": str(user_id)},
    ).mappings().first()
    db.commit()
    return dict(row) if row else None
