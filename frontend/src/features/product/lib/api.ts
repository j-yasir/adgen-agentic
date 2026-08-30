import { apiClient, apiClientUpload } from "@/shared/lib/api-client";
import type {
  CreateProductFromUrlRequest,
  CreateProductRequest,
  ProductImageResponse,
  ProductListResponse,
  ProductResponse,
  UpdateProductRequest,
} from "../types";
import type { BusinessResponse } from "@/features/business/types";

const base = (businessId: string) => `/businesses/${businessId}/products`;

export const productApi = {
  // ── Products CRUD ───────────────────────────────────────────────────────────

  list: (businessId: string) =>
    apiClient<ProductListResponse>(base(businessId)),

  getOne: (businessId: string, productId: string) =>
    apiClient<ProductResponse>(`${base(businessId)}/${productId}`),

  create: (businessId: string, data: CreateProductRequest) =>
    apiClient<ProductResponse>(base(businessId), {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createFromUrl: (businessId: string, data: CreateProductFromUrlRequest) =>
    apiClient<ProductResponse>(`${base(businessId)}/from-url`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (businessId: string, productId: string, data: UpdateProductRequest) =>
    apiClient<ProductResponse>(`${base(businessId)}/${productId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (businessId: string, productId: string) =>
    apiClient<void>(`${base(businessId)}/${productId}`, { method: "DELETE" }),

  // ── Product images ──────────────────────────────────────────────────────────

  listImages: (businessId: string, productId: string) =>
    apiClient<ProductImageResponse[]>(`${base(businessId)}/${productId}/images`),

  uploadImage: (businessId: string, productId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiClientUpload<ProductImageResponse>(
      `${base(businessId)}/${productId}/images`,
      fd
    );
  },

  deleteImage: (businessId: string, productId: string, imageId: string) =>
    apiClient<void>(`${base(businessId)}/${productId}/images/${imageId}`, {
      method: "DELETE",
    }),

  setPrimaryImage: (businessId: string, productId: string, imageId: string) =>
    apiClient<ProductImageResponse>(
      `${base(businessId)}/${productId}/images/${imageId}/primary`,
      { method: "POST" }
    ),

  // ── Business logo ───────────────────────────────────────────────────────────

  uploadLogo: (businessId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiClientUpload<BusinessResponse>(`/businesses/${businessId}/logo`, fd);
  },

  deleteLogo: (businessId: string) =>
    apiClient<BusinessResponse>(`/businesses/${businessId}/logo`, {
      method: "DELETE",
    }),
};
