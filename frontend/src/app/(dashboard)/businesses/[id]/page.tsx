"use client";

import { use } from "react";
import { useBusinessDetail } from "@/features/business";
import { BkoViewer } from "@/features/business";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Building2, Megaphone, Plus } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api-client";
import { formatDate } from "@/shared/lib/utils";

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

function statusColor(status: string) {
  switch (status) {
    case "done": return "text-green-400 bg-green-500/10";
    case "running": return "text-indigo-400 bg-indigo-500/10";
    case "awaiting_review": return "text-amber-400 bg-amber-500/10";
    case "failed": return "text-red-400 bg-red-500/10";
    default: return "text-muted-foreground bg-muted";
  }
}

export default function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: business, isLoading } = useBusinessDetail(id);
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns", id],
    queryFn: () => apiClient<CampaignListResponse>(`/campaigns?business_id=${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="p-6 lg:p-8">
        <p className="text-muted-foreground">Business not found</p>
      </div>
    );
  }

  const completeness = business.bko
    ? ((business.bko as Record<string, unknown>).meta as Record<string, unknown>)?.completeness_score
    : null;
  const score = typeof completeness === "number" ? Math.round(completeness * 100) : null;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/businesses">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{business.name}</h1>
            <p className="text-sm text-muted-foreground">{business.industry}</p>
          </div>
        </div>
        <Badge variant="outline" className="ml-auto">BKO v{business.bko_version}</Badge>
      </div>

      {score !== null && (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">BKO Completeness</span>
              <span className="font-mono text-indigo-400">{score}%</span>
            </div>
            <Progress value={score} className="h-2" />
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Campaigns</h2>
        <Link href={`/campaigns/new?business_id=${id}`}>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-500" size="sm">
            <Plus className="mr-1 h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      {campaigns && campaigns.campaigns.length > 0 ? (
        <div className="space-y-2">
          {campaigns.campaigns.map((c) => (
            <Link key={c.id} href={`/campaigns/${c.id}`}>
              <Card className="border-border/50 bg-card/50 hover:border-indigo-500/30 transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Megaphone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{c.campaign_name ?? c.objective}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.platforms.join(", ")} &middot; {formatDate(c.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {c.audit_score && (
                      <span className="font-mono text-sm text-indigo-400">
                        {c.audit_score.toFixed(1)}
                      </span>
                    )}
                    <Badge className={statusColor(c.status)}>{c.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-border/50 bg-transparent">
          <CardContent className="p-8 text-center text-muted-foreground">
            No campaigns yet. Launch your first one!
          </CardContent>
        </Card>
      )}

      <Separator className="opacity-30" />

      <div>
        <h2 className="text-lg font-semibold mb-4">Brand Knowledge Object</h2>
        {business.bko ? (
          <BkoViewer bko={business.bko as Record<string, unknown>} />
        ) : (
          <p className="text-muted-foreground">BKO not generated yet</p>
        )}
      </div>
    </div>
  );
}
