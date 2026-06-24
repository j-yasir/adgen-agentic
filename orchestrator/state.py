from __future__ import annotations

from typing import TypedDict


class CampaignState(TypedDict):
    # ── Fixed at launch ────────────────────────────────────────────────────────
    campaign_id:   str
    business_id:   str
    user_id:       str
    bko:           dict          # full BKO loaded from businesses table
    objective:     str           # awareness | traffic | conversion | lead_gen | engagement
    platforms:     list[str]     # instagram | facebook | tiktok | youtube | google | linkedin
    funnel_stage:  str           # tofu | mofu | bofu | balanced
    num_variants:  int
    special_brief: str | None

    # ── Written by Researcher ──────────────────────────────────────────────────
    research_report: dict | None

    # ── Written by Strategist ──────────────────────────────────────────────────
    # strategy_doc is also persisted to campaigns.strategy_doc in the DB
    strategy_doc: dict | None

    # ── Written by Producer ────────────────────────────────────────────────────
    generated_assets: list[dict]  # one entry per produced asset

    # ── Written by Auditor ─────────────────────────────────────────────────────
    audit_results:   list[dict]   # per-asset score breakdown
    assets_approved: list[str]    # asset_ids that passed (>= 7.5 weighted avg)
    assets_rejected: list[str]    # asset_ids that need retry

    # ── Retry tracking ─────────────────────────────────────────────────────────
    # Incremented by run_auditor after each scoring pass. Max 2 retries.
    retry_count: int

    # ── Human-in-the-Loop ─────────────────────────────────────────────────────
    # Set when user resumes via POST /campaigns/{id}/resume
    hitl_response: dict | None

    # ── Error tracking ─────────────────────────────────────────────────────────
    error: str | None
