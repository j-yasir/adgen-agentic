from __future__ import annotations

import json
import uuid
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from utils.logger import get_logger

logger = get_logger(__name__)


def create(
    db: Session,
    *,
    user_id: uuid.UUID,
    name: str,
    website: Optional[str],
    industry: Optional[str],
    bko: dict,
    onboarding_path: str,
    onboarding_status: str,
) -> dict:
    logger.debug("Creating business for user_id=%s name=%s", user_id, name)
    row = db.execute(
        text(
            "SELECT * FROM sp_create_business("
            ":user_id, :name, :website, :industry, CAST(:bko AS JSONB), :onboarding_path, :onboarding_status"
            ")"
        ),
        {
            "user_id": str(user_id),
            "name": name,
            "website": website,
            "industry": industry,
            "bko": json.dumps(bko),
            "onboarding_path": onboarding_path,
            "onboarding_status": onboarding_status,
        },
    ).mappings().first()
    db.commit()
    result = dict(row)
    logger.debug("Business created id=%s", result["id"])
    return result


def get_by_id(
    db: Session,
    business_id: uuid.UUID | str,
    user_id: uuid.UUID | str,
) -> Optional[dict]:
    logger.debug("Fetching business id=%s for user_id=%s", business_id, user_id)
    row = db.execute(
        text("SELECT * FROM sp_get_business_by_id(:business_id, :user_id)"),
        {"business_id": str(business_id), "user_id": str(user_id)},
    ).mappings().first()
    return dict(row) if row else None


def get_all_for_user(db: Session, user_id: uuid.UUID | str) -> list[dict]:
    logger.debug("Fetching all businesses for user_id=%s", user_id)
    rows = db.execute(
        text("SELECT * FROM sp_get_businesses_by_user(:user_id)"),
        {"user_id": str(user_id)},
    ).mappings().all()
    return [dict(r) for r in rows]


def update_bko(
    db: Session,
    *,
    business_id: uuid.UUID | str,
    user_id: uuid.UUID | str,
    bko: dict,
    onboarding_status: str,
) -> Optional[dict]:
    logger.debug("Updating BKO for business_id=%s", business_id)
    row = db.execute(
        text(
            "SELECT * FROM sp_update_business_bko("
            ":business_id, :user_id, CAST(:bko AS JSONB), :onboarding_status"
            ")"
        ),
        {
            "business_id": str(business_id),
            "user_id": str(user_id),
            "bko": json.dumps(bko),
            "onboarding_status": onboarding_status,
        },
    ).mappings().first()
    db.commit()
    return dict(row) if row else None


def delete(
    db: Session,
    business_id: uuid.UUID | str,
    user_id: uuid.UUID | str,
) -> bool:
    logger.debug("Deleting business id=%s for user_id=%s", business_id, user_id)
    result = db.execute(
        text("SELECT sp_delete_business(:business_id, :user_id)"),
        {"business_id": str(business_id), "user_id": str(user_id)},
    ).scalar()
    db.commit()
    return bool(result)
