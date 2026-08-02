from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from api.dependencies import get_current_user
from db.session import get_db
from schemas.product import (
    CreateProductRequest,
    ProductImageResponse,
    ProductListResponse,
    ProductResponse,
    UpdateProductRequest,
)
from services import product_service

router = APIRouter(prefix="/businesses/{business_id}/products", tags=["products"])


@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new product for a business",
)
def create_product(
    business_id: uuid.UUID,
    data: CreateProductRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return product_service.create(db, business_id=business_id, user_id=current_user["id"], data=data)


@router.get(
    "",
    response_model=ProductListResponse,
    summary="List all products for a business",
)
def list_products(
    business_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return product_service.list_for_business(db, business_id=business_id, user_id=current_user["id"])


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Get a single product by ID",
)
def get_product(
    business_id: uuid.UUID,
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return product_service.get_one(
        db, business_id=business_id, product_id=product_id, user_id=current_user["id"],
    )


@router.patch(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Update a product's fields",
)
def update_product(
    business_id: uuid.UUID,
    product_id: uuid.UUID,
    data: UpdateProductRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return product_service.update(
        db, business_id=business_id, product_id=product_id, user_id=current_user["id"], data=data,
    )


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a product and all its images",
)
def delete_product(
    business_id: uuid.UUID,
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    product_service.delete(db, business_id=business_id, product_id=product_id, user_id=current_user["id"])


# ── Product images ──────────────────────────────────────────────────────────
# Real product photos — asset-producing agents ground generation in these
# instead of an AI approximation. Images only, validated by decoding (not by
# trusting the client's filename or Content-Type header), 8MB cap.

@router.post(
    "/{product_id}/images",
    response_model=ProductImageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a real product photo to this product's gallery",
    description="Additive — a product can have multiple reference photos. The first upload auto-becomes primary.",
)
async def upload_product_image(
    business_id: uuid.UUID,
    product_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    data = await file.read()
    return product_service.upload_image(
        db, business_id=business_id, product_id=product_id, user_id=current_user["id"], file_bytes=data,
    )


@router.get(
    "/{product_id}/images",
    response_model=list[ProductImageResponse],
    summary="List a product's images",
)
def list_product_images(
    business_id: uuid.UUID,
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return product_service.list_images(
        db, business_id=business_id, product_id=product_id, user_id=current_user["id"],
    )


@router.delete(
    "/{product_id}/images/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove one image from a product's gallery",
    description="If the deleted image was primary, the oldest remaining image is auto-promoted.",
)
def delete_product_image(
    business_id: uuid.UUID,
    product_id: uuid.UUID,
    image_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    product_service.delete_image(
        db, business_id=business_id, product_id=product_id, image_id=image_id, user_id=current_user["id"],
    )


@router.post(
    "/{product_id}/images/{image_id}/primary",
    response_model=ProductImageResponse,
    summary="Set an image as the product's primary photo",
)
def set_primary_product_image(
    business_id: uuid.UUID,
    product_id: uuid.UUID,
    image_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return product_service.set_primary_image(
        db, business_id=business_id, product_id=product_id, image_id=image_id, user_id=current_user["id"],
    )
