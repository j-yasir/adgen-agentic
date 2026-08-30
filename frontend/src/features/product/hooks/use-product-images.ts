import { useMutation, useQueryClient } from "@tanstack/react-query";
import { productApi } from "../lib/api";
import { productKeys } from "./use-products";

export function useUploadProductImage(businessId: string, productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      productApi.uploadImage(businessId, productId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all(businessId) });
    },
  });
}

export function useDeleteProductImage(businessId: string, productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) =>
      productApi.deleteImage(businessId, productId, imageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all(businessId) });
    },
  });
}

export function useSetPrimaryImage(businessId: string, productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) =>
      productApi.setPrimaryImage(businessId, productId, imageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all(businessId) });
    },
  });
}
