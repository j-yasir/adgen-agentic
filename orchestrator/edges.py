from __future__ import annotations

from orchestrator.state import CampaignState


def route_after_audit(state: CampaignState) -> str:
    """
    After the Auditor runs, decide whether to retry with the Producer or
    move to the human asset-review checkpoint.

    Retry conditions (both must hold):
    - At least one asset was rejected (score < 7.5)
    - retry_count <= 2  (Auditor increments retry_count, so this allows 2 full retries)

    After 2 retries the pipeline moves to human review regardless of scores.
    """
    has_rejections = bool(state.get("assets_rejected"))
    can_retry = state.get("retry_count", 0) <= 2
    if has_rejections and can_retry:
        return "run_producer"
    return "hitl_assets"


def route_after_review(state: CampaignState) -> str:
    """
    After the human asset-review HITL node the user either approved or provided
    feedback. Either way we always proceed to campaign_done — the approval flag
    and any feedback are recorded in hitl_response for the front-end to use.
    """
    return "campaign_done"
