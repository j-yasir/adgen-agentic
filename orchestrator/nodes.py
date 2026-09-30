from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage
from langgraph.types import interrupt

from db.session import SessionLocal
from repos import business_repo, campaign_repo
from services import business_service, streaming_service
from utils.logger import get_logger
from utils.storage import save_generation

from agents.researcher.agent import researcher_agent
from agents.researcher.skills import content_to_text, repair_research_report
from agents.researcher.validation import is_substantive_report
from agents.strategist.graph import strategist_pipeline
from agents.strategist.validation import parse_json_object
from agents.producer.graph import producer_agent
from agents.auditor.graph import auditor_agent

from orchestrator.state import CampaignState

logger = get_logger(__name__)


class NodeExecutionError(Exception):
    """Raised when an agent node's work fails, instead of swallowing the error
    into a state dict.

    Two reasons this matters:
    1. LangGraph's node-level RetryPolicy only retries on a raised exception —
       a node that catches its own errors and returns {"error": ...} looks
       like a success to the graph, so RetryPolicy would never engage.
    2. Swallowed errors previously let the graph continue to the next node
       (e.g. hitl_research_review) with broken state instead of failing the
       campaign — raising makes the failure visible immediately.

    Carries node_name so campaign_runner can record which step needs a retry
    (persisted as campaigns.failed_node) without a full campaign relaunch.
    """

    def __init__(self, node_name: str, original: Exception):
        self.node_name = node_name
        self.original = original
        super().__init__(f"{node_name} failed: {original}")


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


def _human_tool_message(tool_name: str, tool_input: dict | str, is_start: bool) -> str:
    """Convert a raw tool call/result into a user-facing message."""
    q = ""
    if isinstance(tool_input, dict):
        q = str(tool_input.get("query") or tool_input.get("url") or tool_input.get("objective") or "")
    elif isinstance(tool_input, str):
        q = tool_input

    q = q.strip()[:80]

    if is_start:
        friendly = {
            "web_search":              f"Searching the web{': ' + q if q else ''}…",
            "scrape_url":              f"Reading page{': ' + q if q else ''}…",
            "retrieve_past_campaigns": "Checking past campaign performance…",
            "deep_competitor_analysis":"Analysing competitors…",
            "research_platform_trends":"Checking platform trends…",
            "generate_image":          "Generating image…",
            "generate_email_template": "Building email template…",
            # Strategist copy skills
            "write_static_ad":         f"Writing image ad copy{' for ' + q if q else ''}…",
            "write_video_script":      f"Writing video script{' for ' + q if q else ''}…",
            "write_email":             f"Writing email copy{' for ' + q if q else ''}…",
            # Producer skills
            "plan_image":              f"Planning visual composition{' — ' + q if q else ''}…",
            "plan_email_layout":       "Deciding email layout and structure…",
            "plan_email_hero_image":   "Planning email hero image…",
            "generate_static_image":   f"Generating image{' — ' + q if q else ''}…",
            "generate_email_hero":     "Generating email hero image…",
            "render_email":            "Rendering final email template…",
            # Auditor
            "audit_asset":             f"Scoring asset{' — ' + q if q else ''}…",
        }
    else:
        friendly = {
            "web_search":              "Search complete — analysing findings…",
            "scrape_url":              "Page read — extracting insights…",
            "retrieve_past_campaigns": "Past campaigns loaded…",
            "deep_competitor_analysis":"Competitor analysis done…",
            "research_platform_trends":"Platform trends captured…",
            "generate_image":          "Image generated…",
            "generate_email_template": "Email template ready…",
            "write_static_ad":         "Image ad copy written ✓",
            "write_video_script":      "Video script written ✓",
            "write_email":             "Email copy written ✓",
            "plan_image":              "Visual plan ready — sending to image generator…",
            "plan_email_layout":       "Email layout decided…",
            "plan_email_hero_image":   "Hero image plan ready…",
            "generate_static_image":   "Image generated and saved ✓",
            "generate_email_hero":     "Email hero image ready ✓",
            "render_email":            "Email template rendered ✓",
            "audit_asset":             "Asset scored ✓",
        }

    return friendly.get(tool_name, f"{'Running' if is_start else 'Finished'}: {tool_name.replace('_', ' ')}")


async def _run_agent_streaming(agent, input: dict, campaign_id: str, agent_name: str) -> dict:
    """Run an agent via astream_events and emit granular SSE events for each step."""
    db = _db()
    final_result = None
    try:
        async for event in agent.agent.astream_events(input, version="v2"):
            kind = event["event"]

            if kind == "on_tool_start":
                tool_name  = event.get("name", "")
                tool_input = event.get("data", {}).get("input", {})
                _emit(db, campaign_id, "tool_call", agent_name, {
                    "tool":    tool_name,
                    "input":   str(tool_input)[:500],
                    "message": _human_tool_message(tool_name, tool_input, is_start=True),
                })

            elif kind == "on_tool_end":
                tool_name   = event.get("name", "")
                tool_output = event.get("data", {}).get("output", "")
                _emit(db, campaign_id, "tool_result", agent_name, {
                    "tool":           tool_name,
                    "result_summary": str(tool_output)[:500],
                    "message":        _human_tool_message(tool_name, {}, is_start=False),
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

        bko = business_service.assemble_products_into_bko(
            db, state["business_id"], state["user_id"], business.get("bko") or {},
        )

        result = {
            "bko":            bko,
            "campaign_name":  campaign.get("campaign_name"),
            "objective":      campaign["objective"],
            "platforms":      campaign["platforms"],
            "asset_types":    campaign.get("asset_types") or ["static_image", "video_ad", "email"],
            "funnel_stage":   campaign["funnel_stage"],
            "num_variants":   campaign["num_variants"],
            "hero_products":  campaign.get("hero_products") or [],
            "tone_override":  campaign.get("tone_override"),
            "special_brief":  campaign.get("special_brief"),
            "retry_count":    campaign.get("retry_count", 0),
            "error":          None,
        }

        save_generation(state["campaign_id"], "campaign_overview.json", {
            "campaign_id":   state["campaign_id"],
            "business_id":   state["business_id"],
            "business_name": business.get("name"),
            "campaign_name": campaign.get("campaign_name"),
            "objective":     campaign["objective"],
            "platforms":     campaign["platforms"],
            "asset_types":   campaign.get("asset_types"),
            "funnel_stage":  campaign["funnel_stage"],
            "num_variants":  campaign["num_variants"],
            "hero_products": campaign.get("hero_products"),
            "tone_override": campaign.get("tone_override"),
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
        final_text = content_to_text(final_msg.content)
        try:
            # Fence-tolerant: the model often wraps JSON in ```json blocks.
            research_report = parse_json_object(final_text)
        except ValueError:
            research_report = {"raw_output": final_text}

        # A response can be syntactically valid JSON but substantively
        # useless — e.g. the model's final synthesis degenerating into a
        # small unrelated fragment instead of the real report. Pydantic
        # validation alone can't catch this (every ResearchReport field has
        # a default, so an empty report would still validate). One cheap,
        # tool-free repair turn before treating this as a real failure.
        if not is_substantive_report(research_report):
            logger.warning(
                "Researcher final answer was not substantive campaign_id=%s — "
                "attempting one repair turn", state["campaign_id"],
            )
            db_repair = _db()
            try:
                _emit(db_repair, state["campaign_id"], "agent_error", "researcher", {
                    "message": "Initial research synthesis was incomplete — retrying synthesis…",
                })
            finally:
                db_repair.close()

            repaired_text = await repair_research_report(
                researcher_agent.llm, result["messages"], final_text,
            )
            try:
                research_report = parse_json_object(repaired_text)
            except ValueError:
                research_report = {"raw_output": repaired_text}

            if not is_substantive_report(research_report):
                raise ValueError(
                    "Researcher failed to produce a substantive research report "
                    "even after a repair attempt."
                )

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
        raise NodeExecutionError("run_researcher", exc) from exc


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
    """Run the strategist pipeline (plan → produce → assemble).

    The pipeline returns a schema-validated StrategyDoc or raises — the old
    json.loads/raw_output fallback is gone by design: an invalid strategy must
    never reach the Producer.

    Revision mode: when the human rejected the strategy at hitl_plan_approval,
    the state carries the previous strategy_doc + the rejected hitl_response,
    and the pipeline regenerates only the assets the feedback touches.
    """
    hitl = state.get("hitl_response") or {}
    is_revision = bool(state.get("strategy_doc")) and hitl.get("approved") is False

    db = _db()
    try:
        _emit(db, state["campaign_id"], "agent_started", "strategist", {
            "message": ("Strategist revising strategy from reviewer feedback"
                        if is_revision else "Strategist agent starting"),
        })

        def emit_event(event_type: str, payload: dict) -> None:
            # Add human-readable message when the strategist pipeline doesn't supply one
            if event_type in ("tool_call", "tool_result") and "message" not in payload:
                tool_name = payload.get("tool", "")
                platform = payload.get("platform", "")
                q = platform or payload.get("asset_id", "")
                payload = {**payload, "message": _human_tool_message(tool_name, q, event_type == "tool_call")}
            _emit(db, state["campaign_id"], event_type, "strategist", payload)

        strategy_doc = await strategist_pipeline.ainvoke(dict(state), on_event=emit_event)

        campaign_repo.update_status(
            db, campaign_id=state["campaign_id"], status="running",
            strategy_doc=strategy_doc,
        )
        _emit(db, state["campaign_id"], "agent_completed", "strategist", {
            "message": "Strategy document ready",
            "asset_count": len(strategy_doc.get("asset_plan", [])),
            "theme": strategy_doc.get("campaign_theme", ""),
        })

        save_generation(state["campaign_id"], "strategy_doc.json", strategy_doc)

        # Clear hitl_response: the revision feedback (or the research approval)
        # is consumed, so hitl_plan_approval emits correctly on its first pass.
        return {"strategy_doc": strategy_doc, "hitl_response": None}
    except Exception as exc:
        logger.exception("Strategist pipeline failed campaign_id=%s", state["campaign_id"])
        db3 = _db()
        try:
            _emit(db3, state["campaign_id"], "agent_error", "strategist", {"error": str(exc)})
        finally:
            db3.close()
        raise NodeExecutionError("run_strategist", exc) from exc
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

    approved = bool(response.get("approved", True)) if isinstance(response, dict) else True
    db2 = _db()
    try:
        campaign_repo.update_status(db2, campaign_id=state["campaign_id"], status="running")
        _emit(db2, state["campaign_id"], "status_changed", "orchestrator", {
            "status": "running",
            "message": ("Strategy approved — producing assets" if approved
                        else "Strategy rejected — strategist revising from feedback"),
        })
    finally:
        db2.close()

    return {"hitl_response": response}


# ── Node 6: run_producer ──────────────────────────────────────────────────────

async def run_producer(state: CampaignState) -> dict:
    db = _db()
    try:
        _emit(db, state["campaign_id"], "agent_started", "producer",
              {"message": "Producer agent starting", "retry": state.get("retry_count", 0)})

        def emit_producer_event(event_type: str, payload: dict) -> None:
            if event_type in ("tool_call", "tool_result") and "message" not in payload:
                tool_name = payload.get("tool", "")
                q = payload.get("platform", "") or payload.get("asset_type", "")
                payload = {**payload, "message": _human_tool_message(tool_name, q, event_type == "tool_call")}
            _emit(db, state["campaign_id"], event_type, "producer", payload)

        result = await producer_agent.ainvoke(dict(state), on_event=emit_producer_event)
        assets: list[dict] = _extract_json(result, "generated_assets") or result.get("generated_assets", [])

        # Persist each asset to the DB
        for asset in assets:
            record = campaign_repo.create_asset(
                db,
                campaign_id=state["campaign_id"],
                platform=asset.get("platform", "unknown"),
                format=asset.get("format", "unknown"),
                asset_type=asset.get("asset_type", "image"),
                storage_url=asset.get("storage_url") or "",
                prompt_used=asset.get("prompt_used"),
                metadata=asset.get("metadata"),
                status=asset.get("status", "stored"),
            )
            asset["asset_id"] = str(record["id"])

        _emit(db, state["campaign_id"], "agent_completed", "producer",
              {"message": f"{len(assets)} asset(s) produced", "asset_count": len(assets)})

        save_generation(state["campaign_id"], "generated_assets.json", {"assets": assets})

        # Clear hitl_response: the plan approval that routed here has now been
        # consumed. Left uncleared, hitl_asset_review's own "is this a fresh
        # visit or a resume replay" guard (`if not state.get("hitl_response")`)
        # would see this stale truthy value and skip flipping the campaign to
        # awaiting_review / emitting hitl_required — the campaign would look
        # stuck at "running" forever even though the graph is correctly
        # paused inside hitl_asset_review's own interrupt() call.
        return {
            "generated_assets": assets, "audit_results": [], "assets_approved": [], "assets_rejected": [],
            "hitl_response": None,
        }
    except Exception as exc:
        logger.exception("Producer agent failed campaign_id=%s", state["campaign_id"])
        _emit(db, state["campaign_id"], "agent_error", "producer", {"error": str(exc)})
        raise NodeExecutionError("run_producer", exc) from exc
    finally:
        db.close()


# ── Node 7: run_auditor ───────────────────────────────────────────────────────

async def run_auditor(state: CampaignState) -> dict:
    db = _db()
    try:
        _emit(db, state["campaign_id"], "agent_started", "auditor",
              {"message": "Auditor agent starting"})

        def emit_auditor_event(event_type: str, payload: dict) -> None:
            if event_type in ("tool_call", "tool_result") and "message" not in payload:
                tool_name = payload.get("tool", "")
                q = payload.get("platform", "") or payload.get("asset_id", "")
                payload = {**payload, "message": _human_tool_message(tool_name, q, event_type == "tool_call")}
            _emit(db, state["campaign_id"], event_type, "auditor", payload)

        result = await auditor_agent.ainvoke(dict(state), on_event=emit_auditor_event)

        audit_results: list[dict] = result.get("audit_results", [])
        assets_approved: list[str] = result.get("assets_approved", [])
        assets_rejected: list[str] = result.get("assets_rejected", [])

        # Compute campaign-level audit score — weighted_avg is 0-10, audit_score is 0-100
        scores = [r["weighted_avg"] for r in audit_results if "weighted_avg" in r]
        audit_score = round(sum(scores) / len(scores) * 10, 1) if scores else None

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
        raise NodeExecutionError("run_auditor", exc) from exc
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
            db, campaign_id=state["campaign_id"], status="done",
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
