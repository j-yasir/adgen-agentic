from __future__ import annotations

from typing import TYPE_CHECKING

from langgraph.graph import StateGraph, END

from orchestrator.state import CampaignState
from orchestrator.edges import route_after_audit, route_after_review
from orchestrator.nodes import (
    load_bko,
    run_researcher,
    hitl_research_review,
    run_strategist,
    hitl_plan_approval,
    run_producer,
    run_auditor,
    hitl_asset_review,
    campaign_done,
    campaign_failed,
)

if TYPE_CHECKING:
    from langgraph.graph.state import CompiledStateGraph

# Module-level cache — set once during app lifespan by set_compiled_graph()
_compiled_graph: CompiledStateGraph | None = None


def build_graph(checkpointer) -> "CompiledStateGraph":
    """
    Build and compile the campaign pipeline graph.
    Called once at startup with the AsyncPostgresSaver checkpointer.
    """
    g = StateGraph(CampaignState)

    # ── Nodes ─────────────────────────────────────────────────────────────────
    g.add_node("load_bko",              load_bko)
    g.add_node("run_researcher",        run_researcher)
    g.add_node("hitl_research_review",  hitl_research_review)
    g.add_node("run_strategist",        run_strategist)
    g.add_node("hitl_plan_approval",    hitl_plan_approval)
    g.add_node("run_producer",          run_producer)
    g.add_node("run_auditor",           run_auditor)
    g.add_node("hitl_assets",           hitl_asset_review)
    g.add_node("campaign_done",         campaign_done)
    g.add_node("campaign_failed",       campaign_failed)

    # ── Entry ─────────────────────────────────────────────────────────────────
    g.set_entry_point("load_bko")

    # ── Linear edges ──────────────────────────────────────────────────────────
    g.add_edge("load_bko",             "run_researcher")
    g.add_edge("run_researcher",       "hitl_research_review")
    g.add_edge("hitl_research_review", "run_strategist")
    g.add_edge("run_strategist",       "hitl_plan_approval")
    g.add_edge("hitl_plan_approval",   "run_producer")
    g.add_edge("run_producer",         "run_auditor")

    # ── Conditional edges ─────────────────────────────────────────────────────
    # After audit: retry with producer OR move to human review
    g.add_conditional_edges(
        "run_auditor",
        route_after_audit,
        {
            "run_producer": "run_producer",
            "hitl_assets":  "hitl_assets",
        },
    )

    # After human review: always finish
    g.add_conditional_edges(
        "hitl_assets",
        route_after_review,
        {
            "campaign_done": "campaign_done",
        },
    )

    g.add_edge("campaign_done",   END)
    g.add_edge("campaign_failed", END)

    return g.compile(checkpointer=checkpointer)


def set_compiled_graph(graph: "CompiledStateGraph") -> None:
    global _compiled_graph
    _compiled_graph = graph


def get_compiled_graph() -> "CompiledStateGraph":
    if _compiled_graph is None:
        raise RuntimeError("Graph has not been compiled yet — check app lifespan setup")
    return _compiled_graph
