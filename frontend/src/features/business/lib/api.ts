import { apiClient } from "@/shared/lib/api-client";
import type { BusinessResponse, BusinessListResponse, CreateBusinessRequest, CreateBusinessFromUrlRequest } from "../types";

export const businessApi = {
  list: () => apiClient<BusinessListResponse>("/businesses"),

  getOne: (id: string) => apiClient<BusinessResponse>(`/businesses/${id}`),

  create: (data: CreateBusinessRequest) =>
    apiClient<BusinessResponse>("/businesses", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createFromUrl: (data: CreateBusinessFromUrlRequest) =>
    apiClient<BusinessResponse>("/businesses/from-url", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<CreateBusinessRequest>) =>
    apiClient<BusinessResponse>(`/businesses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  patchBkoField: (id: string, path: string, value: unknown) =>
    apiClient<BusinessResponse>(`/businesses/${id}/bko`, {
      method: "PATCH",
      body: JSON.stringify({ path, value }),
    }),

  delete: (id: string) =>
    apiClient<void>(`/businesses/${id}`, { method: "DELETE" }),
};
