from __future__ import annotations

from db.session import SessionLocal
from repos import campaign_repo
from services import streaming_service
from orchestrator.graph import get_compiled_graph
from utils.logger import get_logger

logger = get_logger(__name__)


async def run_pipeline(
    *,
    campaign_id: str,
    business_id: str,
    user_id: str,
) -> None:
    """
    Entry point for a brand-new campaign run.
    Called as a FastAPI BackgroundTask so it runs outside the HTTP request.
    thread_id = campaign_id so LangGraph checkpoints tie directly to the DB record.
    """
    graph = get_compiled_graph()
    config = {"configurable": {"thread_id": campaign_id}}

    initial_state: dict = {
        "campaign_id":     campaign_id,
        "business_id":     business_id,
        "user_id":         user_id,
        "bko":             {},
        "objective":       "",
        "platforms":       [],
        "funnel_stage":    "",
        "num_variants":    1,
        "special_brief":   None,
        "research_report": None,
        "strategy_doc":    None,
        "generated_assets": [],
        "audit_results":   [],
        "assets_approved": [],
        "assets_rejected": [],
        "retry_count":     0,
        "hitl_response":   None,
        "error":           None,
    }

    try:
        logger.info("Starting pipeline campaign_id=%s", campaign_id)
        await graph.ainvoke(initial_state, config=config)
        logger.info("Pipeline run finished (may be paused at HITL) campaign_id=%s", campaign_id)
    except Exception as exc:
        logger.exception("Unhandled exception in pipeline campaign_id=%s", campaign_id)
        db = SessionLocal()
        try:
            campaign_repo.update_status(
                db, campaign_id=campaign_id, status="failed", error=str(exc),
            )
            streaming_service.emit(
                db,
                campaign_id=campaign_id,
                event_type="campaign_failed",
                agent="orchestrator",
                payload={"error": str(exc)},
            )
        finally:
            db.close()


async def run_resume(
    *,
    campaign_id: str,
    hitl_response: dict,
) -> None:
    """
    Resume a graph that is paused at an interrupt() checkpoint.
    Called as a FastAPI BackgroundTask via the resume endpoint.
    Command(resume=hitl_response) is passed to the graph so the interrupt() call
    returns the value, and the node continues from where it left off.
    """
    from langgraph.types import Command

    graph = get_compiled_graph()
    config = {"configurable": {"thread_id": campaign_id}}

    try:
        logger.info("Resuming pipeline campaign_id=%s", campaign_id)
        await graph.ainvoke(Command(resume=hitl_response), config=config)
        logger.info("Resume run finished (may pause again at next HITL) campaign_id=%s", campaign_id)
    except Exception as exc:
        logger.exception("Unhandled exception on resume campaign_id=%s", campaign_id)
        db = SessionLocal()
        try:
            campaign_repo.update_status(
                db, campaign_id=campaign_id, status="failed", error=str(exc),
            )
            streaming_service.emit(
                db,
                campaign_id=campaign_id,
                event_type="campaign_failed",
                agent="orchestrator",
                payload={"error": str(exc)},
            )
        finally:
            db.close()
