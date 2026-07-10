"""Retry helper for transient external-service failures.

kie.ai intermittently returns HTTP 400 payloads with null `choices` (e.g.
"The server is currently being maintained"), which langchain surfaces as a
TypeError. Those calls succeed on retry, so LLM call sites wrap themselves
in call_with_retries. Non-transient errors are re-raised immediately.
"""

from __future__ import annotations

import asyncio
from typing import Awaitable, Callable, TypeVar

from utils.logger import get_logger

logger = get_logger(__name__)

T = TypeVar("T")

# Substrings that identify a retryable provider hiccup.
_TRANSIENT_MARKERS = (
    "null value for 'choices'",   # langchain's error for kie's 400 payloads
    "being maintained",
    "rate limit",
    "temporarily",
    "overloaded",
    "timeout",
    "timed out",
    "connection",
    "bad gateway",
    "service unavailable",
)


def is_transient(exc: Exception) -> bool:
    if isinstance(exc, (ConnectionError, TimeoutError, asyncio.TimeoutError)):
        return True
    message = str(exc).lower()
    return any(marker in message for marker in _TRANSIENT_MARKERS)


async def call_with_retries(
    fn: Callable[[], Awaitable[T]],
    *,
    label: str,
    attempts: int = 3,
    base_delay: float = 2.0,
) -> T:
    """Run `fn`, retrying transient failures with exponential backoff."""
    for attempt in range(1, attempts + 1):
        try:
            return await fn()
        except Exception as exc:
            if attempt == attempts or not is_transient(exc):
                raise
            delay = base_delay * (2 ** (attempt - 1))
            logger.warning(
                "%s: transient failure (attempt %d/%d), retrying in %.0fs: %s",
                label, attempt, attempts, delay, exc,
            )
            await asyncio.sleep(delay)
    raise RuntimeError(f"{label}: unreachable")  # pragma: no cover
