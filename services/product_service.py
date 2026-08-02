from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from repos import business_repo, product_repo
from schemas.product import (
    CreateProductRequest,
    ProductImageResponse,
    ProductListResponse,
    ProductResponse,
    UpdateProductRequest,
)
from utils import storage
from utils.exceptions import NotFoundError
from utils.logger import get_logger

logger = get_logger(__name__)


def _require_business(db: Session, business_id: uuid.UUID, user_id: uuid.UUID) -> dict:
    business = business_repo.get_by_id(db, business_id, user_id)
    if not business:
        raise NotFoundError(f"Business {business_id} not found")
    return business


def _require_product(
    db: Session, business_id: uuid.UUID, product_id: uuid.UUID, user_id: uuid.UUID,
) -> dict:
    product = product_repo.get_by_id(db, product_id, user_id)
    if not product or str(product["business_id"]) != str(business_id):
        raise NotFoundError(f"Product {product_id} not found on business {business_id}")
    return product


def create(
    db: Session, business_id: uuid.UUID, user_id: uuid.UUID, data: CreateProductRequest,
) -> ProductResponse:
    logger.info("Creating product for business_id=%s name='%s'", business_id, data.name)
    _require_business(db, business_id, user_id)

    row = product_repo.create(
        db,
        business_id=business_id,
        user_id=user_id,
        name=data.name,
        type=data.type,
        is_hero=data.is_hero,
        description=data.description,
        key_features=data.key_features,
        benefits=data.benefits,
        pricing_model=data.pricing_model,
        pricing_tier=data.pricing_tier,
        pricing_details=data.pricing_details,
        unique_selling_points=data.unique_selling_points,
        target_use_case=data.target_use_case,
    )
    return ProductResponse(**row, images=[])


def list_for_business(
    db: Session, business_id: uuid.UUID, user_id: uuid.UUID,
) -> ProductListResponse:
    logger.debug("Listing products for business_id=%s", business_id)
    _require_business(db, business_id, user_id)
    rows = product_repo.list_with_images_for_business(db, business_id, user_id)
    products = []
    for r in rows:
        fields = {k: v for k, v in r.items() if k != "images"}
        images = [ProductImageResponse(**img) for img in (r.get("images") or [])]
        products.append(ProductResponse(**fields, images=images))
    return ProductListResponse(products=products, total=len(products))


def get_one(
    db: Session, business_id: uuid.UUID, product_id: uuid.UUID, user_id: uuid.UUID,
) -> ProductResponse:
    product = _require_product(db, business_id, product_id, user_id)
    images = product_repo.list_images(db, product_id, user_id)
    return ProductResponse(**product, images=[ProductImageResponse(**img) for img in images])


def update(
    db: Session, business_id: uuid.UUID, product_id: uuid.UUID, user_id: uuid.UUID,
    data: UpdateProductRequest,
) -> ProductResponse:
    logger.info("Updating product id=%s business_id=%s", product_id, business_id)
    _require_product(db, business_id, product_id, user_id)

    row = product_repo.update(
        db,
        product_id=product_id,
        user_id=user_id,
        name=data.name,
        type=data.type,
        is_hero=data.is_hero,
        description=data.description,
        key_features=data.key_features,
        benefits=data.benefits,
        pricing_model=data.pricing_model,
        pricing_tier=data.pricing_tier,
        pricing_details=data.pricing_details,
        unique_selling_points=data.unique_selling_points,
        target_use_case=data.target_use_case,
    )
    if not row:
        raise NotFoundError(f"Product {product_id} not found")
    images = product_repo.list_images(db, product_id, user_id)
    return ProductResponse(**row, images=[ProductImageResponse(**img) for img in images])


def delete(db: Session, business_id: uuid.UUID, product_id: uuid.UUID, user_id: uuid.UUID) -> None:
    logger.info("Deleting product id=%s business_id=%s", product_id, business_id)
    _require_product(db, business_id, product_id, user_id)

    deleted = product_repo.delete(db, product_id, user_id)
    if not deleted:
        raise NotFoundError(f"Product {product_id} not found")
    storage.delete_product_assets_dir(str(business_id), str(product_id))
    logger.info("Product deleted id=%s", product_id)


def upload_image(
    db: Session, business_id: uuid.UUID, product_id: uuid.UUID, user_id: uuid.UUID,
    file_bytes: bytes,
) -> ProductImageResponse:
    logger.info("Uploading image for product_id=%s", product_id)
    _require_product(db, business_id, product_id, user_id)

    path = storage.save_product_image(str(business_id), str(product_id), file_bytes)
    row = product_repo.add_image(db, product_id=product_id, user_id=user_id, storage_url=path)
    if not row:
        raise NotFoundError(f"Product {product_id} not found")
    logger.info("Product image stored product_id=%s path=%s", product_id, path)
    return ProductImageResponse(**row)


def list_images(
    db: Session, business_id: uuid.UUID, product_id: uuid.UUID, user_id: uuid.UUID,
) -> list[ProductImageResponse]:
    _require_product(db, business_id, product_id, user_id)
    rows = product_repo.list_images(db, product_id, user_id)
    return [ProductImageResponse(**r) for r in rows]


def delete_image(
    db: Session, business_id: uuid.UUID, product_id: uuid.UUID, image_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    logger.info("Deleting image id=%s for product_id=%s", image_id, product_id)
    _require_product(db, business_id, product_id, user_id)

    storage_url = product_repo.delete_image(
        db, product_id=product_id, image_id=image_id, user_id=user_id,
    )
    if storage_url is None:
        raise NotFoundError(f"Image {image_id} not found on product {product_id}")
    storage.delete_business_asset(storage_url)


def set_primary_image(
    db: Session, business_id: uuid.UUID, product_id: uuid.UUID, image_id: uuid.UUID,
    user_id: uuid.UUID,
) -> ProductImageResponse:
    logger.info("Setting primary image id=%s for product_id=%s", image_id, product_id)
    _require_product(db, business_id, product_id, user_id)

    row = product_repo.set_primary_image(
        db, product_id=product_id, image_id=image_id, user_id=user_id,
    )
    if not row:
        raise NotFoundError(f"Image {image_id} not found on product {product_id}")
    return ProductImageResponse(**row)
