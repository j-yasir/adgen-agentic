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
        asset_types=list(data.asset_types),
        funnel_stage=data.funnel_stage,
        num_variants=data.num_variants,
        hero_products=list(data.hero_products),
        tone_override=data.tone_override,
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


def retry(
    db: Session,
    campaign_id: uuid.UUID,
    user_id: uuid.UUID,
    background_tasks: BackgroundTasks,
) -> CampaignResponse:
    """
    Retry a campaign that failed at a node after its automatic RetryPolicy
    was exhausted (see orchestrator.nodes.NodeExecutionError). Re-enters the
    LangGraph checkpoint from the failed node onward — steps that already
    completed (research, strategy) are not re-run, so this is far cheaper
    than relaunching the whole campaign.

    Distinct from resume(): resume() answers a paused interrupt() (HITL);
    retry() re-executes after an exception. Only offered when the failure
    was flagged resumable (transient node failure, not a permanent one like
    a missing business record).
    """
    logger.info("Retrying campaign id=%s user_id=%s", campaign_id, user_id)
    row = campaign_repo.get_by_id(db, campaign_id, user_id)
    if not row:
        raise NotFoundError(f"Campaign {campaign_id} not found")

    if row["status"] != "failed" or not row["resumable"]:
        raise ForbiddenError(
            f"Campaign {campaign_id} is not in a retryable state "
            f"(status={row['status']}, resumable={row['resumable']})"
        )

    # Flip to 'running' synchronously (not in the background task) so a
    # double-click can't schedule two concurrent retries of the same thread,
    # and the SP's status='running' case clears resumable/failed_node/error.
    updated = campaign_repo.update_status(db, campaign_id=campaign_id, status="running")

    from tasks.campaign_runner import run_retry
    background_tasks.add_task(run_retry, campaign_id=str(campaign_id))

    logger.info("Campaign retry scheduled campaign_id=%s failed_node=%s", campaign_id, row["failed_node"])
    return CampaignResponse(**updated)
