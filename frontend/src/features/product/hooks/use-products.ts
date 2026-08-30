import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productApi } from "../lib/api";
import type { CreateProductFromUrlRequest, CreateProductRequest, UpdateProductRequest } from "../types";

export const productKeys = {
  all: (businessId: string) => ["products", businessId] as const,
  detail: (businessId: string, productId: string) =>
    ["products", businessId, productId] as const,
};

export function useProducts(businessId: string) {
  return useQuery({
    queryKey: productKeys.all(businessId),
    queryFn: () => productApi.list(businessId),
    enabled: !!businessId,
  });
}

export function useCreateProduct(businessId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProductRequest) =>
      productApi.create(businessId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all(businessId) });
      // Invalidate business detail so BKO completeness recalculates
      qc.invalidateQueries({ queryKey: ["business", businessId] });
    },
  });
}

export function useCreateProductFromUrl(businessId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProductFromUrlRequest) =>
      productApi.createFromUrl(businessId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all(businessId) });
      // Invalidate business detail so BKO completeness recalculates
      qc.invalidateQueries({ queryKey: ["business", businessId] });
    },
  });
}

export function useUpdateProduct(businessId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId,
      data,
    }: {
      productId: string;
      data: UpdateProductRequest;
    }) => productApi.update(businessId, productId, data),
    onSuccess: (_, { productId }) => {
      qc.invalidateQueries({ queryKey: productKeys.all(businessId) });
      qc.invalidateQueries({
        queryKey: productKeys.detail(businessId, productId),
      });
      qc.invalidateQueries({ queryKey: ["business", businessId] });
    },
  });
}

export function useDeleteProduct(businessId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) =>
      productApi.delete(businessId, productId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all(businessId) });
      qc.invalidateQueries({ queryKey: ["business", businessId] });
    },
  });
}
