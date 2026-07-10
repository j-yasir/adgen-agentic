from __future__ import annotations

from db.session import SessionLocal
from repos import campaign_repo
from services import streaming_service
from orchestrator.graph import get_compiled_graph
from orchestrator.nodes import NodeExecutionError
from utils.logger import get_logger

logger = get_logger(__name__)


def _persist_failure(campaign_id: str, exc: Exception) -> None:
    """Record a pipeline failure, distinguishing a retryable node failure
    (NodeExecutionError, raised after RetryPolicy exhausts its attempts) from
    an unexpected framework-level error. Only the former sets resumable=True —
    /retry re-enters the LangGraph checkpoint at that node instead of forcing
    a full campaign relaunch.
    """
    if isinstance(exc, NodeExecutionError):
        error_message = str(exc.original)
        failed_node = exc.node_name
        resumable = True
    else:
        error_message = str(exc)
        failed_node = None
        resumable = False

    db = SessionLocal()
    try:
        campaign_repo.update_status(
            db, campaign_id=campaign_id, status="failed",
            error=error_message, resumable=resumable, failed_node=failed_node,
        )
        streaming_service.emit(
            db,
            campaign_id=campaign_id,
            event_type="campaign_failed",
            agent="orchestrator",
            payload={"error": error_message, "failed_node": failed_node, "resumable": resumable},
        )
    finally:
        db.close()


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
        "campaign_name":   None,
        "objective":       "",
        "platforms":       [],
        "asset_types":     [],
        "funnel_stage":    "",
        "num_variants":    1,
        "hero_products":   [],
        "tone_override":   None,
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
        _persist_failure(campaign_id, exc)


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
        _persist_failure(campaign_id, exc)


async def run_retry(*, campaign_id: str) -> None:
    """
    Retry a campaign that failed at a node after RetryPolicy exhausted its
    automatic attempts (campaigns.resumable=True, see NodeExecutionError).

    Passing None as input tells LangGraph to continue from the thread's last
    checkpoint rather than starting over — the researcher/strategist steps
    that already completed are NOT re-run, only the failed node onward. This
    is what makes retry cheap: no re-planning, no re-spending LLM calls on
    work that already succeeded.
    """
    graph = get_compiled_graph()
    config = {"configurable": {"thread_id": campaign_id}}

    try:
        logger.info("Retrying pipeline from last checkpoint campaign_id=%s", campaign_id)
        await graph.ainvoke(None, config=config)
        logger.info("Retry run finished (may pause at HITL or complete) campaign_id=%s", campaign_id)
    except Exception as exc:
        logger.exception("Unhandled exception on retry campaign_id=%s", campaign_id)
        _persist_failure(campaign_id, exc)
