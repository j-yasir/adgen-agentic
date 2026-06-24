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
from utils.exceptions import NotFoundError
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
    objective: Literal["awareness", "traffic", "conversion", "lead_gen", "engagement"]
    platforms: list[Literal["instagram", "facebook", "tiktok", "youtube", "google", "linkedin"]] = Field(min_length=1)
    funnel_stage: Literal["tofu", "mofu", "bofu", "balanced"]
    num_variants: int = Field(default=3, ge=1, le=10)
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
            "objective": campaign["objective"],
            "platforms": campaign["platforms"],
            "funnel_stage": campaign["funnel_stage"],
            "num_variants": campaign["num_variants"],
            "special_brief": campaign.get("special_brief"),
        }

    elif data.inline:
        state = {
            "campaign_id": "inline-test",
            "business_id": "inline-test",
            "user_id": str(current_user["id"]),
            "bko": data.inline.bko,
            "objective": data.inline.objective,
            "platforms": list(data.inline.platforms),
            "funnel_stage": data.inline.funnel_stage,
            "num_variants": data.inline.num_variants,
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

    # Parse JSON from the final message
    import json
    try:
        research_report = json.loads(content) if isinstance(content, str) else content
    except json.JSONDecodeError:
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
