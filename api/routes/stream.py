from __future__ import annotations

import asyncio
import functools
import json
import select
import uuid
from collections.abc import AsyncGenerator
from typing import Optional

import psycopg2
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from api.dependencies import get_current_user_from_query
from config import settings
from db.session import SessionLocal, get_db
from repos import campaign_repo
from utils.exceptions import NotFoundError
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/stream", tags=["stream"])

_TERMINAL_EVENTS = {"campaign_done", "campaign_failed"}
_HEARTBEAT_INTERVAL = 15   # seconds between heartbeat frames
_POLL_TIMEOUT = 2          # seconds each select() call blocks before looping


# ── Helpers ───────────────────────────────────────────────────────────────────

def _raw_dsn() -> str:
    """Strip SQLAlchemy dialect prefix so psycopg2.connect() accepts the URL."""
    return settings.DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://", 1)


def _open_listen_conn(dsn: str, campaign_id: str) -> psycopg2.extensions.connection:
    """Blocking: open a dedicated psycopg2 connection and issue LISTEN."""
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(f'LISTEN "campaign_{campaign_id}"')
    cur.close()
    return conn


def _format_sse(event: dict) -> str:
    return f"data: {json.dumps(event, default=str)}\n\n"


# ── SSE generator ─────────────────────────────────────────────────────────────

async def _event_generator(
    campaign_id: str,
    after_seq: int,
) -> AsyncGenerator[str, None]:
    dsn = _raw_dsn()
    loop = asyncio.get_running_loop()

    # Open the LISTEN connection BEFORE fetching catch-up rows so no events
    # emitted between the two steps can slip through unnoticed.
    conn: Optional[psycopg2.extensions.connection] = None
    try:
        conn = await loop.run_in_executor(
            None, _open_listen_conn, dsn, campaign_id
        )
        logger.debug("SSE LISTEN open for campaign_id=%s after_seq=%s", campaign_id, after_seq)

        # ── Catch-up: replay events already in DB ─────────────────────────────
        db = SessionLocal()
        try:
            missed = campaign_repo.get_events(db, campaign_id, after_seq=after_seq)
            for event in missed:
                yield _format_sse(event)
                if event["event_type"] in _TERMINAL_EVENTS:
                    logger.debug("Terminal event in catch-up for campaign_id=%s", campaign_id)
                    return
        finally:
            db.close()

        # ── Live stream via pg_notify ─────────────────────────────────────────
        last_heartbeat = loop.time()

        while True:
            now = loop.time()

            if now - last_heartbeat >= _HEARTBEAT_INTERVAL:
                yield 'data: {"type":"heartbeat"}\n\n'
                last_heartbeat = now

            readable, _, _ = await loop.run_in_executor(
                None,
                functools.partial(select.select, [conn], [], [], _POLL_TIMEOUT),
            )

            if readable:
                conn.poll()
                while conn.notifies:
                    notify = conn.notifies.pop(0)
                    yield f"data: {notify.payload}\n\n"
                    try:
                        event = json.loads(notify.payload)
                        if event.get("event_type") in _TERMINAL_EVENTS:
                            logger.debug(
                                "Terminal event via LISTEN for campaign_id=%s", campaign_id
                            )
                            return
                    except (json.JSONDecodeError, AttributeError):
                        pass

    except GeneratorExit:
        logger.debug("Client disconnected from campaign_id=%s stream", campaign_id)
    finally:
        if conn is not None:
            conn.close()


# ── Route ─────────────────────────────────────────────────────────────────────

@router.get(
    "/campaigns/{campaign_id}",
    summary="Live SSE stream for a campaign (backed by PostgreSQL LISTEN/NOTIFY)",
    response_class=StreamingResponse,
)
async def stream_campaign(
    campaign_id: uuid.UUID,
    after_seq: int = Query(
        default=0,
        ge=0,
        description="Replay events with seq > this value before going live. "
                    "Pass the last seq you received to reconnect without losing events.",
    ),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_from_query),
):
    row = campaign_repo.get_by_id(db, campaign_id, current_user["id"])
    if not row:
        raise NotFoundError(f"Campaign {campaign_id} not found")

    logger.info(
        "SSE connection opened campaign_id=%s user_id=%s after_seq=%s",
        campaign_id, current_user["id"], after_seq,
    )

    return StreamingResponse(
        _event_generator(str(campaign_id), after_seq),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # prevent nginx from buffering SSE frames
            "Connection": "keep-alive",
        },
    )
