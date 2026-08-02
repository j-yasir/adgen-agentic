"use client";

import { Suspense } from "react";
import { CampaignForm } from "@/features/campaign";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewCampaignPage() {
  return (
    <div className="min-h-full bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 lg:px-8">
        <div className="flex items-center gap-4 mb-1">
          <Link
            href="/businesses"
            className="flex items-center justify-center h-8 w-8 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-slate-400" />
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm text-slate-500">Businesses</span>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-semibold text-slate-700">New Campaign</span>
        </div>
        <div className="mt-3 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Launch a Campaign</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Brief the agents — they&apos;ll handle research, strategy, production, and audit
            </p>
          </div>
          <span
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "rgba(99,102,241,0.08)", color: "#6366f1" }}
          >
            ✦ 4 agents on standby
          </span>
        </div>
      </div>

      <div className="p-6 lg:p-8 max-w-5xl">
        <Suspense>
          <CampaignForm />
        </Suspense>
      </div>
    </div>
  );
}
