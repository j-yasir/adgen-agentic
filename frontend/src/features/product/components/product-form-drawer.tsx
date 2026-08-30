"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X, Plus, Loader2, Star, Link2, ClipboardList, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateProduct, useCreateProductFromUrl, useUpdateProduct } from "../hooks/use-products";
import { ProductImageManager } from "./product-image-manager";
import type { ProductResponse, ProductType, PricingModel, PricingTier } from "../types";

const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: "saas_product", label: "SaaS Product" },
  { value: "physical", label: "Physical Product" },
  { value: "service", label: "Service" },
  { value: "subscription", label: "Subscription" },
  { value: "digital", label: "Digital Product" },
  { value: "marketplace", label: "Marketplace" },
];

const PRICING_MODELS: { value: PricingModel; label: string }[] = [
  { value: "one_time", label: "One-time Payment" },
  { value: "subscription", label: "Subscription" },
  { value: "freemium", label: "Freemium" },
  { value: "pay_per_use", label: "Pay Per Use" },
  { value: "enterprise", label: "Enterprise" },
  { value: "free", label: "Free" },
];

const PRICING_TIERS: { value: PricingTier; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "low", label: "Low (<$20/mo)" },
  { value: "mid", label: "Mid ($20–$100/mo)" },
  { value: "premium", label: "Premium ($100+/mo)" },
  { value: "enterprise", label: "Enterprise" },
];

// Inline tag-input component
function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function addTag() {
    const trimmed = draft.trim();
    if (!trimmed || values.includes(trimmed)) {
      setDraft("");
      return;
    }
    onChange([...values, trimmed]);
    setDraft("");
  }

  function removeTag(idx: number) {
    onChange(values.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label}
      </Label>
      <div className="flex flex-wrap gap-1.5 min-h-8 p-1.5 rounded-lg border border-slate-200 bg-slate-50 focus-within:border-indigo-400 focus-within:bg-white transition-colors">
        {values.map((v, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 font-medium px-2 py-0.5 rounded-md"
          >
            {v}
            <button type="button" onClick={() => removeTag(i)} className="hover:text-indigo-900">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag();
            }
            if (e.key === "Backspace" && !draft && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={addTag}
          placeholder={values.length === 0 ? placeholder : ""}
          className="flex-1 min-w-24 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400"
        />
      </div>
      <p className="text-[11px] text-slate-400">Press Enter or comma to add</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface ProductFormDrawerProps {
  businessId: string;
  open: boolean;
  onClose: () => void;
  product?: ProductResponse; // present = edit mode
}

type FormState = {
  name: string;
  type: ProductType;
  is_hero: boolean;
  description: string;
  key_features: string[];
  benefits: string[];
  unique_selling_points: string[];
  pricing_model: PricingModel;
  pricing_tier: PricingTier;
  pricing_details: string;
  target_use_case: string;
};

function defaultForm(product?: ProductResponse): FormState {
  return {
    name: product?.name ?? "",
    type: product?.type ?? "saas_product",
    is_hero: product?.is_hero ?? false,
    description: product?.description ?? "",
    key_features: product?.key_features ?? [],
    benefits: product?.benefits ?? [],
    unique_selling_points: product?.unique_selling_points ?? [],
    pricing_model: product?.pricing_model ?? "one_time",
    pricing_tier: product?.pricing_tier ?? "mid",
    pricing_details: product?.pricing_details ?? "",
    target_use_case: product?.target_use_case ?? "",
  };
}

export function ProductFormDrawer({
  businessId,
  open,
  onClose,
  product,
}: ProductFormDrawerProps) {
  const isEdit = !!product;
  const [form, setForm] = useState<FormState>(() => defaultForm(product));
  const [mode, setMode] = useState<"manual" | "url">("manual");
  const [importUrl, setImportUrl] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const createMut = useCreateProduct(businessId);
  const updateMut = useUpdateProduct(businessId);
  const createFromUrlMut = useCreateProductFromUrl(businessId);
  const isPending = createMut.isPending || updateMut.isPending;

  // Reset form when drawer opens / product changes
  useEffect(() => {
    if (open) {
      setForm(defaultForm(product));
      setMode("manual");
      setImportUrl("");
      scrollRef.current?.scrollTo({ top: 0 });
    }
  }, [open, product]);

  async function handleImportFromUrl() {
    if (!importUrl.trim()) return;
    try {
      const result = await createFromUrlMut.mutateAsync({ url: importUrl.trim() });
      toast.success(
        result.images.length > 0
          ? `"${result.name}" created with a photo — review and refine anytime.`
          : `"${result.name}" created — no photo was found, add one whenever you like.`
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to research product from URL");
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.description.trim()) {
      toast.error("Name and description are required");
      return;
    }

    const payload = {
      name: form.name.trim(),
      type: form.type,
      is_hero: form.is_hero,
      description: form.description.trim(),
      key_features: form.key_features,
      benefits: form.benefits,
      unique_selling_points: form.unique_selling_points,
      pricing_model: form.pricing_model,
      pricing_tier: form.pricing_tier,
      ...(form.pricing_details.trim() && { pricing_details: form.pricing_details.trim() }),
      ...(form.target_use_case.trim() && { target_use_case: form.target_use_case.trim() }),
    };

    try {
      if (isEdit) {
        await updateMut.mutateAsync({ productId: product.id, data: payload });
        toast.success("Product updated");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Product created");
      }
      onClose();
    } catch {
      toast.error(isEdit ? "Failed to update product" : "Failed to create product");
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Backdrop className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-200" />

        {/* Drawer panel */}
        <DialogPrimitive.Popup className="fixed right-0 top-0 z-50 h-full w-full max-w-[500px] bg-white shadow-2xl flex flex-col data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right duration-300 outline-none">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 shrink-0">
            <div>
              <DialogPrimitive.Title className="text-base font-bold text-slate-900">
                {isEdit ? "Edit Product" : "Add Product"}
              </DialogPrimitive.Title>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEdit
                  ? "Update product details and images"
                  : "Products ground the pipeline with real offering details"}
              </p>
            </div>
            <DialogPrimitive.Close
              className="h-8 w-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
              onClick={onClose}
            >
              <X className="h-4 w-4 text-slate-400" />
            </DialogPrimitive.Close>
          </div>

          {/* Mode toggle — only when creating, not editing */}
          {!isEdit && (
            <div className="flex gap-1.5 px-6 py-3 border-b border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setMode("url")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  mode === "url" ? "bg-indigo-50 text-indigo-600 border border-indigo-200" : "text-slate-400 border border-transparent hover:bg-slate-50"
                }`}
              >
                <Link2 className="h-3.5 w-3.5" />
                Import from URL
              </button>
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  mode === "manual" ? "bg-indigo-50 text-indigo-600 border border-indigo-200" : "text-slate-400 border border-transparent hover:bg-slate-50"
                }`}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Fill Manually
              </button>
            </div>
          )}

          {/* URL import view */}
          {!isEdit && mode === "url" && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Paste a product URL</p>
                <p className="text-xs text-slate-500 mt-1">
                  An AI agent researches the product and writes up its profile. Separately, we
                  try to find and attach its real photo — no research needed for that part, it
                  just reads the page&apos;s own image tag.
                </p>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 transition-all">
                  <Link2 className="h-4 w-4 text-slate-400 shrink-0" />
                  <input
                    type="url"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="https://yourstore.com/products/..."
                    disabled={createFromUrlMut.isPending}
                    className="flex-1 text-sm text-slate-800 placeholder:text-slate-400 outline-none bg-transparent disabled:opacity-60"
                    onKeyDown={(e) => e.key === "Enter" && handleImportFromUrl()}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleImportFromUrl}
                disabled={!importUrl.trim() || createFromUrlMut.isPending}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
              >
                {createFromUrlMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Researching product…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Import Product
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
              {createFromUrlMut.isPending && (
                <p className="text-xs text-slate-400 text-center">
                  Usually takes 15–20 seconds — researching the page, writing up the profile, and looking for a real photo.
                </p>
              )}
            </div>
          )}

          {/* Scrollable body — manual form, hidden while URL-import mode is active */}
          <div ref={scrollRef} className={`flex-1 overflow-y-auto ${!isEdit && mode === "url" ? "hidden" : ""}`}>
            <form id="product-form" onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Name + Hero toggle */}
              <div className="flex gap-3 items-start">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="product-name" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Product Name *
                  </Label>
                  <Input
                    id="product-name"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="e.g. Karakoram Classic Blend"
                    required
                    className="text-sm"
                  />
                </div>

                {/* Hero toggle */}
                <div className="shrink-0 mt-6">
                  <button
                    type="button"
                    onClick={() => set("is_hero", !form.is_hero)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      form.is_hero
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                    title="Mark as hero product — used as the primary product in campaigns"
                  >
                    <Star className={`h-3.5 w-3.5 ${form.is_hero ? "fill-amber-500 text-amber-500" : "text-slate-400"}`} />
                    Hero
                  </button>
                </div>
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Product Type *
                </Label>
                <Select value={form.type} onValueChange={(v) => set("type", v as ProductType)}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="product-desc" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Description *
                </Label>
                <Textarea
                  id="product-desc"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Describe the product: what it is, who it's for, what problem it solves"
                  rows={3}
                  required
                  className="text-sm resize-none"
                />
              </div>

              {/* Key Features */}
              <TagInput
                label="Key Features"
                values={form.key_features}
                onChange={(v) => set("key_features", v)}
                placeholder="e.g. Single-origin Arabica beans"
              />

              {/* Benefits */}
              <TagInput
                label="Benefits"
                values={form.benefits}
                onChange={(v) => set("benefits", v)}
                placeholder="e.g. Rich, smooth taste with no bitterness"
              />

              {/* USPs */}
              <TagInput
                label="Unique Selling Points"
                values={form.unique_selling_points}
                onChange={(v) => set("unique_selling_points", v)}
                placeholder="e.g. Sourced from Karakoram farmers, altitude-grown"
              />

              {/* Pricing model + tier */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Pricing Model *
                  </Label>
                  <Select value={form.pricing_model} onValueChange={(v) => set("pricing_model", v as PricingModel)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRICING_MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Pricing Tier *
                  </Label>
                  <Select value={form.pricing_tier} onValueChange={(v) => set("pricing_tier", v as PricingTier)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRICING_TIERS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Pricing details */}
              <div className="space-y-1.5">
                <Label htmlFor="pricing-details" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Pricing Details <span className="font-normal text-slate-400 normal-case">(optional)</span>
                </Label>
                <Input
                  id="pricing-details"
                  value={form.pricing_details}
                  onChange={(e) => set("pricing_details", e.target.value)}
                  placeholder="e.g. PKR 2,500 per 250g bag"
                  className="text-sm"
                />
              </div>

              {/* Target use case */}
              <div className="space-y-1.5">
                <Label htmlFor="use-case" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Target Use Case <span className="font-normal text-slate-400 normal-case">(optional)</span>
                </Label>
                <Input
                  id="use-case"
                  value={form.target_use_case}
                  onChange={(e) => set("target_use_case", e.target.value)}
                  placeholder="e.g. Morning espresso for coffee enthusiasts"
                  className="text-sm"
                />
              </div>

              {/* Image manager — only in edit mode */}
              {isEdit && (
                <div className="pt-2 border-t border-slate-100">
                  <ProductImageManager
                    businessId={businessId}
                    productId={product.id}
                    images={product.images}
                  />
                </div>
              )}

              {/* Spacer so content doesn't sit under sticky footer */}
              <div className="h-4" />
            </form>
          </div>

          {/* Sticky footer — hidden in URL-import mode, which has its own inline submit button */}
          <div className={`shrink-0 px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3 ${!isEdit && mode === "url" ? "hidden" : ""}`}>
            <p className="text-xs text-slate-400">
              {isEdit ? "Changes save to pipeline immediately" : "Images can be added after creation"}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="product-form"
                disabled={isPending}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isEdit ? "Saving…" : "Creating…"}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {isEdit ? "Save Changes" : "Add Product"}
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
