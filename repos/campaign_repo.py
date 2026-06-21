from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from utils.logger import get_logger

logger = get_logger(__name__)


# ── Campaign ──────────────────────────────────────────────────────────────────

def create(
    db: Session,
    *,
    user_id: uuid.UUID,
    business_id: uuid.UUID,
    campaign_name: Optional[str],
    objective: str,
    platforms: list[str],
    funnel_stage: str,
    num_variants: int,
    special_brief: Optional[str],
) -> dict:
    logger.debug("Creating campaign for business_id=%s user_id=%s", business_id, user_id)
    row = db.execute(
        text(
            "SELECT * FROM sp_create_campaign("
            ":user_id, :business_id, :campaign_name, :objective, "
            ":platforms, :funnel_stage, :num_variants, :special_brief"
            ")"
        ),
        {
            "user_id":       str(user_id),
            "business_id":   str(business_id),
            "campaign_name": campaign_name,
            "objective":     objective,
            "platforms":     platforms,
            "funnel_stage":  funnel_stage,
            "num_variants":  num_variants,
            "special_brief": special_brief,
        },
    ).mappings().first()
    db.commit()
    result = dict(row)
    logger.debug("Campaign created id=%s", result["id"])
    return result


def get_by_id(
    db: Session,
    campaign_id: uuid.UUID | str,
    user_id: uuid.UUID | str,
) -> Optional[dict]:
    logger.debug("Fetching campaign id=%s for user_id=%s", campaign_id, user_id)
    row = db.execute(
        text("SELECT * FROM sp_get_campaign_by_id(:campaign_id, :user_id)"),
        {"campaign_id": str(campaign_id), "user_id": str(user_id)},
    ).mappings().first()
    return dict(row) if row else None


def get_by_business(
    db: Session,
    business_id: uuid.UUID | str,
    user_id: uuid.UUID | str,
) -> list[dict]:
    logger.debug("Fetching campaigns for business_id=%s user_id=%s", business_id, user_id)
    rows = db.execute(
        text("SELECT * FROM sp_get_campaigns_by_business(:business_id, :user_id)"),
        {"business_id": str(business_id), "user_id": str(user_id)},
    ).mappings().all()
    return [dict(r) for r in rows]


def update_status(
    db: Session,
    *,
    campaign_id: uuid.UUID | str,
    status: str,
    strategy_doc: Optional[dict] = None,
    audit_score: Optional[float] = None,
    error: Optional[str] = None,
) -> Optional[dict]:
    import json
    logger.debug("Updating campaign id=%s status=%s", campaign_id, status)
    row = db.execute(
        text(
            "SELECT * FROM sp_update_campaign_status("
            ":campaign_id, :status, "
            "CAST(:strategy_doc AS JSONB), :audit_score, :error"
            ")"
        ),
        {
            "campaign_id":  str(campaign_id),
            "status":       status,
            "strategy_doc": json.dumps(strategy_doc) if strategy_doc is not None else None,
            "audit_score":  audit_score,
            "error":        error,
        },
    ).mappings().first()
    db.commit()
    return dict(row) if row else None


def delete(
    db: Session,
    campaign_id: uuid.UUID | str,
    user_id: uuid.UUID | str,
) -> bool:
    logger.debug("Deleting campaign id=%s user_id=%s", campaign_id, user_id)
    result = db.execute(
        text(
            "DELETE FROM campaigns WHERE id = :campaign_id AND user_id = :user_id "
            "RETURNING id"
        ),
        {"campaign_id": str(campaign_id), "user_id": str(user_id)},
    ).first()
    db.commit()
    return result is not None


# ── Events ────────────────────────────────────────────────────────────────────

def insert_event(
    db: Session,
    *,
    campaign_id: uuid.UUID | str,
    event_type: str,
    agent: Optional[str],
    payload: dict,
) -> dict:
    import json
    row = db.execute(
        text(
            "SELECT * FROM sp_insert_campaign_event("
            ":campaign_id, :event_type, :agent, CAST(:payload AS JSONB)"
            ")"
        ),
        {
            "campaign_id": str(campaign_id),
            "event_type":  event_type,
            "agent":       agent,
            "payload":     json.dumps(payload),
        },
    ).mappings().first()
    db.commit()
    return dict(row)


def get_events(
    db: Session,
    campaign_id: uuid.UUID | str,
    after_seq: int = 0,
) -> list[dict]:
    rows = db.execute(
        text("SELECT * FROM sp_get_campaign_events(:campaign_id, :after_seq)"),
        {"campaign_id": str(campaign_id), "after_seq": after_seq},
    ).mappings().all()
    return [dict(r) for r in rows]


# ── Assets ────────────────────────────────────────────────────────────────────

def create_asset(
    db: Session,
    *,
    campaign_id: uuid.UUID | str,
    platform: str,
    format: str,
    asset_type: str,
    storage_url: str,
    prompt_used: Optional[str] = None,
) -> dict:
    logger.debug("Creating asset campaign_id=%s platform=%s type=%s", campaign_id, platform, asset_type)
    row = db.execute(
        text(
            "SELECT * FROM sp_create_asset("
            ":campaign_id, :platform, :format, :asset_type, :storage_url, :prompt_used"
            ")"
        ),
        {
            "campaign_id":  str(campaign_id),
            "platform":     platform,
            "format":       format,
            "asset_type":   asset_type,
            "storage_url":  storage_url,
            "prompt_used":  prompt_used,
        },
    ).mappings().first()
    db.commit()
    return dict(row)


def update_asset_status(
    db: Session,
    *,
    asset_id: uuid.UUID | str,
    status: str,
) -> Optional[dict]:
    row = db.execute(
        text("SELECT * FROM sp_update_asset_status(:asset_id, :status)"),
        {"asset_id": str(asset_id), "status": status},
    ).mappings().first()
    db.commit()
    return dict(row) if row else None


def get_assets(
    db: Session,
    campaign_id: uuid.UUID | str,
) -> list[dict]:
    rows = db.execute(
        text("SELECT * FROM assets WHERE campaign_id = :campaign_id ORDER BY created_at ASC"),
        {"campaign_id": str(campaign_id)},
    ).mappings().all()
    return [dict(r) for r in rows]
