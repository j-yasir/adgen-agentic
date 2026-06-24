"use client";

import { useCampaignStream } from "../hooks/use-campaign-stream";
import { useCampaign, useCampaignAssets, useResumeCampaign } from "../hooks/use-campaigns";
import { PipelineStepper } from "./pipeline-stepper";
import { ActivityFeed } from "./activity-feed";
import { ReviewPanel } from "./hitl/review-panel";
import { AssetGallery } from "./asset-gallery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/shared/lib/utils";
import { campaignApi } from "../lib/api";
import type { CampaignEvent, PipelineStage } from "../types";

function derivePipelineStage(status: string): PipelineStage {
  switch (status) {
    case "done": return "completed";
    case "failed": return "failed";
    case "awaiting_review": return "awaiting_review";
    case "running": return "pending";
    default: return "pending";
  }
}

function deriveHitlFromEvents(events: CampaignEvent[]): Record<string, unknown> | null {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].event_type === "hitl_required") {
      return events[i].payload;
    }
  }
  return null;
}

function deriveCurrentAgentFromEvents(events: CampaignEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].event_type === "agent_started") return events[i].agent;
    if (events[i].event_type === "agent_completed") return null;
    if (events[i].event_type === "hitl_required") return null;
  }
  return null;
}

function deriveStageFromEvents(events: CampaignEvent[]): PipelineStage | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.event_type === "campaign_done") return "completed";
    if (e.event_type === "campaign_failed") return "failed";
    if (e.event_type === "hitl_required") return "awaiting_review";
    if (e.event_type === "agent_started" && e.agent && e.agent !== "orchestrator") return e.agent as PipelineStage;
  }
  return null;
}

export function CampaignLiveView({ campaignId }: { campaignId: string }) {
  const { data: campaign } = useCampaign(campaignId);
  const { data: assets, refetch: refetchAssets } = useCampaignAssets(campaignId);
  const resumeCampaign = useResumeCampaign();

  const { data: restEvents } = useQuery({
    queryKey: ["campaign-events", campaignId],
    queryFn: () => campaignApi.getEvents(campaignId),
    enabled: !!campaignId,
  });

  const { events: streamEvents, currentAgent: streamAgent, hitlData: streamHitl, pipelineStage: streamStage, clearHitl } =
    useCampaignStream(campaignId, campaign?.status);

  const allEvents = streamEvents.length > 0 ? streamEvents : (restEvents ?? []);
  const pipelineStage = streamEvents.length > 0
    ? streamStage
    : (deriveStageFromEvents(allEvents) ?? derivePipelineStage(campaign?.status ?? "pending"));
  const currentAgent = streamEvents.length > 0
    ? streamAgent
    : deriveCurrentAgentFromEvents(allEvents);
  const hitlData = streamEvents.length > 0
    ? streamHitl
    : (campaign?.status === "awaiting_review" ? deriveHitlFromEvents(allEvents) : null);

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!campaign?.created_at) return;
    if (pipelineStage === "completed" || pipelineStage === "failed") return;

    const start = new Date(campaign.created_at).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [campaign?.created_at, pipelineStage]);

  useEffect(() => {
    if (pipelineStage === "completed") {
      refetchAssets();
    }
  }, [pipelineStage, refetchAssets]);

  async function handleResume(approved: boolean, feedback?: string) {
    try {
      await resumeCampaign.mutateAsync({
        id: campaignId,
        data: { approved, feedback },
      });
      clearHitl();
      toast.success(approved ? "Approved — pipeline resuming" : "Rejected — pipeline will redo");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resume failed");
    }
  }

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href={campaign ? `/businesses/${campaign.business_id}` : "/businesses"}>
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold">
              {campaign?.campaign_name ?? campaign?.objective ?? "Campaign"}
            </h1>
            {campaign && (
              <p className="text-xs text-muted-foreground">
                {campaign.platforms.join(", ")} &middot; {campaign.objective}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {pipelineStage !== "completed" && pipelineStage !== "failed" && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-mono">
              <Clock className="h-3.5 w-3.5" />
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>
          )}
          <Badge
            className={cn(
              pipelineStage === "completed" && "bg-green-500/10 text-green-400",
              pipelineStage === "failed" && "bg-red-500/10 text-red-400",
              pipelineStage === "awaiting_review" && "bg-amber-500/10 text-amber-400 animate-pulse",
              !["completed", "failed", "awaiting_review"].includes(pipelineStage) && "bg-indigo-500/10 text-indigo-400"
            )}
          >
            {pipelineStage === "awaiting_review"
              ? "Review Required"
              : pipelineStage === "completed"
              ? "Done"
              : pipelineStage === "failed"
              ? "Failed"
              : "Running"}
          </Badge>
        </div>
      </div>

      {/* Pipeline stepper */}
      <div className="border-b border-border/50 px-6">
        <PipelineStepper stage={pipelineStage} currentAgent={currentAgent} />
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Activity feed — left panel */}
        <div className="w-1/2 border-r border-border/50 overflow-hidden">
          <div className="px-4 py-2 border-b border-border/50">
            <h2 className="text-sm font-medium text-muted-foreground">
              Activity Feed
              {allEvents.length > 0 && (
                <span className="ml-2 text-xs">({allEvents.length} events)</span>
              )}
            </h2>
          </div>
          <div className="h-[calc(100%-37px)]">
            <ActivityFeed events={allEvents} />
          </div>
        </div>

        {/* Detail panel — right side */}
        <div className="w-1/2 overflow-hidden">
          {hitlData ? (
            <ReviewPanel
              hitlData={hitlData}
              campaignId={campaignId}
              onResume={handleResume}
              isResuming={resumeCampaign.isPending}
            />
          ) : pipelineStage === "completed" && assets && assets.length > 0 ? (
            <div className="p-4 overflow-auto h-full">
              <AssetGallery assets={assets} auditScore={campaign?.audit_score} />
            </div>
          ) : pipelineStage === "failed" ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-red-400">
              <p className="text-lg font-semibold">Pipeline Failed</p>
              <p className="text-sm text-muted-foreground max-w-md text-center">
                {campaign?.error ?? "An unexpected error occurred during processing."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-indigo-500/50 animate-pulse" />
                <div className="h-2 w-2 rounded-full bg-indigo-500/50 animate-pulse" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-2 rounded-full bg-indigo-500/50 animate-pulse" style={{ animationDelay: "300ms" }} />
              </div>
              <p className="text-sm">
                {currentAgent
                  ? `${currentAgent.charAt(0).toUpperCase() + currentAgent.slice(1)} is working...`
                  : "Waiting for activity..."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom asset gallery (when completed) */}
      {pipelineStage === "completed" && assets && assets.length > 0 && (
        <div className="border-t border-border/50 p-6">
          <AssetGallery assets={assets} auditScore={campaign?.audit_score} />
        </div>
      )}
    </div>
  );
}
