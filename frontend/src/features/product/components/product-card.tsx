"use client";

import { useState } from "react";
import { Star, Pencil, Trash2, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { cn, toAssetUrl } from "@/shared/lib/utils";
import { useDeleteProduct } from "../hooks/use-products";
import type { ProductResponse, ProductType, PricingTier } from "../types";

const TYPE_LABELS: Record<ProductType, string> = {
  saas_product: "SaaS",
  physical: "Physical",
  service: "Service",
  subscription: "Subscription",
  digital: "Digital",
  marketplace: "Marketplace",
};

const TIER_COLORS: Record<PricingTier, { color: string; bg: string }> = {
  free: { color: "#16a34a", bg: "rgba(34,197,94,0.1)" },
  low: { color: "#0284c7", bg: "rgba(2,132,199,0.1)" },
  mid: { color: "#7c3aed", bg: "rgba(124,58,237,0.1)" },
  premium: { color: "#d97706", bg: "rgba(245,158,11,0.1)" },
  enterprise: { color: "#dc2626", bg: "rgba(239,68,68,0.1)" },
};

const TIER_LABELS: Record<PricingTier, string> = {
  free: "Free",
  low: "Low",
  mid: "Mid",
  premium: "Premium",
  enterprise: "Enterprise",
};

interface ProductCardProps {
  product: ProductResponse;
  businessId: string;
  onEdit: (product: ProductResponse) => void;
}

export function ProductCard({ product, businessId, onEdit }: ProductCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteMut = useDeleteProduct(businessId);

  const primaryImage = product.images.find((i) => i.is_primary) ?? product.images[0];
  const primaryImageUrl = toAssetUrl(primaryImage?.storage_url);
  const tier = TIER_COLORS[product.pricing_tier] ?? TIER_COLORS.mid;

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    try {
      await deleteMut.mutateAsync(product.id);
      toast.success("Product deleted");
    } catch {
      toast.error("Failed to delete product");
      setConfirmDelete(false);
    }
  }

  return (
    <div
      className={cn(
        "group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-md transition-all",
        product.is_hero && "ring-1 ring-amber-300 border-amber-200"
      )}
    >
      {/* Image strip / thumbnail */}
      <div className="relative h-36 bg-slate-50 overflow-hidden">
        {primaryImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primaryImageUrl}
            alt={product.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-slate-200" />
          </div>
        )}

        {/* Image count badge */}
        {product.images.length > 1 && (
          <div className="absolute bottom-2 right-2 text-[10px] font-semibold text-white bg-black/50 rounded-md px-1.5 py-0.5 backdrop-blur-sm">
            +{product.images.length - 1}
          </div>
        )}

        {/* Hero badge */}
        {product.is_hero && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            <Star className="h-2.5 w-2.5 fill-white" />
            Hero
          </div>
        )}

        {/* Action buttons — shown on hover */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onEdit(product)}
            className="h-7 w-7 rounded-lg bg-white/90 hover:bg-white shadow-sm flex items-center justify-center transition-colors"
            title="Edit product"
          >
            <Pencil className="h-3.5 w-3.5 text-slate-600" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className={cn(
              "h-7 w-7 rounded-lg shadow-sm flex items-center justify-center transition-colors",
              confirmDelete
                ? "bg-red-500 hover:bg-red-600"
                : "bg-white/90 hover:bg-white"
            )}
            title={confirmDelete ? "Click again to confirm" : "Delete product"}
          >
            {deleteMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 text-slate-600 animate-spin" />
            ) : (
              <Trash2
                className={cn(
                  "h-3.5 w-3.5 transition-colors",
                  confirmDelete ? "text-white" : "text-slate-600"
                )}
              />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3.5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800 leading-tight line-clamp-1">
            {product.name}
          </h3>
          <span
            className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
            style={{ color: tier.color, background: tier.bg }}
          >
            {TIER_LABELS[product.pricing_tier]}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            {TYPE_LABELS[product.type]}
          </span>
          {product.pricing_details && (
            <span className="text-[10px] text-slate-400 truncate">
              {product.pricing_details}
            </span>
          )}
        </div>

        {product.description && (
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        )}

        {/* Key features */}
        {product.key_features.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {product.key_features.slice(0, 3).map((f, i) => (
              <span key={i} className="text-[10px] bg-indigo-50 text-indigo-600 font-medium px-1.5 py-0.5 rounded">
                {f}
              </span>
            ))}
            {product.key_features.length > 3 && (
              <span className="text-[10px] text-slate-400">
                +{product.key_features.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
