from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from repos import campaign_repo
from utils.logger import get_logger

logger = get_logger(__name__)


def emit(
    db: Session,
    *,
    campaign_id: uuid.UUID | str,
    event_type: str,
    agent: str | None,
    payload: dict,
) -> dict:
    """
    Record a campaign event and broadcast it via pg_notify.
    pg_notify fires inside sp_insert_campaign_event — nothing extra needed here.
    Call this from every orchestrator node to stream progress to the client.
    """
    logger.debug(
        "Emitting event campaign_id=%s type=%s agent=%s",
        campaign_id, event_type, agent,
    )
    return campaign_repo.insert_event(
        db,
        campaign_id=campaign_id,
        event_type=event_type,
        agent=agent,
        payload=payload,
    )
