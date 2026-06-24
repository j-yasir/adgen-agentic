from __future__ import annotations
from orchestrator.state import CampaignState


def build_input(state: CampaignState) -> str:
    return (
        f"Audit the following ad assets for quality and brand alignment.\n\n"
        f"Strategy:\n{state['strategy_doc']}\n\n"
        f"Assets:\n{state['generated_assets']}\n\n"
        f"Score each asset on: relevance, clarity, brand_alignment, cta_strength, creative_quality.\n"
        f"Return a list of AuditResult JSON objects with per-asset scores and feedback."
    )
