"use client";

import Link from "next/link";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { useBusinessDetail } from "@/features/business/hooks/use-businesses";
import { useProducts } from "../hooks/use-products";

interface AssetGroundingPanelProps {
  businessId: string;
}

type GapStatus = "ok" | "warn" | "missing";

interface CheckRow {
  label: string;
  status: GapStatus;
  detail: string;
  cta?: { label: string; href: string };
}

function StatusIcon({ status }: { status: GapStatus }) {
  if (status === "ok")
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />;
  if (status === "warn")
    return <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />;
  return <XCircle className="h-4 w-4 shrink-0 text-red-400" />;
}

export function AssetGroundingPanel({ businessId }: AssetGroundingPanelProps) {
  const { data: business, isLoading: bizLoading } = useBusinessDetail(businessId);
  const { data: productData, isLoading: prodLoading } = useProducts(businessId);

  const isLoading = bizLoading || prodLoading;

  if (!businessId) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Asset Grounding
        </p>
        <p className="text-xs text-slate-400">Select a business to check pipeline readiness.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
        <span className="text-xs text-slate-400">Checking assets…</span>
      </div>
    );
  }

  const bko = business?.bko as Record<string, unknown> | null | undefined;
  const identity = bko?.identity as Record<string, unknown> | undefined;
  const logoUrl = identity?.logo_url as string | null | undefined;

  const products = productData?.products ?? [];
  const heroProduct = products.find((p) => p.is_hero);
  const anyWithImages = products.some((p) => p.images.length > 0);
  const heroHasImages = heroProduct ? heroProduct.images.length > 0 : false;

  const checks: CheckRow[] = [
    // 1. Logo
    logoUrl
      ? { label: "Brand logo", status: "ok", detail: "Pipeline will use your logo in creatives" }
      : {
          label: "Brand logo",
          status: "missing",
          detail: "No logo — pipeline uses placeholder",
          cta: { label: "Upload logo", href: `/businesses/${businessId}` },
        },

    // 2. Products
    products.length > 0
      ? {
          label: "Products",
          status: "ok",
          detail: `${products.length} product${products.length !== 1 ? "s" : ""} in database`,
        }
      : {
          label: "Products",
          status: "missing",
          detail: "No products — pipeline uses BKO offerings only",
          cta: { label: "Add products", href: `/businesses/${businessId}?tab=products` },
        },

    // 3. Hero product
    products.length === 0
      ? null
      : heroProduct
      ? { label: "Hero product", status: "ok", detail: `"${heroProduct.name}" is marked hero` }
      : {
          label: "Hero product",
          status: "warn",
          detail: "No hero product set — pipeline picks arbitrarily",
          cta: { label: "Set hero", href: `/businesses/${businessId}?tab=products` },
        },

    // 4. Product images
    products.length === 0
      ? null
      : heroHasImages
      ? { label: "Product images", status: "ok", detail: "Hero product has images for creatives" }
      : anyWithImages
      ? {
          label: "Product images",
          status: "warn",
          detail: "Hero product has no images — static ads may miss visuals",
          cta: { label: "Add images", href: `/businesses/${businessId}?tab=products` },
        }
      : {
          label: "Product images",
          status: "missing",
          detail: "No product images — static ads will lack visuals",
          cta: { label: "Add images", href: `/businesses/${businessId}?tab=products` },
        },
  ].filter(Boolean) as CheckRow[];

  const missingCount = checks.filter((c) => c.status === "missing").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const allGood = missingCount === 0 && warnCount === 0;

  return (
    <div
      className="bg-white rounded-2xl border overflow-hidden"
      style={{
        borderColor: allGood ? "rgba(34,197,94,0.3)" : missingCount > 0 ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.3)",
      }}
    >
      {/* Header stripe */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{
          background: allGood
            ? "rgba(34,197,94,0.06)"
            : missingCount > 0
            ? "rgba(239,68,68,0.05)"
            : "rgba(245,158,11,0.06)",
        }}
      >
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Asset Grounding
        </p>
        {allGood ? (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            Pipeline-ready
          </span>
        ) : (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={
              missingCount > 0
                ? { color: "#dc2626", background: "rgba(239,68,68,0.1)" }
                : { color: "#d97706", background: "rgba(245,158,11,0.1)" }
            }
          >
            {missingCount} gap{missingCount !== 1 ? "s" : ""} detected
          </span>
        )}
      </div>

      {/* Check rows */}
      <div className="px-5 py-4 space-y-3">
        {checks.map((c) => (
          <div key={c.label} className="flex items-start gap-2.5">
            <StatusIcon status={c.status} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700">{c.label}</p>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{c.detail}</p>
              {c.cta && (
                <Link
                  href={c.cta.href}
                  target="_blank"
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-2 mt-0.5 inline-block"
                >
                  {c.cta.label} →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      {!allGood && (
        <div className="px-5 pb-4">
          <p className="text-[11px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2 leading-relaxed">
            Gaps don&apos;t block launch — the pipeline uses BKO data as fallback.
            Better assets = higher-quality creatives.
          </p>
        </div>
      )}
    </div>
  );
}
