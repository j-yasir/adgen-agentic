from __future__ import annotations
from orchestrator.state import CampaignState


def build_input(state: CampaignState) -> str:
    """Build the HumanMessage content sent to the Researcher agent."""
    return (
        f"Research a campaign for the following business.\n\n"
        f"BKO:\n{state['bko']}\n\n"
        f"Objective: {state['objective']}\n"
        f"Platforms: {', '.join(state['platforms'])}\n"
        f"Funnel stage: {state['funnel_stage']}\n"
        f"Special brief: {state.get('special_brief') or 'none'}\n\n"
        f"Return a ResearchReport JSON."
    )
