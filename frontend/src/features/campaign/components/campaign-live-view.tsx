"use client";

import { useCampaignStream } from "../hooks/use-campaign-stream";
import { useCampaign, useCampaignAssets, useResumeCampaign, useRetryCampaign } from "../hooks/use-campaigns";
import { ReviewPanel } from "./hitl/review-panel";
import { AssetGallery } from "./asset-gallery";
import { AgentCanvas } from "./agent-canvas";
import { ActivityFeed } from "./activity-feed";
import { ArrowLeft, Clock, RotateCw, Check, Loader2, PauseCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/shared/lib/utils";
import { campaignApi } from "../lib/api";
import type { CampaignEvent, PipelineStage } from "../types";

type AgentKey = "researcher" | "strategist" | "producer" | "auditor";

const PIPELINE_AGENTS: { key: AgentKey; label: string; color: string }[] = [
  { key: "researcher", label: "Researcher", color: "#6366f1" },
  { key: "strategist", label: "Strategist", color: "#8b5cf6" },
  { key: "producer", label: "Producer", color: "#ec4899" },
  { key: "auditor", label: "Auditor", color: "#22c55e" },
];

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
    if (events[i].event_type === "hitl_required") return events[i].payload;
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
    if (e.event_type === "agent_started" && e.agent && e.agent !== "orchestrator")
      return e.agent as PipelineStage;
  }
  return null;
}

function deriveCompletedAgents(events: CampaignEvent[]): Set<string> {
  const done = new Set<string>();
  events.forEach((e) => {
    if (e.event_type === "agent_completed" && e.agent) done.add(e.agent);
  });
  return done;
}

export function CampaignLiveView({ campaignId }: { campaignId: string }) {
  const { data: campaign } = useCampaign(campaignId);
  const { data: assets, refetch: refetchAssets } = useCampaignAssets(campaignId);
  const resumeCampaign = useResumeCampaign();
  const retryCampaign = useRetryCampaign();

  const { data: restEvents } = useQuery({
    queryKey: ["campaign-events", campaignId],
    queryFn: () => campaignApi.getEvents(campaignId),
    enabled: !!campaignId,
  });

  const {
    events: streamEvents,
    currentAgent: streamAgent,
    hitlData: streamHitl,
    pipelineStage: streamStage,
    clearHitl,
  } = useCampaignStream(campaignId, campaign?.status);

  const allEvents = streamEvents.length > 0 ? streamEvents : (restEvents ?? []);
  const pipelineStage =
    streamEvents.length > 0
      ? streamStage
      : (deriveStageFromEvents(allEvents) ?? derivePipelineStage(campaign?.status ?? "pending"));
  const currentAgent =
    streamEvents.length > 0
      ? streamAgent
      : deriveCurrentAgentFromEvents(allEvents);
  const hitlData =
    streamEvents.length > 0
      ? streamHitl
      : campaign?.status === "awaiting_review"
      ? deriveHitlFromEvents(allEvents)
      : null;

  const completedAgents = deriveCompletedAgents(allEvents);

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
    if (pipelineStage === "completed") refetchAssets();
  }, [pipelineStage, refetchAssets]);

  async function handleResume(approved: boolean, feedback?: string) {
    try {
      await resumeCampaign.mutateAsync({ id: campaignId, data: { approved, feedback } });
      clearHitl();
      toast.success(approved ? "Approved — pipeline resuming" : "Rejected — pipeline will redo");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resume failed");
    }
  }

  async function handleRetry() {
    try {
      await retryCampaign.mutateAsync(campaignId);
      toast.success("Retrying from last checkpoint");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    }
  }

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  const isHitl = !!hitlData;
  const isDone = pipelineStage === "completed";
  const isFailed = pipelineStage === "failed";
  const isRunning = !isDone && !isFailed && !isHitl;

  const activeAgentConfig = PIPELINE_AGENTS.find((a) => a.key === currentAgent);

  return (
    <div className="flex h-full flex-col bg-slate-50">

      {/* ── Top header bar ── */}
      <div className="flex items-center justify-between bg-white border-b border-slate-200 px-5 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href={campaign ? `/businesses/${campaign.business_id}` : "/businesses"}
            className="flex items-center justify-center h-8 w-8 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-slate-400" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              {campaign?.campaign_name ?? campaign?.objective ?? "Campaign"}
            </h1>
            {campaign && (
              <p className="text-xs text-slate-400">
                {campaign.platforms.join(", ")} · {campaign.objective}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isRunning && (
            <div className="flex items-center gap-1.5 font-mono text-sm text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>
          )}
          <span
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-full",
              isDone && "text-emerald-600",
              isFailed && "text-red-600",
              isHitl && "animate-pulse text-amber-600",
              isRunning && !isHitl && "text-indigo-600"
            )}
            style={{
              background: isDone
                ? "rgba(34,197,94,0.1)"
                : isFailed
                ? "rgba(239,68,68,0.1)"
                : isHitl
                ? "rgba(245,158,11,0.1)"
                : "rgba(99,102,241,0.1)",
            }}
          >
            {isDone
              ? "Done"
              : isFailed
              ? "Failed"
              : isHitl
              ? "Review Required"
              : "Running"}
          </span>
        </div>
      </div>

      {/* ── 3-zone body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Zone 1: Pipeline sidebar (200px) ── */}
        <div className="w-[200px] shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pipeline</p>
          </div>

          <div className="flex flex-col gap-1 px-2 flex-1">
            {PIPELINE_AGENTS.map((agent, idx) => {
              const isActive = currentAgent === agent.key;
              const isDoneAgent =
                completedAgents.has(agent.key) || pipelineStage === "completed";
              const isHitlAt =
                isHitl &&
                !isDoneAgent &&
                !PIPELINE_AGENTS.slice(0, idx).every(
                  (a) => completedAgents.has(a.key)
                );

              return (
                <div
                  key={agent.key}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                    isActive && "shadow-sm",
                    !isActive && !isDoneAgent && "opacity-40"
                  )}
                  style={
                    isActive
                      ? { background: agent.color + "12", border: `1px solid ${agent.color}30` }
                      : isDoneAgent
                      ? { background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)" }
                      : { background: "transparent", border: "1px solid transparent" }
                  }
                >
                  {/* Canvas or status icon */}
                  <div className="relative shrink-0 h-9 w-9">
                    {isDoneAgent ? (
                      <div
                        className="h-9 w-9 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(34,197,94,0.12)" }}
                      >
                        <Check className="h-4 w-4 text-emerald-500" />
                      </div>
                    ) : (
                      <>
                        <div className="rounded-lg overflow-hidden h-9 w-9">
                          <AgentCanvas agent={agent.key} size={36} active={isActive} />
                        </div>
                        {isActive && (
                          <span
                            className="absolute inset-0 rounded-lg animate-ping opacity-20"
                            style={{ background: agent.color }}
                          />
                        )}
                      </>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p
                      className="text-xs font-semibold truncate"
                      style={{ color: isActive ? agent.color : isDoneAgent ? "#22c55e" : "#94a3b8" }}
                    >
                      {agent.label}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {isActive
                        ? "Running…"
                        : isDoneAgent
                        ? "Complete"
                        : isHitlAt
                        ? "Paused"
                        : "Queued"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Done / Failed final state */}
          <div className="px-4 py-3 border-t border-slate-100">
            <div
              className={cn(
                "flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl",
                isDone && "text-emerald-600",
                isFailed && "text-red-500",
                isHitl && "text-amber-500",
                isRunning && "text-slate-400"
              )}
              style={{
                background: isDone
                  ? "rgba(34,197,94,0.08)"
                  : isFailed
                  ? "rgba(239,68,68,0.08)"
                  : isHitl
                  ? "rgba(245,158,11,0.08)"
                  : "rgba(148,163,184,0.08)",
              }}
            >
              {isDone ? (
                <><Sparkles className="h-3.5 w-3.5" /> Campaign done</>
              ) : isFailed ? (
                <><span>✕</span> Failed</>
              ) : isHitl ? (
                <><PauseCircle className="h-3.5 w-3.5" /> Awaiting review</>
              ) : (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing</>
              )}
            </div>
          </div>
        </div>

        {/* ── Zone 2: Center stage ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Agent spotlight (when running) */}
          {isRunning && currentAgent && activeAgentConfig && (
            <div
              className="flex items-center gap-6 px-6 py-5 border-b border-slate-100 shrink-0"
              style={{ background: activeAgentConfig.color + "06" }}
            >
              <div
                className="rounded-2xl p-1 shrink-0"
                style={{ background: activeAgentConfig.color + "14", border: `2px solid ${activeAgentConfig.color}30` }}
              >
                <AgentCanvas agent={currentAgent as AgentKey} size={120} active />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: activeAgentConfig.color + "18", color: activeAgentConfig.color }}
                  >
                    Active
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">{activeAgentConfig.label}</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Processing your campaign — this usually takes 30–90 seconds
                </p>
              </div>
            </div>
          )}

          {/* HITL theater overlay */}
          {isHitl && (
            <div
              className="flex items-center gap-4 px-6 py-4 border-b border-amber-200 shrink-0"
              style={{ background: "rgba(245,158,11,0.06)" }}
            >
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(245,158,11,0.12)" }}
              >
                <PauseCircle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="font-semibold text-amber-700 text-sm">
                  Human review required — pipeline paused
                </p>
                <p className="text-xs text-amber-500 mt-0.5">
                  Review the agent&apos;s output in the right panel and approve or reject to continue
                </p>
              </div>
            </div>
          )}

          {/* Activity feed */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-5 py-2.5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Activity
              </p>
              {allEvents.length > 0 && (
                <span className="text-xs text-slate-400">{allEvents.length} events</span>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <ActivityFeed events={allEvents} />
            </div>
          </div>

          {/* Done: asset preview summary strip */}
          {isDone && assets && assets.length > 0 && (
            <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Assets generated
                </p>
                <span className="text-xs text-slate-500">{assets.length} assets</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {assets.slice(0, 6).map((a, i) => (
                  <div
                    key={a.id ?? i}
                    className="shrink-0 h-14 w-14 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center"
                  >
                    <span className="text-xs text-slate-400 font-mono">
                      {(a as Record<string, unknown>).format as string ?? "ad"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Zone 3: Right panel (240px) ── */}
        <div className="w-60 shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden">

          {/* HITL review */}
          {isHitl && hitlData && (
            <div className="flex-1 overflow-auto">
              <ReviewPanel
                hitlData={hitlData}
                campaignId={campaignId}
                onResume={handleResume}
                isResuming={resumeCampaign.isPending}
              />
            </div>
          )}

          {/* Failed state */}
          {isFailed && (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 p-5 text-center">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(239,68,68,0.1)" }}
              >
                <span className="text-red-500 text-xl">✕</span>
              </div>
              <div>
                <p className="font-bold text-red-600 text-sm">Pipeline failed</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {campaign?.error ?? "An unexpected error occurred"}
                </p>
                {campaign?.failed_node && (
                  <p className="text-[10px] text-slate-400 mt-2 font-mono bg-slate-50 rounded px-2 py-1">
                    at {campaign.failed_node}
                  </p>
                )}
              </div>
              {campaign?.resumable ? (
                <button
                  onClick={handleRetry}
                  disabled={retryCampaign.isPending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                >
                  <RotateCw
                    className={cn("h-4 w-4", retryCampaign.isPending && "animate-spin")}
                  />
                  {retryCampaign.isPending ? "Retrying…" : "Retry"}
                </button>
              ) : (
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  This failure isn&apos;t retryable — please launch a new campaign.
                </p>
              )}
            </div>
          )}

          {/* Done: audit score + assets */}
          {isDone && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {campaign?.audit_score !== null && campaign?.audit_score !== undefined && (
                <div className="px-5 py-4 border-b border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                    Audit Score
                  </p>
                  <div className="flex items-end gap-2">
                    <span
                      className="text-4xl font-black font-mono leading-none"
                      style={{ color: campaign.audit_score >= 80 ? "#22c55e" : campaign.audit_score >= 60 ? "#f59e0b" : "#ef4444" }}
                    >
                      {campaign.audit_score.toFixed(0)}
                    </span>
                    <span className="text-sm text-slate-400 mb-1">/100</span>
                  </div>
                  <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${campaign.audit_score}%`,
                        background:
                          campaign.audit_score >= 80
                            ? "linear-gradient(90deg,#22c55e,#16a34a)"
                            : campaign.audit_score >= 60
                            ? "linear-gradient(90deg,#f59e0b,#d97706)"
                            : "linear-gradient(90deg,#ef4444,#dc2626)",
                      }}
                    />
                  </div>
                </div>
              )}

              {assets && assets.length > 0 && (
                <div className="flex-1 overflow-auto p-4">
                  <AssetGallery assets={assets} auditScore={campaign?.audit_score} />
                </div>
              )}
            </div>
          )}

          {/* Running: live tool log */}
          {isRunning && !isHitl && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="px-4 pt-4 pb-2 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Tool Calls
                </p>
              </div>
              <div className="flex-1 overflow-auto p-3 space-y-1.5">
                {allEvents
                  .filter((e) => e.event_type === "tool_call" || e.event_type === "tool_result")
                  .slice(-12)
                  .map((e, i) => {
                    const isCall = e.event_type === "tool_call";
                    return (
                      <div
                        key={e.id ?? i}
                        className="px-2.5 py-1.5 rounded-lg text-xs"
                        style={{
                          background: isCall ? "rgba(99,102,241,0.06)" : "rgba(34,197,94,0.06)",
                        }}
                      >
                        <p
                          className="font-semibold truncate"
                          style={{ color: isCall ? "#6366f1" : "#22c55e" }}
                        >
                          {isCall ? "→" : "←"} {e.payload?.tool as string ?? "tool"}
                        </p>
                        {typeof e.payload?.result_summary === "string" && (
                          <p className="text-slate-400 truncate mt-0.5">
                            {(e.payload.result_summary as string).slice(0, 60)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                {allEvents.filter((e) => e.event_type === "tool_call").length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400">
                    <div className="flex gap-1">
                      {[0, 150, 300].map((d) => (
                        <div
                          key={d}
                          className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-pulse"
                          style={{ animationDelay: `${d}ms` }}
                        />
                      ))}
                    </div>
                    <p className="text-xs">Waiting for tools…</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
