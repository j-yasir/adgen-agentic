from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage
from langgraph.types import interrupt

from db.session import SessionLocal
from repos import business_repo, campaign_repo
from services import streaming_service
from utils.logger import get_logger
from utils.storage import save_generation

from agents.researcher.agent import researcher_agent
from agents.strategist.graph import strategist_agent
from agents.producer.graph import producer_agent
from agents.auditor.graph import auditor_agent

from orchestrator.state import CampaignState

logger = get_logger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _db():
    """Open a fresh SQLAlchemy session. Caller must close it."""
    return SessionLocal()


def _emit(db, campaign_id: str, event_type: str, agent: str | None, payload: dict):
    streaming_service.emit(
        db,
        campaign_id=campaign_id,
        event_type=event_type,
        agent=agent,
        payload=payload,
    )


async def _run_agent_streaming(agent, input: dict, campaign_id: str, agent_name: str) -> dict:
    """Run an agent via astream_events and emit granular SSE events for each step.

    Yields tool_call and tool_result events in real-time so the frontend
    can show exactly what the agent is doing as it works.
    Returns the final result dict (same as ainvoke would return).
    """
    db = _db()
    final_result = None
    try:
        async for event in agent.agent.astream_events(input, version="v2"):
            kind = event["event"]

            if kind == "on_tool_start":
                tool_input = event.get("data", {}).get("input", {})
                _emit(db, campaign_id, "tool_call", agent_name, {
                    "tool": event["name"],
                    "input": str(tool_input)[:500],
                })

            elif kind == "on_tool_end":
                tool_output = event.get("data", {}).get("output", "")
                _emit(db, campaign_id, "tool_result", agent_name, {
                    "tool": event["name"],
                    "result_summary": str(tool_output)[:500],
                })

            elif kind == "on_chain_end" and event.get("name") == agent_name:
                final_result = event.get("data", {}).get("output", {})

        if final_result is None:
            final_result = await agent.ainvoke(input)

    finally:
        db.close()

    return final_result


def _extract_json(result: Any, key: str) -> Any:
    """Pull `key` out of an agent result — handles both dict and string responses."""
    if isinstance(result, dict):
        return result.get(key)
    if isinstance(result, str):
        try:
            return json.loads(result).get(key)
        except json.JSONDecodeError:
            return None
    return None


# ── Node 1: load_bko ──────────────────────────────────────────────────────────

async def load_bko(state: CampaignState) -> dict:
    """Load the full BKO from the DB and hydrate the campaign fields."""
    db = _db()
    try:
        _emit(db, state["campaign_id"], "agent_started", "orchestrator",
              {"message": "Pipeline started — loading business knowledge object"})

        business = business_repo.get_by_id(db, state["business_id"], state["user_id"])
        if not business:
            campaign_repo.update_status(
                db, campaign_id=state["campaign_id"], status="failed",
                error="Business not found",
            )
            _emit(db, state["campaign_id"], "campaign_failed", "orchestrator",
                  {"error": "Business not found"})
            return {"error": "Business not found", "bko": {}}

        campaign = campaign_repo.get_by_id(db, state["campaign_id"], state["user_id"])
        if not campaign:
            return {"error": "Campaign not found", "bko": {}}

        campaign_repo.update_status(
            db, campaign_id=state["campaign_id"], status="running",
        )
        _emit(db, state["campaign_id"], "status_changed", "orchestrator",
              {"status": "running", "message": "BKO loaded — starting research"})

        result = {
            "bko":           business.get("bko") or {},
            "objective":     campaign["objective"],
            "platforms":     campaign["platforms"],
            "funnel_stage":  campaign["funnel_stage"],
            "num_variants":  campaign["num_variants"],
            "special_brief": campaign.get("special_brief"),
            "retry_count":   campaign.get("retry_count", 0),
            "error":         None,
        }

        save_generation(state["campaign_id"], "campaign_overview.json", {
            "campaign_id":  state["campaign_id"],
            "business_id":  state["business_id"],
            "business_name": business.get("name"),
            "objective":    campaign["objective"],
            "platforms":    campaign["platforms"],
            "funnel_stage": campaign["funnel_stage"],
            "num_variants": campaign["num_variants"],
            "special_brief": campaign.get("special_brief"),
        })

        return result
    finally:
        db.close()


# ── Node 2: run_researcher ────────────────────────────────────────────────────

async def run_researcher(state: CampaignState) -> dict:
    from agents.researcher.prompts import build_input

    db = _db()
    try:
        _emit(db, state["campaign_id"], "agent_started", "researcher",
              {"message": "Researcher agent starting"})
    finally:
        db.close()

    try:
        result = await _run_agent_streaming(
            researcher_agent,
            {"messages": [HumanMessage(content=build_input(state))]},
            state["campaign_id"],
            "researcher",
        )

        final_msg = result["messages"][-1]
        if isinstance(final_msg.content, str):
            try:
                research_report = json.loads(final_msg.content)
            except (json.JSONDecodeError, TypeError):
                research_report = {"raw_output": final_msg.content}
        elif isinstance(final_msg.content, dict):
            research_report = final_msg.content
        else:
            research_report = {"raw_output": str(final_msg.content)}

        db2 = _db()
        try:
            _emit(db2, state["campaign_id"], "agent_completed", "researcher",
                  {"message": "Research complete", "summary": str(research_report)[:200]})
        finally:
            db2.close()

        save_generation(state["campaign_id"], "research_report.json", research_report)

        return {"research_report": research_report}
    except Exception as exc:
        logger.exception("Researcher agent failed campaign_id=%s", state["campaign_id"])
        db3 = _db()
        try:
            _emit(db3, state["campaign_id"], "agent_error", "researcher",
                  {"error": str(exc)})
        finally:
            db3.close()
        return {"error": str(exc)}


# ── Node 3: hitl_research_review ─────────────────────────────────────────────

async def hitl_research_review(state: CampaignState) -> dict:
    """
    Pause execution and wait for the human to approve the research report.
    interrupt() suspends the graph here; the node re-executes from the top on resume.
    """
    db = _db()
    try:
        # Only emit + update status on the FIRST pass (before interrupt).
        # On resume, hitl_response is already set by the previous interrupt return.
        if not state.get("hitl_response"):
            campaign_repo.update_status(
                db, campaign_id=state["campaign_id"], status="awaiting_review",
            )
            _emit(db, state["campaign_id"], "hitl_required", "orchestrator", {
                "checkpoint": "research_review",
                "message": "Research report ready for review",
                "data": state.get("research_report"),
            })
    finally:
        db.close()

    response: dict = interrupt({"checkpoint": "research_review"})

    db2 = _db()
    try:
        campaign_repo.update_status(db2, campaign_id=state["campaign_id"], status="running")
        _emit(db2, state["campaign_id"], "status_changed", "orchestrator",
              {"status": "running", "message": "Research approved — building strategy"})
    finally:
        db2.close()

    return {"hitl_response": response}


# ── Node 4: run_strategist ────────────────────────────────────────────────────

async def run_strategist(state: CampaignState) -> dict:
    db = _db()
    try:
        _emit(db, state["campaign_id"], "agent_started", "strategist",
              {"message": "Strategist agent starting"})

        result = await strategist_agent.ainvoke(dict(state))
        strategy_doc = _extract_json(result, "strategy_doc") or result.get("strategy_doc")

        avg_score = None  # computed after audit; not available yet
        campaign_repo.update_status(
            db, campaign_id=state["campaign_id"], status="running",
            strategy_doc=strategy_doc,
        )
        _emit(db, state["campaign_id"], "agent_completed", "strategist",
              {"message": "Strategy document ready", "summary": str(strategy_doc)[:200]})

        save_generation(state["campaign_id"], "strategy_doc.json", strategy_doc)

        return {"strategy_doc": strategy_doc}
    except Exception as exc:
        logger.exception("Strategist agent failed campaign_id=%s", state["campaign_id"])
        _emit(db, state["campaign_id"], "agent_error", "strategist", {"error": str(exc)})
        return {"error": str(exc)}
    finally:
        db.close()


# ── Node 5: hitl_plan_approval ────────────────────────────────────────────────

async def hitl_plan_approval(state: CampaignState) -> dict:
    """Pause for human approval of the strategy document."""
    db = _db()
    try:
        if not state.get("hitl_response"):
            campaign_repo.update_status(
                db, campaign_id=state["campaign_id"], status="awaiting_review",
            )
            _emit(db, state["campaign_id"], "hitl_required", "orchestrator", {
                "checkpoint": "plan_approval",
                "message": "Strategy document ready for approval",
                "data": state.get("strategy_doc"),
            })
    finally:
        db.close()

    response: dict = interrupt({"checkpoint": "plan_approval"})

    db2 = _db()
    try:
        campaign_repo.update_status(db2, campaign_id=state["campaign_id"], status="running")
        _emit(db2, state["campaign_id"], "status_changed", "orchestrator",
              {"status": "running", "message": "Strategy approved — producing assets"})
    finally:
        db2.close()

    return {"hitl_response": response}


# ── Node 6: run_producer ──────────────────────────────────────────────────────

async def run_producer(state: CampaignState) -> dict:
    db = _db()
    try:
        _emit(db, state["campaign_id"], "agent_started", "producer",
              {"message": "Producer agent starting", "retry": state.get("retry_count", 0)})

        result = await producer_agent.ainvoke(dict(state))
        assets: list[dict] = _extract_json(result, "generated_assets") or result.get("generated_assets", [])

        # Persist each asset to the DB
        for asset in assets:
            record = campaign_repo.create_asset(
                db,
                campaign_id=state["campaign_id"],
                platform=asset.get("platform", "unknown"),
                format=asset.get("format", "unknown"),
                asset_type="ad_copy",
                storage_url=asset.get("storage_url") or "",
                prompt_used=asset.get("visual_description"),
            )
            asset["asset_id"] = str(record["id"])

        _emit(db, state["campaign_id"], "agent_completed", "producer",
              {"message": f"{len(assets)} asset(s) produced", "asset_count": len(assets)})

        save_generation(state["campaign_id"], "generated_assets.json", {"assets": assets})

        return {"generated_assets": assets, "audit_results": [], "assets_approved": [], "assets_rejected": []}
    except Exception as exc:
        logger.exception("Producer agent failed campaign_id=%s", state["campaign_id"])
        _emit(db, state["campaign_id"], "agent_error", "producer", {"error": str(exc)})
        return {"error": str(exc)}
    finally:
        db.close()


# ── Node 7: run_auditor ───────────────────────────────────────────────────────

async def run_auditor(state: CampaignState) -> dict:
    db = _db()
    try:
        _emit(db, state["campaign_id"], "agent_started", "auditor",
              {"message": "Auditor agent starting"})

        result = await auditor_agent.ainvoke(dict(state))

        audit_results: list[dict] = result.get("audit_results", [])
        assets_approved: list[str] = result.get("assets_approved", [])
        assets_rejected: list[str] = result.get("assets_rejected", [])

        # Compute campaign-level audit score (average of all weighted_avg values)
        scores = [r["weighted_avg"] for r in audit_results if "weighted_avg" in r]
        audit_score = round(sum(scores) / len(scores), 2) if scores else None

        retry_count = state.get("retry_count", 0) + (1 if assets_rejected else 0)

        campaign_repo.update_status(
            db, campaign_id=state["campaign_id"], status="running",
            audit_score=audit_score,
        )
        _emit(db, state["campaign_id"], "agent_completed", "auditor", {
            "message": "Audit complete",
            "approved": len(assets_approved),
            "rejected": len(assets_rejected),
            "audit_score": audit_score,
        })

        save_generation(state["campaign_id"], "audit_results.json", {
            "audit_results":   audit_results,
            "assets_approved": assets_approved,
            "assets_rejected": assets_rejected,
            "audit_score":     audit_score,
        })

        return {
            "audit_results":   audit_results,
            "assets_approved": assets_approved,
            "assets_rejected": assets_rejected,
            "retry_count":     retry_count,
        }
    except Exception as exc:
        logger.exception("Auditor agent failed campaign_id=%s", state["campaign_id"])
        _emit(db, state["campaign_id"], "agent_error", "auditor", {"error": str(exc)})
        return {"error": str(exc)}
    finally:
        db.close()


# ── Node 8: hitl_asset_review ─────────────────────────────────────────────────

async def hitl_asset_review(state: CampaignState) -> dict:
    """Final human review of produced + audited assets."""
    db = _db()
    try:
        if not state.get("hitl_response"):
            campaign_repo.update_status(
                db, campaign_id=state["campaign_id"], status="awaiting_review",
            )
            _emit(db, state["campaign_id"], "hitl_required", "orchestrator", {
                "checkpoint": "asset_review",
                "message": "Assets ready for final review",
                "data": {
                    "assets":          state.get("generated_assets"),
                    "audit_results":   state.get("audit_results"),
                    "assets_approved": state.get("assets_approved"),
                    "assets_rejected": state.get("assets_rejected"),
                },
            })
    finally:
        db.close()

    response: dict = interrupt({"checkpoint": "asset_review"})

    db2 = _db()
    try:
        campaign_repo.update_status(db2, campaign_id=state["campaign_id"], status="running")
        _emit(db2, state["campaign_id"], "status_changed", "orchestrator",
              {"status": "running", "message": "Asset review received — finalising campaign"})
    finally:
        db2.close()

    return {"hitl_response": response}


# ── Node 9: campaign_done ─────────────────────────────────────────────────────

async def campaign_done(state: CampaignState) -> dict:
    db = _db()
    try:
        campaign_repo.update_status(
            db, campaign_id=state["campaign_id"], status="completed",
        )
        _emit(db, state["campaign_id"], "campaign_done", "orchestrator", {
            "message": "Campaign pipeline completed successfully",
            "assets_approved": state.get("assets_approved"),
        })
        logger.info("Campaign completed campaign_id=%s", state["campaign_id"])
    finally:
        db.close()
    return {}


# ── Node 10: campaign_failed ──────────────────────────────────────────────────

async def campaign_failed(state: CampaignState) -> dict:
    db = _db()
    try:
        error_msg = state.get("error") or "Unknown error"
        campaign_repo.update_status(
            db, campaign_id=state["campaign_id"], status="failed", error=error_msg,
        )
        _emit(db, state["campaign_id"], "campaign_failed", "orchestrator", {
            "error": error_msg,
        })
        logger.error("Campaign failed campaign_id=%s error=%s", state["campaign_id"], error_msg)
    finally:
        db.close()
    return {}
