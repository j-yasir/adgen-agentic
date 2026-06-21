from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ── Request schemas ───────────────────────────────────────────────────────────

class CreateCampaignRequest(BaseModel):
    business_id:    uuid.UUID
    campaign_name:  Optional[str] = Field(default=None, description="Optional label. Auto-generated if blank.")
    objective:      Literal["awareness", "traffic", "conversion", "lead_gen", "engagement"]
    platforms:      list[Literal["instagram", "facebook", "tiktok", "youtube", "google", "linkedin"]] = Field(..., min_length=1)
    funnel_stage:   Literal["tofu", "mofu", "bofu", "balanced"]
    num_variants:   int = Field(default=3, ge=1, le=10)
    special_brief:  Optional[str] = Field(default=None, max_length=300)


class ResumeRequest(BaseModel):
    approved:   bool
    feedback:   Optional[str] = Field(default=None, max_length=1000)


# ── Response schemas ──────────────────────────────────────────────────────────

class AssetResponse(BaseModel):
    id:           uuid.UUID
    campaign_id:  uuid.UUID
    platform:     str
    format:       str
    asset_type:   str
    storage_url:  str
    prompt_used:  Optional[str]
    status:       str
    created_at:   datetime


class CampaignEventResponse(BaseModel):
    id:           uuid.UUID
    campaign_id:  uuid.UUID
    seq:          int
    event_type:   str
    agent:        Optional[str]
    payload:      dict
    created_at:   datetime


class CampaignResponse(BaseModel):
    id:             uuid.UUID
    business_id:    uuid.UUID
    user_id:        uuid.UUID
    campaign_name:  Optional[str]
    goal:           str
    objective:      str
    platforms:      list[str]
    funnel_stage:   str
    num_variants:   int
    special_brief:  Optional[str]
    status:         str
    strategy_doc:   Optional[dict]
    retry_count:    int
    audit_score:    Optional[float]
    error:          Optional[str]
    created_at:     datetime
    updated_at:     datetime
    completed_at:   Optional[datetime]


class CampaignListResponse(BaseModel):
    campaigns:  list[CampaignResponse]
    total:      int
