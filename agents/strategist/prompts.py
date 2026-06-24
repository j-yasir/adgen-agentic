from __future__ import annotations
from orchestrator.state import CampaignState


def build_input(state: CampaignState) -> str:
    return (
        f"Build a campaign strategy based on the following research.\n\n"
        f"Research report:\n{state['research_report']}\n\n"
        f"BKO:\n{state['bko']}\n\n"
        f"Objective: {state['objective']}\n"
        f"Platforms: {', '.join(state['platforms'])}\n"
        f"Funnel stage: {state['funnel_stage']}\n"
        f"Num variants: {state['num_variants']}\n"
        f"Special brief: {state.get('special_brief') or 'none'}\n\n"
        f"Return a StrategyDoc JSON."
    )
