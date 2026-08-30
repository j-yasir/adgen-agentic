import { useMutation, useQueryClient } from "@tanstack/react-query";
import { productApi } from "../lib/api";

export function useUploadLogo(businessId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => productApi.uploadLogo(businessId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business", businessId] });
      qc.invalidateQueries({ queryKey: ["businesses"] });
    },
  });
}

export function useDeleteLogo(businessId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => productApi.deleteLogo(businessId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business", businessId] });
      qc.invalidateQueries({ queryKey: ["businesses"] });
    },
  });
}
