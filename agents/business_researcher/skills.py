"""URL-based business onboarding — Stage 2: structuring (pure LLM call, no
tools, no research). Same calling shape as every other multi-stage agent in
this codebase (agents/strategist/skills.py, agents/producer/skills.py):
.ainvoke() + manual JSON parse/validate + one repair turn — not
.with_structured_output(), matching the established kie.ai proxy-quirk reason.
"""

from __future__ import annotations

from typing import Type, TypeVar

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, ValidationError

from agents.business_researcher.prompts import (
    PRODUCT_STRUCTURING_SYSTEM_PROMPT,
    STRUCTURING_SYSTEM_PROMPT,
    build_product_structuring_input,
    build_structuring_input,
)
from agents.business_researcher.schemas import BusinessFindings, ProductFindings
from agents.business_researcher.validation import BusinessResearchError
from agents.strategist.validation import parse_json_object
from schemas.business import CreateBusinessRequest
from schemas.product import CreateProductRequest
from utils.LLM.factory import get_llm_model
from utils.LLM.schemas import LLMConfig
from utils.logger import get_logger
from utils.retry import call_with_retries

logger = get_logger(__name__)

_STRUCTURING_LLM_CONFIG = LLMConfig(
    provider="kie",
    model_name="gemini-2.5-flash",
    temperature=0.3,
    max_tokens=6000,
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


async def _call_llm(system_prompt: str, user_prompt: str, label: str) -> str:
    llm = get_llm_model(_STRUCTURING_LLM_CONFIG)

    async def _once() -> str:
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])
        return _content_to_text(response.content)

    return await call_with_retries(_once, label=label)


async def _generate_validated(
    output_model: Type[T],
    system_prompt: str,
    user_prompt: str,
    label: str,
    post_process: "callable[[dict], dict] | None" = None,
) -> T:
    """One flash call → parse → validate, with a single repair turn on
    failure — mirrors _generate_validated in agents/strategist/skills.py and
    agents/producer/skills.py exactly. post_process runs on the parsed dict
    before validation, e.g. to inject a code-owned field the LLM never sees."""
    raw = await _call_llm(system_prompt, user_prompt, label)

    for attempt in (1, 2):
        try:
            data = parse_json_object(raw)
            if post_process:
                data = post_process(data)
            return output_model.model_validate(data)
        except (ValueError, ValidationError) as exc:
            if attempt == 2:
                raise BusinessResearchError(
                    f"{label}: output failed validation after repair: {exc}"
                ) from exc
            logger.warning("%s: output invalid, running repair turn: %s", label, exc)
            raw = await _call_llm(
                system_prompt,
                f"{user_prompt}\n\n"
                f"## REPAIR\nYour previous response failed validation:\n{exc}\n\n"
                f"Previous response:\n{raw[:3000]}\n\n"
                f"Re-emit the COMPLETE corrected JSON object now — nothing else.",
                label,
            )

    raise BusinessResearchError(f"{label}: unreachable")  # pragma: no cover


def _force_url_onboarding_path(data: dict) -> dict:
    data["onboarding_path"] = "url"  # code-owned, never LLM-authored — see schemas/business.py
    return data


async def structure_business_findings(findings: BusinessFindings, url: str) -> CreateBusinessRequest:
    user_prompt = build_structuring_input(findings.model_dump_json(indent=2), url)
    return await _generate_validated(
        CreateBusinessRequest, STRUCTURING_SYSTEM_PROMPT, user_prompt,
        "structure_business_findings", post_process=_force_url_onboarding_path,
    )


async def structure_product_findings(findings: ProductFindings, url: str) -> CreateProductRequest:
    user_prompt = build_product_structuring_input(findings.model_dump_json(indent=2), url)
    return await _generate_validated(
        CreateProductRequest, PRODUCT_STRUCTURING_SYSTEM_PROMPT, user_prompt,
        "structure_product_findings",
    )
