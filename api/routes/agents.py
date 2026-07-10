from __future__ import annotations

import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.dependencies import get_current_user
from db.session import get_db
from repos import business_repo, campaign_repo
from utils.exceptions import ExternalServiceError, NotFoundError
from utils.logger import get_logger
from utils.storage import save_generation

logger = get_logger(__name__)

router = APIRouter(prefix="/agents", tags=["agents"])


# ── Request schemas ──────────────────────────────────────────────────────────

class AgentDBInput(BaseModel):
    """Run an agent using existing DB records."""
    business_id: uuid.UUID
    campaign_id: uuid.UUID


class ResearcherInlineInput(BaseModel):
    """Run the researcher with an inline payload — no DB needed."""
    bko: dict
    campaign_name: Optional[str] = None
    objective: Literal["awareness", "traffic", "conversion", "lead_gen", "engagement"]
    platforms: list[Literal["instagram", "facebook", "tiktok", "youtube", "google", "linkedin"]] = Field(min_length=1)
    asset_types: list[Literal["static_image", "video_ad", "email"]] = Field(default=["static_image", "video_ad", "email"])
    funnel_stage: Literal["tofu", "mofu", "bofu", "balanced"]
    num_variants: int = Field(default=3, ge=1, le=10)
    hero_products: list[str] = Field(default_factory=list)
    tone_override: Optional[str] = None
    special_brief: Optional[str] = None


class ResearcherRequest(BaseModel):
    """Either provide DB references OR an inline payload."""
    from_db: Optional[AgentDBInput] = None
    inline: Optional[ResearcherInlineInput] = None


# ── Researcher endpoint ──────────────────────────────────────────────────────

@router.post(
    "/researcher",
    summary="Run the Researcher agent independently",
    description=(
        "Two input modes:\n\n"
        "**Mode A — From DB:** Pass `from_db.business_id` + `from_db.campaign_id` "
        "to fetch the BKO and campaign brief from the database.\n\n"
        "**Mode B — Inline:** Pass `inline` with a raw BKO dict and campaign fields. "
        "No database records needed."
    ),
)
async def run_researcher(
    data: ResearcherRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from agents.researcher.agent import researcher_agent
    from agents.researcher.prompts import build_input

    # ── Build state from DB or inline payload ────────────────────────
    if data.from_db:
        business = business_repo.get_by_id(db, data.from_db.business_id, current_user["id"])
        if not business:
            raise NotFoundError(f"Business {data.from_db.business_id} not found")

        campaign = campaign_repo.get_by_id(db, data.from_db.campaign_id, current_user["id"])
        if not campaign:
            raise NotFoundError(f"Campaign {data.from_db.campaign_id} not found")

        state = {
            "campaign_id": str(campaign["id"]),
            "business_id": str(business["id"]),
            "user_id": str(current_user["id"]),
            "bko": business.get("bko") or {},
            "campaign_name": campaign.get("campaign_name"),
            "objective": campaign["objective"],
            "platforms": campaign["platforms"],
            "asset_types": campaign.get("asset_types") or ["static_image", "video_ad", "email"],
            "funnel_stage": campaign["funnel_stage"],
            "num_variants": campaign["num_variants"],
            "hero_products": campaign.get("hero_products") or [],
            "tone_override": campaign.get("tone_override"),
            "special_brief": campaign.get("special_brief"),
        }

    elif data.inline:
        state = {
            "campaign_id": "inline-test",
            "business_id": "inline-test",
            "user_id": str(current_user["id"]),
            "bko": data.inline.bko,
            "campaign_name": data.inline.campaign_name,
            "objective": data.inline.objective,
            "platforms": list(data.inline.platforms),
            "asset_types": list(data.inline.asset_types),
            "funnel_stage": data.inline.funnel_stage,
            "num_variants": data.inline.num_variants,
            "hero_products": list(data.inline.hero_products),
            "tone_override": data.inline.tone_override,
            "special_brief": data.inline.special_brief,
        }

    else:
        raise NotFoundError("Provide either 'from_db' or 'inline' input.")

    # ── Run the agent ────────────────────────────────────────────────
    logger.info("Running researcher agent standalone for user=%s", current_user["id"])

    result = await researcher_agent.ainvoke({
        "messages": [HumanMessage(content=build_input(state))]
    })

    final_msg = result["messages"][-1]
    content = final_msg.content

    # Fence-tolerant parse — the model often wraps JSON in ```json blocks
    from agents.strategist.validation import parse_json_object
    try:
        research_report = parse_json_object(content) if isinstance(content, str) else content
    except ValueError:
        research_report = {"raw_output": content}

    # Persist to generations/{campaign_id}/
    campaign_id = state["campaign_id"]
    save_generation(campaign_id, "research_report.json", research_report)

    # Collect tool usage for transparency
    tool_calls_made = []
    for msg in result["messages"]:
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            for tc in msg.tool_calls:
                tool_calls_made.append(tc["name"])

    return {
        "agent": "researcher",
        "input_mode": "from_db" if data.from_db else "inline",
        "research_report": research_report,
        "metadata": {
            "total_messages": len(result["messages"]),
            "tools_called": tool_calls_made,
        },
    }


# ── Strategist endpoint ─────────────────────────────────────────────────────

class StrategistInlineInput(BaseModel):
    """Run the strategist with an inline payload — no DB needed."""
    bko: dict
    research_report: dict
    campaign_name: Optional[str] = None
    objective: Literal["awareness", "traffic", "conversion", "lead_gen", "engagement"]
    platforms: list[Literal["instagram", "facebook", "tiktok", "youtube", "google", "linkedin"]] = Field(min_length=1)
    asset_types: list[Literal["static_image", "video_ad", "email"]] = Field(default=["static_image", "video_ad", "email"])
    funnel_stage: Literal["tofu", "mofu", "bofu", "balanced"]
    num_variants: int = Field(default=3, ge=1, le=10)
    hero_products: list[str] = Field(default_factory=list)
    tone_override: Optional[str] = None
    special_brief: Optional[str] = None


class StrategistRequest(BaseModel):
    """Either provide DB references OR an inline payload."""
    from_db: Optional[AgentDBInput] = None
    inline: Optional[StrategistInlineInput] = None


@router.post(
    "/strategist",
    summary="Run the Strategist agent independently",
    description=(
        "Two input modes:\n\n"
        "**Mode A — From DB:** Pass `from_db.business_id` + `from_db.campaign_id`. "
        "Fetches BKO, campaign brief, and research_report from the last pipeline run.\n\n"
        "**Mode B — Inline:** Pass `inline` with BKO, research_report, and campaign fields."
    ),
)
async def run_strategist_endpoint(
    data: StrategistRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from agents.strategist.graph import strategist_pipeline
    from agents.strategist.validation import StrategistError

    if data.from_db:
        business = business_repo.get_by_id(db, data.from_db.business_id, current_user["id"])
        if not business:
            raise NotFoundError(f"Business {data.from_db.business_id} not found")

        campaign = campaign_repo.get_by_id(db, data.from_db.campaign_id, current_user["id"])
        if not campaign:
            raise NotFoundError(f"Campaign {data.from_db.campaign_id} not found")

        # Try to load research_report from generations folder
        import json as json_mod
        from pathlib import Path
        report_path = Path(f"generations/{data.from_db.campaign_id}/research_report.json")
        if report_path.exists():
            research_report = json_mod.loads(report_path.read_text())
        else:
            research_report = {}

        state = {
            "campaign_id": str(campaign["id"]),
            "business_id": str(business["id"]),
            "user_id": str(current_user["id"]),
            "bko": business.get("bko") or {},
            "campaign_name": campaign.get("campaign_name"),
            "objective": campaign["objective"],
            "platforms": campaign["platforms"],
            "asset_types": campaign.get("asset_types") or ["static_image", "video_ad", "email"],
            "funnel_stage": campaign["funnel_stage"],
            "num_variants": campaign["num_variants"],
            "hero_products": campaign.get("hero_products") or [],
            "tone_override": campaign.get("tone_override"),
            "special_brief": campaign.get("special_brief"),
            "research_report": research_report,
        }

    elif data.inline:
        state = {
            "campaign_id": "inline-test",
            "business_id": "inline-test",
            "user_id": str(current_user["id"]),
            "bko": data.inline.bko,
            "campaign_name": data.inline.campaign_name,
            "objective": data.inline.objective,
            "platforms": list(data.inline.platforms),
            "asset_types": list(data.inline.asset_types),
            "funnel_stage": data.inline.funnel_stage,
            "num_variants": data.inline.num_variants,
            "hero_products": list(data.inline.hero_products),
            "tone_override": data.inline.tone_override,
            "special_brief": data.inline.special_brief,
            "research_report": data.inline.research_report,
        }

    else:
        raise NotFoundError("Provide either 'from_db' or 'inline' input.")

    logger.info("Running strategist pipeline standalone for user=%s", current_user["id"])

    # Collect pipeline stage events so the caller can see what happened.
    events: list[dict] = []

    def collect_event(event_type: str, payload: dict) -> None:
        events.append({"event": event_type, **payload})

    try:
        strategy_doc = await strategist_pipeline.ainvoke(state, on_event=collect_event)
    except StrategistError as exc:
        raise ExternalServiceError(
            f"Strategist pipeline failed: {exc}",
            detail={"violations": exc.violations},
        ) from exc

    campaign_id = state["campaign_id"]
    save_generation(campaign_id, "strategy_doc.json", strategy_doc)

    asset_plan = strategy_doc.get("asset_plan", [])
    distribution: dict[str, int] = {}
    for asset in asset_plan:
        distribution[asset["asset_type"]] = distribution.get(asset["asset_type"], 0) + 1

    return {
        "agent": "strategist",
        "input_mode": "from_db" if data.from_db else "inline",
        "strategy_doc": strategy_doc,
        "metadata": {
            "asset_count": len(asset_plan),
            "distribution": distribution,
            "events": events,
        },
    }
