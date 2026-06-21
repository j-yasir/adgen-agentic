from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from api.dependencies import get_current_user
from db.session import get_db
from schemas.campaign import (
    AssetResponse,
    CampaignEventResponse,
    CampaignListResponse,
    CampaignResponse,
    CreateCampaignRequest,
    ResumeRequest,
)
from services import campaign_service

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.post(
    "",
    response_model=CampaignResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a campaign and trigger the agent pipeline",
)
def create_campaign(
    data: CreateCampaignRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return campaign_service.create(db, data, user_id=current_user["id"])


@router.get(
    "",
    response_model=CampaignListResponse,
    summary="List all campaigns for a business",
)
def list_campaigns(
    business_id: uuid.UUID = Query(..., description="Business UUID to list campaigns for"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return campaign_service.get_all(db, business_id=business_id, user_id=current_user["id"])


@router.get(
    "/{campaign_id}",
    response_model=CampaignResponse,
    summary="Get a single campaign by ID",
)
def get_campaign(
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return campaign_service.get_one(db, campaign_id=campaign_id, user_id=current_user["id"])


@router.post(
    "/{campaign_id}/resume",
    response_model=CampaignResponse,
    summary="Resume a campaign after a human-in-the-loop interrupt",
)
def resume_campaign(
    campaign_id: uuid.UUID,
    data: ResumeRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return campaign_service.resume(db, campaign_id=campaign_id, user_id=current_user["id"], data=data)


@router.get(
    "/{campaign_id}/events",
    response_model=list[CampaignEventResponse],
    summary="Get event log for a campaign (supports catch-up via after_seq)",
)
def get_campaign_events(
    campaign_id: uuid.UUID,
    after_seq: int = Query(default=0, ge=0, description="Return only events with seq > this value"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return campaign_service.get_events(
        db, campaign_id=campaign_id, user_id=current_user["id"], after_seq=after_seq
    )


@router.get(
    "/{campaign_id}/assets",
    response_model=list[AssetResponse],
    summary="List all generated assets for a campaign",
)
def get_campaign_assets(
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return campaign_service.get_assets(db, campaign_id=campaign_id, user_id=current_user["id"])


@router.delete(
    "/{campaign_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a campaign and all its assets",
)
def delete_campaign(
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    campaign_service.delete(db, campaign_id=campaign_id, user_id=current_user["id"])
