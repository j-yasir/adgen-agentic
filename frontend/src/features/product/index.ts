// Types
export type {
  ProductType,
  PricingModel,
  PricingTier,
  ProductImageResponse,
  ProductResponse,
  ProductListResponse,
  CreateProductRequest,
  UpdateProductRequest,
} from "./types";

// API
export { productApi } from "./lib/api";

// Hooks
export { productKeys, useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "./hooks/use-products";
export { useUploadProductImage, useDeleteProductImage, useSetPrimaryImage } from "./hooks/use-product-images";
export { useUploadLogo, useDeleteLogo } from "./hooks/use-logo";

// Components
export { LogoUpload } from "./components/logo-upload";
export { ProductImageManager } from "./components/product-image-manager";
export { ProductFormDrawer } from "./components/product-form-drawer";
export { ProductCard } from "./components/product-card";
export { ProductList } from "./components/product-list";
export { AssetGroundingPanel } from "./components/asset-grounding-panel";
