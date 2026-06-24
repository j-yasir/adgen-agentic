export type CampaignResponse = {
  id: string;
  business_id: string;
  user_id: string;
  campaign_name: string | null;
  goal: string;
  objective: string;
  platforms: string[];
  funnel_stage: string;
  num_variants: number;
  special_brief: string | null;
  status: string;
  strategy_doc: Record<string, unknown> | null;
  retry_count: number;
  audit_score: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type CampaignListResponse = {
  campaigns: CampaignResponse[];
  total: number;
};

export type CreateCampaignRequest = {
  business_id: string;
  campaign_name?: string;
  objective: "awareness" | "traffic" | "conversion" | "lead_gen" | "engagement";
  platforms: string[];
  funnel_stage: "tofu" | "mofu" | "bofu" | "balanced";
  num_variants: number;
  special_brief?: string;
};

export type ResumeRequest = {
  approved: boolean;
  feedback?: string;
};

export type CampaignEvent = {
  id: string;
  campaign_id: string;
  seq: number;
  event_type: "agent_started" | "agent_completed" | "agent_error" | "tool_call" | "tool_result" | "hitl_required" | "status_changed" | "campaign_done" | "campaign_failed";
  agent: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type AssetResponse = {
  id: string;
  campaign_id: string;
  platform: string;
  format: string;
  asset_type: string;
  storage_url: string;
  prompt_used: string | null;
  status: string;
  created_at: string;
};

export type PipelineStage = "pending" | "researcher" | "strategist" | "producer" | "auditor" | "awaiting_review" | "completed" | "failed";
