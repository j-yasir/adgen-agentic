"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { businessApi } from "../lib/api";
import type { CreateBusinessRequest } from "../types";

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

export function useDeleteBusiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => businessApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
    },
  });
}
