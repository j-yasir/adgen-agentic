"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { businessApi } from "../lib/api";
import type { CreateBusinessRequest, CreateBusinessFromUrlRequest } from "../types";

export function useBusinesses() {
  return useQuery({
    queryKey: ["businesses"],
    queryFn: businessApi.list,
  });
}

export function useBusinessDetail(id: string) {
  return useQuery({
    queryKey: ["businesses", id],
    queryFn: () => businessApi.getOne(id),
    enabled: !!id,
  });
}

export function useCreateBusiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBusinessRequest) => businessApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
    },
  });
}

export function useCreateBusinessFromUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBusinessFromUrlRequest) => businessApi.createFromUrl(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
    },
  });
}

export function usePatchBkoField(businessId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, value }: { path: string; value: unknown }) =>
      businessApi.patchBkoField(businessId, path, value),
    onSuccess: (data) => {
      queryClient.setQueryData(["businesses", businessId], data);
    },
  });
}

export function useDeleteBusiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => businessApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
    },
  });
}
