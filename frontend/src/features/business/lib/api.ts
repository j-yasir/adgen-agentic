import { apiClient } from "@/shared/lib/api-client";
import type { BusinessResponse, BusinessListResponse, CreateBusinessRequest } from "../types";

export const businessApi = {
  list: () => apiClient<BusinessListResponse>("/businesses"),

  getOne: (id: string) => apiClient<BusinessResponse>(`/businesses/${id}`),

  create: (data: CreateBusinessRequest) =>
    apiClient<BusinessResponse>("/businesses", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<CreateBusinessRequest>) =>
    apiClient<BusinessResponse>(`/businesses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiClient<void>(`/businesses/${id}`, { method: "DELETE" }),
};
