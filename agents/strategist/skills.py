"""Specialist copy skills — Stage 2 of the strategist pipeline.

These are plain async functions (NOT agent tools). The pipeline fans out to
them in parallel, one call per asset. Each skill makes a single flash call
with a domain playbook baked into its system prompt and returns a validated
Pydantic copy object. A JSON/schema failure triggers exactly one repair call
with the error quoted back; a second failure raises StrategistError.
"""

from __future__ import annotations

from typing import Type, TypeVar

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, ValidationError

from agents.strategist.playbooks import (
    EMAIL_PLAYBOOK,
    STATIC_IMAGE_PLAYBOOK,
    VIDEO_AD_PLAYBOOK,
)
from agents.strategist.schemas import EmailCopy, StaticCopy, VideoCopy
from agents.strategist.validation import StrategistError, parse_json_object
from utils.LLM.factory import get_llm_model
from utils.LLM.schemas import LLMConfig
from utils.logger import get_logger
from utils.retry import call_with_retries

logger = get_logger(__name__)

_COPY_LLM_CONFIG = LLMConfig(
    provider="kie",
    model_name="gemini-2.5-flash",
    temperature=0.6,   # copy benefits from creative variation
    max_tokens=2500,
)

T = TypeVar("T", bound=BaseModel)


def _content_to_text(content) -> str:
    """Gemini via kie sometimes returns a list of content parts."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [p.get("text", "") if isinstance(p, dict) else str(p) for p in content]
        return "".join(parts)
    return str(content)


async def _call_llm(system_prompt: str, user_prompt: str) -> str:
    llm = get_llm_model(_COPY_LLM_CONFIG)

    async def _once() -> str:
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])
        return _content_to_text(response.content)

    return await call_with_retries(_once, label="strategist_copy_skill")


async def _generate_validated(
    output_model: Type[T],
    system_prompt: str,
    user_prompt: str,
    label: str,
) -> T:
    """One flash call → parse → validate, with a single repair turn on failure."""
    raw = await _call_llm(system_prompt, user_prompt)

    for attempt in (1, 2):
        try:
            return output_model.model_validate(parse_json_object(raw))
        except (ValueError, ValidationError) as exc:
            if attempt == 2:
                raise StrategistError(
                    f"{label}: output failed validation after repair: {exc}"
                ) from exc
            logger.warning("%s: output invalid, running repair turn: %s", label, exc)
            raw = await _call_llm(
                system_prompt,
                f"{user_prompt}\n\n"
                f"## REPAIR\nYour previous response failed validation:\n{exc}\n\n"
                f"Previous response:\n{raw[:3000]}\n\n"
                f"Re-emit the COMPLETE corrected JSON object now — nothing else.",
            )

    raise StrategistError(f"{label}: unreachable")  # pragma: no cover


# ── Public skills ─────────────────────────────────────────────────────────────

async def write_static_ad(user_prompt: str, extra_instructions: str = "") -> StaticCopy:
    """Write complete copy + image brief for one static image ad."""
    prompt = user_prompt + (f"\n\n## Additional requirements\n{extra_instructions}" if extra_instructions else "")
    return await _generate_validated(StaticCopy, STATIC_IMAGE_PLAYBOOK, prompt, "write_static_ad")


async def write_video_script(user_prompt: str, extra_instructions: str = "") -> VideoCopy:
    """Write a complete timed script + copy for one video ad."""
    prompt = user_prompt + (f"\n\n## Additional requirements\n{extra_instructions}" if extra_instructions else "")
    return await _generate_validated(VideoCopy, VIDEO_AD_PLAYBOOK, prompt, "write_video_script")


async def write_email(user_prompt: str, extra_instructions: str = "") -> EmailCopy:
    """Write one complete direct-response email."""
    prompt = user_prompt + (f"\n\n## Additional requirements\n{extra_instructions}" if extra_instructions else "")
    return await _generate_validated(EmailCopy, EMAIL_PLAYBOOK, prompt, "write_email")
