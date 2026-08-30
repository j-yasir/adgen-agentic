from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from api.dependencies import get_current_user
from db.session import get_db
from schemas.business import (
    BkoPatchRequest,
    BusinessEventResponse,
    BusinessListResponse,
    BusinessResponse,
    CreateBusinessFromUrlRequest,
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


@router.post(
    "/from-url",
    response_model=BusinessResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Create a business by researching its website (no scraper — an LLM agent with web search)",
    description=(
        "Returns immediately with a 'pending' business — an agent researches the "
        "given URL (and the open web beyond it) in the background and fills in the "
        "BKO. Stream progress via GET /stream/businesses/{id}, or catch up via "
        "GET /businesses/{id}/events. Once onboarding_status flips to 'complete', "
        "the business behaves exactly like a form-created one — PATCH works on it "
        "the same way, so the user can review and correct anything the agent got wrong."
    ),
)
def create_business_from_url(
    data: CreateBusinessFromUrlRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    business = business_service.create_pending(db, user_id=current_user["id"], url=data.url)

    from tasks.business_onboarding_runner import run_url_onboarding
    background_tasks.add_task(
        run_url_onboarding,
        business_id=str(business.id),
        user_id=str(current_user["id"]),
        url=data.url,
    )
    return business


@router.get(
    "/{business_id}/events",
    response_model=list[BusinessEventResponse],
    summary="Get URL-onboarding event log for a business (supports catch-up via after_seq)",
)
def get_business_events(
    business_id: uuid.UUID,
    after_seq: int = Query(default=0, ge=0, description="Return only events with seq > this value"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return business_service.get_events(
        db, business_id=business_id, user_id=current_user["id"], after_seq=after_seq,
    )


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


@router.patch(
    "/{business_id}/bko",
    response_model=BusinessResponse,
    summary="Surgical single-field BKO patch — no LLM rebuild",
)
def patch_bko_field(
    business_id: uuid.UUID,
    data: BkoPatchRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return business_service.patch_bko_field(
        db, business_id=business_id, user_id=current_user["id"],
        path=data.path, value=data.value,
    )


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
