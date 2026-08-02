from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from api.dependencies import get_current_user
from db.session import get_db
from schemas.business import (
    BusinessListResponse,
    BusinessResponse,
    CreateBusinessRequest,
    UpdateBusinessRequest,
)
from services import business_service

router = APIRouter(prefix="/businesses", tags=["businesses"])


@router.post(
    "",
    response_model=BusinessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a business and generate its BKO",
)
def create_business(
    data: CreateBusinessRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return business_service.create(db, data, user_id=current_user["id"])


@router.get(
    "",
    response_model=BusinessListResponse,
    summary="List all businesses for the authenticated user",
)
def list_businesses(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return business_service.get_all(db, user_id=current_user["id"])


@router.get(
    "/{business_id}",
    response_model=BusinessResponse,
    summary="Get a single business by ID",
)
def get_business(
    business_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return business_service.get_one(db, business_id=business_id, user_id=current_user["id"])


@router.patch(
    "/{business_id}",
    response_model=BusinessResponse,
    summary="Update business sections — regenerates BKO and bumps version",
)
def update_business(
    business_id: uuid.UUID,
    data: UpdateBusinessRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return business_service.update(db, business_id=business_id, user_id=current_user["id"], data=data)


@router.delete(
    "/{business_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a business and all its campaigns",
)
def delete_business(
    business_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    business_service.delete(db, business_id=business_id, user_id=current_user["id"])


# ── Brand assets (logo, product photos) ───────────────────────────────────────
# Real files agents ground generation in, instead of an AI approximation.
# Images only (png/jpg/webp, validated by decoding — not by trusting the
# client's filename or Content-Type header), 8MB cap.

@router.post(
    "/{business_id}/logo",
    response_model=BusinessResponse,
    summary="Upload/replace the business logo",
)
async def upload_logo(
    business_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    data = await file.read()
    return business_service.upload_logo(db, business_id=business_id, user_id=current_user["id"], file_bytes=data)


@router.delete(
    "/{business_id}/logo",
    response_model=BusinessResponse,
    summary="Remove the business logo",
)
def delete_logo(
    business_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return business_service.delete_logo(db, business_id=business_id, user_id=current_user["id"])
