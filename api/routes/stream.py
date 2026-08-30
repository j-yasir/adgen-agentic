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

from typing import Callable

from api.dependencies import get_current_user_from_query
from config import settings
from db.session import SessionLocal, get_db
from repos import business_repo, campaign_repo
from utils.exceptions import NotFoundError
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/stream", tags=["stream"])

_CAMPAIGN_TERMINAL_EVENTS = {"campaign_done", "campaign_failed"}
_BUSINESS_TERMINAL_EVENTS = {"business_ready", "business_failed"}
_HEARTBEAT_INTERVAL = 15   # seconds between heartbeat frames
_POLL_TIMEOUT = 2          # seconds each select() call blocks before looping


# ── Helpers ───────────────────────────────────────────────────────────────────

def _raw_dsn() -> str:
    """Strip SQLAlchemy dialect prefix so psycopg2.connect() accepts the URL."""
    return settings.DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://", 1)


def _open_listen_conn(dsn: str, channel: str) -> psycopg2.extensions.connection:
    """Blocking: open a dedicated psycopg2 connection and issue LISTEN."""
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(f'LISTEN "{channel}"')
    cur.close()
    return conn


def _format_sse(event: dict) -> str:
    return f"data: {json.dumps(event, default=str)}\n\n"


# ── SSE generator ─────────────────────────────────────────────────────────────
#
# Shared by both /campaigns/{id} and /businesses/{id}: the LISTEN/NOTIFY,
# catch-up, heartbeat, and reconnect mechanics are identical for both — only
# the pg_notify channel name, which repo function re-reads full rows, and
# which event_type values end the stream differ. Parameterized rather than
# duplicated so a future fix to this fairly intricate async/psycopg2 plumbing
# only has to happen once.

async def _event_generator(
    *,
    entity_id: str,
    channel: str,
    after_seq: int,
    get_events: Callable[..., list[dict]],
    terminal_events: set[str],
) -> AsyncGenerator[str, None]:
    dsn = _raw_dsn()
    loop = asyncio.get_running_loop()

    # Open the LISTEN connection BEFORE fetching catch-up rows so no events
    # emitted between the two steps can slip through unnoticed.
    conn: Optional[psycopg2.extensions.connection] = None
    try:
        conn = await loop.run_in_executor(
            None, _open_listen_conn, dsn, channel
        )
        logger.debug("SSE LISTEN open channel=%s after_seq=%s", channel, after_seq)

        # ── Catch-up: replay events already in DB ─────────────────────────────
        # Send ALL missed events before checking for a terminal — a campaign
        # can fail and then be retried, so `campaign_failed` is not necessarily
        # the last event. We only close if the very last event was terminal.
        last_seq = after_seq
        last_event_type: str | None = None
        db = SessionLocal()
        try:
            missed = get_events(db, entity_id, after_seq=after_seq)
            for event in missed:
                last_seq = event["seq"]
                last_event_type = event["event_type"]
                yield _format_sse(event)
        finally:
            db.close()

        if last_event_type in terminal_events:
            logger.debug("Last catch-up event is terminal channel=%s type=%s", channel, last_event_type)
            return

        # ── Live stream via pg_notify ─────────────────────────────────────────
        # NOTIFY carries only a slim envelope (pg_notify payloads are capped at
        # 8000 bytes; agent payloads exceed that). It is purely a wake-up
        # signal: on notification we re-read the full rows from the DB by seq,
        # which also dedupes bursts of notifications into one fetch.
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
                if not conn.notifies:
                    continue
                conn.notifies.clear()

                db = SessionLocal()
                try:
                    new_events = get_events(db, entity_id, after_seq=last_seq)
                finally:
                    db.close()

                for event in new_events:
                    last_seq = event["seq"]
                    yield _format_sse(event)
                    if event["event_type"] in terminal_events:
                        logger.debug("Terminal event via LISTEN channel=%s", channel)
                        return

    except GeneratorExit:
        logger.debug("Client disconnected from channel=%s stream", channel)
    finally:
        if conn is not None:
            conn.close()


# ── Routes ────────────────────────────────────────────────────────────────────

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
        _event_generator(
            entity_id=str(campaign_id),
            channel=f"campaign_{campaign_id}",
            after_seq=after_seq,
            get_events=campaign_repo.get_events,
            terminal_events=_CAMPAIGN_TERMINAL_EVENTS,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # prevent nginx from buffering SSE frames
            "Connection": "keep-alive",
        },
    )


@router.get(
    "/businesses/{business_id}",
    summary="Live SSE stream for URL-based business onboarding (same mechanics as /campaigns/{id})",
    response_class=StreamingResponse,
)
async def stream_business(
    business_id: uuid.UUID,
    after_seq: int = Query(
        default=0,
        ge=0,
        description="Replay events with seq > this value before going live. "
                    "Pass the last seq you received to reconnect without losing events.",
    ),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_from_query),
):
    row = business_repo.get_by_id(db, business_id, current_user["id"])
    if not row:
        raise NotFoundError(f"Business {business_id} not found")

    logger.info(
        "SSE connection opened business_id=%s user_id=%s after_seq=%s",
        business_id, current_user["id"], after_seq,
    )

    return StreamingResponse(
        _event_generator(
            entity_id=str(business_id),
            channel=f"business_{business_id}",
            after_seq=after_seq,
            get_events=business_repo.get_events,
            terminal_events=_BUSINESS_TERMINAL_EVENTS,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
