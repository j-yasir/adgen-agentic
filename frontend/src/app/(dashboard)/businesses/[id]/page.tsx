"use client";

import { use, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useBusinessDetail } from "@/features/business";
import { BkoViewer } from "@/features/business";
import { ArrowLeft, Megaphone, Plus, ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api-client";
import { formatDate, formatRelativeTime } from "@/shared/lib/utils";
import { OnboardingWizard } from "@/features/business/components/onboarding-wizard/wizard-shell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LogoUpload } from "@/features/product";
import { ProductList } from "@/features/product";

type CampaignResponse = {
  id: string;
  campaign_name: string | null;
  objective: string;
  status: string;
  audit_score: number | null;
  created_at: string;
  platforms: string[];
};

type CampaignListResponse = {
  campaigns: CampaignResponse[];
  total: number;
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  done:             { label: "Done",           color: "#16a34a", bg: "rgba(34,197,94,0.1)" },
  running:          { label: "Running",        color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
  awaiting_review:  { label: "Review needed",  color: "#d97706", bg: "rgba(245,158,11,0.1)" },
  failed:           { label: "Failed",         color: "#dc2626", bg: "rgba(239,68,68,0.1)" },
  pending:          { label: "Pending",        color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
};


export default function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "products" ? "products" : "overview";

  const { data: business, isLoading } = useBusinessDetail(id);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns", id],
    queryFn: () => apiClient<CampaignListResponse>(`/campaigns?business_id=${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-full bg-slate-50 p-6 lg:p-8 space-y-4 animate-pulse">
        <div className="h-40 bg-white rounded-2xl border border-slate-200" />
        <div className="h-64 bg-white rounded-2xl border border-slate-200" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-full bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Business not found</p>
      </div>
    );
  }

  const bko = business.bko as Record<string, unknown> | null;
  const completeness = bko
    ? (bko.meta as Record<string, unknown>)?.completeness_score
    : null;
  const score = typeof completeness === "number" ? Math.round(completeness * 100) : null;

  const identity = bko?.identity as Record<string, unknown> | undefined;
  const logoUrl = identity?.logo_url as string | null | undefined;
  const initials = business.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-full bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 lg:px-8">
        <div className="flex items-center gap-4">
          <Link
            href="/businesses"
            className="flex items-center justify-center h-8 w-8 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-slate-400" />
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm text-slate-500">Businesses</span>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-semibold text-slate-700">{business.name}</span>
        </div>
      </div>

      <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
        {/* Business profile card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899)" }} />
          <div className="p-6 flex items-start gap-5">
            {/* Logo upload */}
            <LogoUpload
              businessId={id}
              logoUrl={logoUrl}
              initials={initials}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{business.name}</h1>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {business.industry && (
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {business.industry}
                      </span>
                    )}
                    {business.website && (
                      <a
                        href={business.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5"
                      >
                        {business.website.replace(/^https?:\/\//, "")}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                      BKO v{business.bko_version}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setEditOpen(true)}
                    className="flex items-center gap-1.5 text-sm font-medium text-slate-600 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit BKO
                  </button>
                  <Link
                    href={`/campaigns/new?business_id=${id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl transition-opacity hover:opacity-90"
                    style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
                  >
                    <Plus className="h-4 w-4" />
                    New Campaign
                  </Link>
                </div>
              </div>

              {/* Completeness bar */}
              {score !== null && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-400 font-medium">BKO completeness</span>
                    <span className="font-semibold font-mono text-indigo-600">{score}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${score}%`, background: "linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899)" }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList variant="line" className="border-b border-slate-200 w-full rounded-none pb-0 gap-0">
            <TabsTrigger value="overview" className="px-4 pb-3 text-sm">
              Overview
            </TabsTrigger>
            <TabsTrigger value="products" className="px-4 pb-3 text-sm">
              Products &amp; Assets
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="px-4 pb-3 text-sm">
              Campaigns
              {campaigns && campaigns.total > 0 && (
                <span className="ml-1.5 text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                  {campaigns.total}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="pt-4">
            {bko ? (
              <div className="space-y-1">
                <div className="flex items-center justify-end text-xs text-slate-400 px-1 pb-2">
                  <span>Updated {formatRelativeTime(business.updated_at)}</span>
                </div>
                <BkoViewer bko={bko} businessId={id} />
              </div>
            ) : (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
                <p className="text-sm text-slate-500">No BKO data yet. Edit the business to populate it.</p>
              </div>
            )}
          </TabsContent>

          {/* ── Products & Assets ── */}
          <TabsContent value="products" className="pt-4">
            <ProductList businessId={id} />
          </TabsContent>

          {/* ── Campaigns ── */}
          <TabsContent value="campaigns" className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900">Campaigns</h2>
              <Link
                href={`/campaigns/new?business_id=${id}`}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                + New campaign
              </Link>
            </div>
            {campaigns && campaigns.campaigns.length > 0 ? (
              <div className="space-y-2">
                {campaigns.campaigns.map((c) => {
                  const sm = STATUS_META[c.status] ?? STATUS_META.pending;
                  return (
                    <Link key={c.id} href={`/campaigns/${c.id}`} className="block group">
                      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-4 hover:border-slate-300 hover:shadow-sm transition-all">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 text-sm truncate group-hover:text-indigo-600 transition-colors">
                            {c.campaign_name ?? c.objective}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {c.platforms.join(", ")} &middot; {formatDate(c.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {c.audit_score !== null && (
                            <span className="font-mono text-sm font-bold text-emerald-600">
                              {c.audit_score.toFixed(0)}
                              <span className="text-xs font-normal text-slate-400">/100</span>
                            </span>
                          )}
                          <span
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ color: sm.color, background: sm.bg }}
                          >
                            {sm.label}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
                <Megaphone className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500 mb-4">No campaigns yet for this business</p>
                <Link
                  href={`/campaigns/new?business_id=${id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
                >
                  <Plus className="h-4 w-4" />
                  Launch first campaign
                </Link>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit wizard */}
      <OnboardingWizard open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}
