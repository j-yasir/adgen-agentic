from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
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
