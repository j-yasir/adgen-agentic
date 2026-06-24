from __future__ import annotations
from orchestrator.state import CampaignState


def build_input(state: CampaignState) -> str:
    return (
        f"Produce ad assets based on the following strategy.\n\n"
        f"Strategy:\n{state['strategy_doc']}\n\n"
        f"BKO:\n{state['bko']}\n\n"
        f"Platforms: {', '.join(state['platforms'])}\n"
        f"Num variants: {state['num_variants']}\n"
        f"Special brief: {state.get('special_brief') or 'none'}\n"
        f"Previous audit feedback (if retry): {state.get('audit_results') or 'none'}\n\n"
        f"Return a list of GeneratedAsset JSON objects."
    )
