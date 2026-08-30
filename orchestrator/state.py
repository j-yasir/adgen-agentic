from __future__ import annotations

from typing import TypedDict


class CampaignState(TypedDict):
    # ── Fixed at launch ────────────────────────────────────────────────────────
    campaign_id:    str
    business_id:    str
    user_id:        str
    bko:            dict          # full BKO loaded from businesses table
    campaign_name:  str | None    # user-provided label or auto-generated
    objective:      str           # awareness | traffic | conversion | lead_gen | engagement
    platforms:      list[str]     # instagram | facebook | tiktok | youtube | google | linkedin
    asset_types:    list[str]     # static_image | video_ad | email
    funnel_stage:   str           # tofu | mofu | bofu | balanced
    num_variants:   int
    hero_products:  list[str]     # specific SKUs to highlight
    tone_override:  str | None    # override BKO tone for this campaign
    special_brief:  str | None

    # Optional per-asset product-selection override (asset_id -> product_id).
    # Populated once a per-asset product-selection UI exists; empty/absent today.
    product_overrides: dict[str, str] | None

    # Optional per-asset secondary links for the email sub-agent
    # (asset_id -> {label: url}), e.g. a campaign-specific landing page beyond
    # the primary CTA. Pipeline-side hook only — no HITL/API surface captures
    # this yet, same scoping as product_overrides. See EMAIL_TEMPLATE_AGENT.md §6.2.
    secondary_links: dict[str, dict[str, str]] | None

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
