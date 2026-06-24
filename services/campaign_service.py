from __future__ import annotations

import uuid

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from repos import business_repo, campaign_repo
from schemas.campaign import (
    AssetResponse,
    CampaignEventResponse,
    CampaignListResponse,
    CampaignResponse,
    CreateCampaignRequest,
    ResumeRequest,
)
from utils.exceptions import ForbiddenError, NotFoundError
from utils.logger import get_logger

logger = get_logger(__name__)


def create(
    db: Session,
    data: CreateCampaignRequest,
    user_id: uuid.UUID,
    background_tasks: BackgroundTasks,
) -> CampaignResponse:
    logger.info(
        "Creating campaign for business_id=%s user_id=%s objective=%s platforms=%s",
        data.business_id, user_id, data.objective, data.platforms,
    )

    # Verify the business exists and belongs to this user
    business = business_repo.get_by_id(db, data.business_id, user_id)
    if not business:
        raise NotFoundError(f"Business {data.business_id} not found")

    row = campaign_repo.create(
        db,
        user_id=user_id,
        business_id=data.business_id,
        campaign_name=data.campaign_name,
        objective=data.objective,
        platforms=list(data.platforms),
        funnel_stage=data.funnel_stage,
        num_variants=data.num_variants,
        special_brief=data.special_brief,
    )

    campaign_id = str(row["id"])
    logger.info("Campaign created id=%s — scheduling pipeline", campaign_id)

    # Import here to avoid circular imports at module load time
    from tasks.campaign_runner import run_pipeline
    background_tasks.add_task(
        run_pipeline,
        campaign_id=campaign_id,
        business_id=str(data.business_id),
        user_id=str(user_id),
    )

    return CampaignResponse(**row)


def get_one(
    db: Session,
    campaign_id: uuid.UUID,
    user_id: uuid.UUID,
) -> CampaignResponse:
    logger.debug("Fetching campaign id=%s user_id=%s", campaign_id, user_id)
    row = campaign_repo.get_by_id(db, campaign_id, user_id)
    if not row:
        raise NotFoundError(f"Campaign {campaign_id} not found")
    return CampaignResponse(**row)


def get_all(
    db: Session,
    business_id: uuid.UUID,
    user_id: uuid.UUID,
) -> CampaignListResponse:
    # Verify business ownership before listing
    business = business_repo.get_by_id(db, business_id, user_id)
    if not business:
        raise NotFoundError(f"Business {business_id} not found")

    rows = campaign_repo.get_by_business(db, business_id, user_id)
    logger.info("Found %d campaigns for business_id=%s", len(rows), business_id)
    return CampaignListResponse(
        campaigns=[CampaignResponse(**r) for r in rows],
        total=len(rows),
    )


def delete(
    db: Session,
    campaign_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    logger.info("Deleting campaign id=%s user_id=%s", campaign_id, user_id)
    deleted = campaign_repo.delete(db, campaign_id, user_id)
    if not deleted:
        raise NotFoundError(f"Campaign {campaign_id} not found")
    logger.info("Campaign deleted id=%s", campaign_id)


def get_events(
    db: Session,
    campaign_id: uuid.UUID,
    user_id: uuid.UUID,
    after_seq: int = 0,
) -> list[CampaignEventResponse]:
    # Ownership check
    row = campaign_repo.get_by_id(db, campaign_id, user_id)
    if not row:
        raise NotFoundError(f"Campaign {campaign_id} not found")

    events = campaign_repo.get_events(db, campaign_id, after_seq=after_seq)
    return [CampaignEventResponse(**e) for e in events]


def get_assets(
    db: Session,
    campaign_id: uuid.UUID,
    user_id: uuid.UUID,
) -> list[AssetResponse]:
    row = campaign_repo.get_by_id(db, campaign_id, user_id)
    if not row:
        raise NotFoundError(f"Campaign {campaign_id} not found")

    assets = campaign_repo.get_assets(db, campaign_id)
    return [AssetResponse(**a) for a in assets]


def resume(
    db: Session,
    campaign_id: uuid.UUID,
    user_id: uuid.UUID,
    data: ResumeRequest,
    background_tasks: BackgroundTasks,
) -> CampaignResponse:
    """
    Called when the user responds to a HITL interrupt.
    Validates ownership + campaign state, then schedules the graph resume
    as a BackgroundTask so the HTTP response returns immediately.
    """
    logger.info(
        "Resuming campaign id=%s user_id=%s approved=%s",
        campaign_id, user_id, data.approved,
    )
    row = campaign_repo.get_by_id(db, campaign_id, user_id)
    if not row:
        raise NotFoundError(f"Campaign {campaign_id} not found")

    if row["status"] != "awaiting_review":
        raise ForbiddenError(
            f"Campaign {campaign_id} is not awaiting review (current status: {row['status']})"
        )

    hitl_response = {
        "approved":  data.approved,
        "feedback":  data.feedback,
    }

    from tasks.campaign_runner import run_resume
    background_tasks.add_task(
        run_resume,
        campaign_id=str(campaign_id),
        hitl_response=hitl_response,
    )

    logger.info("Campaign resume scheduled campaign_id=%s", campaign_id)
    return CampaignResponse(**row)
