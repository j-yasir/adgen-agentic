"""URL-based business onboarding — the BackgroundTask entry point, same
overall shape as tasks/campaign_runner.py (FastAPI BackgroundTasks, not
LangGraph — this flow has no branching or HITL pause mid-run, just two
sequential stages, so the extra orchestration machinery isn't needed).

Stage 1 (research): a ReAct agent (web_search only) gathers BusinessFindings.
Stage 2 (structuring): a plain LLM call maps findings -> CreateBusinessRequest.
Then business_service.finalize_from_research() reuses build_from_form() —
identical downstream handling to the form path, since that function never
cared whether a human or an agent filled in the sections.

Streams progress via business_events / 'business_{id}' pg_notify channel —
the exact same mechanics as campaign streaming (see services/streaming_service.py
and api/routes/stream.py), just a separate table/channel per business_id
instead of campaign_id.
"""

from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage

from agents.business_researcher.agent import business_researcher_agent
from agents.business_researcher.schemas import BusinessFindings
from agents.business_researcher.skills import structure_business_findings
from agents.business_researcher.prompts import build_research_input
from agents.business_researcher.validation import BusinessResearchError
from agents.strategist.validation import parse_json_object
from db.session import SessionLocal
from services import business_service, streaming_service
from utils.logger import get_logger

logger = get_logger(__name__)


def _db():
    return SessionLocal()


def _emit(db, business_id: str, event_type: str, agent: str | None, payload: dict):
    streaming_service.emit_business_event(
        db, business_id=business_id, event_type=event_type, agent=agent, payload=payload,
    )


async def _run_research_streaming(business_id: str, url: str) -> dict[str, Any]:
    """Stage 1, tapped via astream_events for granular tool_call/tool_result
    progress — same pattern as orchestrator/nodes.py::_run_agent_streaming,
    reimplemented here (not imported) since it's tightly coupled to which
    event table/id it emits against, same as every other agent-runner in
    this codebase."""
    db = _db()
    final_result = None
    try:
        input_ = {"messages": [HumanMessage(content=build_research_input(url))]}
        async for event in business_researcher_agent.agent.astream_events(input_, version="v2"):
            kind = event["event"]

            if kind == "on_tool_start":
                tool_input = event.get("data", {}).get("input", {})
                _emit(db, business_id, "tool_call", "researcher", {
                    "tool": event["name"], "input": str(tool_input)[:500],
                })
            elif kind == "on_tool_end":
                tool_output = event.get("data", {}).get("output", "")
                _emit(db, business_id, "tool_result", "researcher", {
                    "tool": event["name"], "result_summary": str(tool_output)[:500],
                })
            elif kind == "on_chain_end" and event.get("name") == "business_researcher":
                final_result = event.get("data", {}).get("output", {})

        if final_result is None:
            final_result = await business_researcher_agent.ainvoke(input_)
    finally:
        db.close()

    return final_result


async def run_url_onboarding(*, business_id: str, user_id: str, url: str) -> None:
    db = _db()
    try:
        _emit(db, business_id, "agent_started", "researcher", {
            "message": f"Researching {url}",
        })
    finally:
        db.close()

    try:
        result = await _run_research_streaming(business_id, url)
        final_msg = result["messages"][-1]
        raw = final_msg.content if isinstance(final_msg.content, str) else str(final_msg.content)
        findings = BusinessFindings.model_validate(parse_json_object(raw))

        db = _db()
        try:
            _emit(db, business_id, "agent_completed", "researcher", {
                "message": "Research complete",
                "sources": findings.sources,
                "gaps": findings.gaps,
            })
            _emit(db, business_id, "agent_started", "system", {
                "message": "Structuring findings into a business profile",
            })
        finally:
            db.close()

        data = await structure_business_findings(findings, url)

        db = _db()
        try:
            business_service.finalize_from_research(
                db, business_id=business_id, user_id=user_id, data=data,
            )
            _emit(db, business_id, "business_ready", "system", {
                "message": "Business profile ready for review",
            })
            logger.info("URL onboarding complete business_id=%s", business_id)
        finally:
            db.close()

    except Exception as exc:
        logger.exception("URL onboarding failed business_id=%s url=%s", business_id, url)
        db = _db()
        try:
            _emit(db, business_id, "business_failed", "system", {"error": str(exc)})
            business_service.mark_onboarding_failed(db, business_id=business_id, user_id=user_id)
        finally:
            db.close()
