"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { campaignApi } from "../lib/api";
import type { CreateCampaignRequest, ResumeRequest } from "../types";

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ["campaign", id],
    queryFn: () => campaignApi.getOne(id),
    enabled: !!id,
  });
}

export function useCampaignAssets(id: string) {
  return useQuery({
    queryKey: ["campaign-assets", id],
    queryFn: () => campaignApi.getAssets(id),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCampaignRequest) => campaignApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useResumeCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ResumeRequest }) =>
      campaignApi.resume(id, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["campaign", vars.id] });
    },
  });
}
