import { apiClient } from "@/shared/lib/api-client";
import type {
  CampaignResponse,
  CampaignListResponse,
  CreateCampaignRequest,
  ResumeRequest,
  CampaignEvent,
  AssetResponse,
} from "../types";

export const campaignApi = {
  create: (data: CreateCampaignRequest) =>
    apiClient<CampaignResponse>("/campaigns", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getOne: (id: string) => apiClient<CampaignResponse>(`/campaigns/${id}`),

  list: (businessId: string) =>
    apiClient<CampaignListResponse>(`/campaigns?business_id=${businessId}`),

  resume: (id: string, data: ResumeRequest) =>
    apiClient<CampaignResponse>(`/campaigns/${id}/resume`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getEvents: (id: string, afterSeq = 0) =>
    apiClient<CampaignEvent[]>(`/campaigns/${id}/events?after_seq=${afterSeq}`),

  getAssets: (id: string) =>
    apiClient<AssetResponse[]>(`/campaigns/${id}/assets`),

  delete: (id: string) =>
    apiClient<void>(`/campaigns/${id}`, { method: "DELETE" }),
};
