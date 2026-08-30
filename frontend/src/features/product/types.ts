export type ProductType =
  | "saas_product"
  | "physical"
  | "service"
  | "subscription"
  | "digital"
  | "marketplace";

export type PricingModel =
  | "one_time"
  | "subscription"
  | "freemium"
  | "pay_per_use"
  | "enterprise"
  | "free";

export type PricingTier = "free" | "low" | "mid" | "premium" | "enterprise";

export type ProductImageResponse = {
  id: string;
  product_id: string;
  storage_url: string;
  is_primary: boolean;
  created_at: string;
};

export type ProductResponse = {
  id: string;
  business_id: string;
  name: string;
  type: ProductType;
  is_hero: boolean;
  description: string;
  key_features: string[];
  benefits: string[];
  pricing_model: PricingModel;
  pricing_tier: PricingTier;
  pricing_details: string | null;
  unique_selling_points: string[];
  target_use_case: string | null;
  created_at: string;
  updated_at: string;
  images: ProductImageResponse[];
};

export type ProductListResponse = {
  products: ProductResponse[];
  total: number;
};

export type CreateProductRequest = {
  name: string;
  type: ProductType;
  is_hero: boolean;
  description: string;
  key_features: string[];
  benefits: string[];
  pricing_model: PricingModel;
  pricing_tier: PricingTier;
  pricing_details?: string;
  unique_selling_points: string[];
  target_use_case?: string;
};

export type UpdateProductRequest = Partial<CreateProductRequest>;

export type CreateProductFromUrlRequest = {
  url: string;
};
