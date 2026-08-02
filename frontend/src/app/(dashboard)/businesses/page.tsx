"use client";

import { BusinessList } from "@/features/business";

export default function BusinessesPage() {
  return (
    <div className="min-h-full bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Your Businesses</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Each business has its own knowledge object and campaign history
            </p>
          </div>
          {/* Breadcrumb / context */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-indigo-600 font-semibold"
              style={{ background: "rgba(99,102,241,0.08)" }}
            >
              ✦ Businesses
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        <BusinessList />
      </div>
    </div>
  );
}
