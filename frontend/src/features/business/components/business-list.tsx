"use client";

import { useBusinesses } from "../hooks/use-businesses";
import { BusinessCard, AddBusinessCard } from "./business-card";
import { useState } from "react";
import { OnboardingWizard } from "./onboarding-wizard/wizard-shell";

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
      <div className="h-1 w-full bg-slate-200" />
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-100" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-slate-100 rounded w-2/3" />
            <div className="h-3 bg-slate-100 rounded w-1/2" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="h-3 bg-slate-100 rounded w-full" />
          <div className="h-1.5 bg-slate-100 rounded-full w-full" />
        </div>
        <div className="h-3 bg-slate-100 rounded w-1/3" />
      </div>
    </div>
  );
}

export function BusinessList() {
  const { data, isLoading } = useBusinesses();
  const [wizardOpen, setWizardOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  const businesses = data?.businesses ?? [];

  if (businesses.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl mb-6"
            style={{ background: "linear-gradient(135deg,#1e1048,#7c3aed)" }}
          >
            <span className="text-2xl">✦</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Add your first business
          </h2>
          <p className="text-slate-500 text-sm max-w-xs mb-8 leading-relaxed">
            Import a website URL and AI will extract your business profile, or
            fill in the details manually.
          </p>
          <button
            onClick={() => setWizardOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
          >
            <span className="text-base leading-none">+</span>
            Add Business
          </button>
        </div>
        <OnboardingWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {businesses.map((biz, i) => (
          <BusinessCard key={biz.id} business={biz} index={i} />
        ))}
        <AddBusinessCard onClick={() => setWizardOpen(true)} />
      </div>
      <OnboardingWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </>
  );
}
