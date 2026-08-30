"use client";

import { useState } from "react";
import { Plus, Package, Loader2 } from "lucide-react";
import { useProducts } from "../hooks/use-products";
import { ProductCard } from "./product-card";
import { ProductFormDrawer } from "./product-form-drawer";
import type { ProductResponse } from "../types";

interface ProductListProps {
  businessId: string;
}

export function ProductList({ businessId }: ProductListProps) {
  const { data, isLoading } = useProducts(businessId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ProductResponse | undefined>(undefined);

  function openCreate() {
    setEditing(undefined);
    setDrawerOpen(true);
  }

  function openEdit(product: ProductResponse) {
    setEditing(product);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditing(undefined);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    );
  }

  const products = data?.products ?? [];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Products</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {products.length === 0
              ? "Add products to ground the pipeline with real offering data"
              : `${products.length} product${products.length === 1 ? "" : "s"} · pipeline-ready`}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      {products.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <Package className="h-10 w-10 text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-500 mb-1">No products yet</p>
          <p className="text-xs text-slate-400 mb-5 max-w-xs mx-auto">
            Adding products lets the pipeline generate ads that match your actual offerings,
            pricing, and visuals.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
          >
            <Plus className="h-4 w-4" />
            Add your first product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              businessId={businessId}
              onEdit={openEdit}
            />
          ))}

          {/* Add another card */}
          <button
            type="button"
            onClick={openCreate}
            className="group h-full min-h-[200px] rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all flex flex-col items-center justify-center gap-2 p-6"
          >
            <div className="h-10 w-10 rounded-xl bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
              <Plus className="h-5 w-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
            </div>
            <span className="text-sm font-medium text-slate-400 group-hover:text-indigo-600 transition-colors">
              Add product
            </span>
          </button>
        </div>
      )}

      <ProductFormDrawer
        businessId={businessId}
        open={drawerOpen}
        onClose={closeDrawer}
        product={editing}
      />
    </>
  );
}
