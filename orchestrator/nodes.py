from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage
from langgraph.types import interrupt

from db.session import SessionLocal
from repos import business_repo, campaign_repo
from services import streaming_service
from utils.logger import get_logger

from agents.researcher.graph import researcher_agent
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

        return {
            "bko":           business.get("bko") or {},
            "objective":     campaign["objective"],
            "platforms":     campaign["platforms"],
            "funnel_stage":  campaign["funnel_stage"],
            "num_variants":  campaign["num_variants"],
            "special_brief": campaign.get("special_brief"),
            "retry_count":   campaign.get("retry_count", 0),
            "error":         None,
        }
    finally:
        db.close()


# ── Node 2: run_researcher ────────────────────────────────────────────────────

async def run_researcher(state: CampaignState) -> dict:
    db = _db()
    try:
        _emit(db, state["campaign_id"], "agent_started", "researcher",
              {"message": "Researcher agent starting"})

        result = await researcher_agent.ainvoke(dict(state))
        research_report = _extract_json(result, "research_report") or result.get("research_report")

        _emit(db, state["campaign_id"], "agent_completed", "researcher",
              {"message": "Research complete", "summary": str(research_report)[:200]})

        return {"research_report": research_report}
    except Exception as exc:
        logger.exception("Researcher agent failed campaign_id=%s", state["campaign_id"])
        _emit(db, state["campaign_id"], "agent_error", "researcher",
              {"error": str(exc)})
        return {"error": str(exc)}
    finally:
        db.close()


# ── Node 3: hitl_research_review ─────────────────────────────────────────────

async def hitl_research_review(state: CampaignState) -> dict:
    """
    Pause execution and wait for the human to approve the research report.
    interrupt() suspends the graph here; the node re-executes from the top on resume.
    Emit + status update before interrupt() so they fire on BOTH passes (idempotent).
    """
    db = _db()
    try:
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

    # Suspend here — resumes when POST /campaigns/{id}/resume is called
    response: dict = interrupt({"checkpoint": "research_review"})

    # ── Resumed ──────────────────────────────────────────────────────────────
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
