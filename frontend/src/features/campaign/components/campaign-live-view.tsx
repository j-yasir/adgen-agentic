"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, Clock, RotateCw, Loader2, PauseCircle, Sparkles,
  FlaskConical, Lightbulb, Palette, Shield, Check,
  ThumbsUp, ThumbsDown, Download, Image as ImageIcon, Video, Mail, FileText, Maximize2,
  ChevronDown, ChevronUp, Monitor, Smartphone,
} from "lucide-react";
import { cn, toAssetUrl } from "@/shared/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCampaignStream } from "../hooks/use-campaign-stream";
import { useCampaign, useCampaignAssets, useResumeCampaign, useRetryCampaign } from "../hooks/use-campaigns";
import { AgentCanvas } from "./agent-canvas";
import { ActivityFeed } from "./activity-feed";
import { ResearchReview } from "./hitl/research-review";
import { StrategyReview } from "./hitl/strategy-review";
import { AssetReview } from "./hitl/asset-review";
import { campaignApi } from "../lib/api";
import type { CampaignEvent, PipelineStage, AssetResponse } from "../types";

// ─── Types & constants ────────────────────────────────────────────────────────

type AgentKey = "researcher" | "strategist" | "producer" | "auditor";

const AGENTS: { key: AgentKey; label: string; color: string; Icon: typeof FlaskConical; phase: string }[] = [
  { key: "researcher", label: "Researcher", color: "#6366f1", Icon: FlaskConical, phase: "Research Report" },
  { key: "strategist", label: "Strategist",  color: "#8b5cf6", Icon: Lightbulb,   phase: "Strategy Plan" },
  { key: "producer",   label: "Producer",    color: "#ec4899", Icon: Palette,     phase: "Generated Assets" },
  { key: "auditor",    label: "Auditor",     color: "#22c55e", Icon: Shield,      phase: "Audit Results" },
];

const HITL_AGENT: Record<string, AgentKey> = {
  research_review: "researcher",
  plan_approval:   "strategist",
  asset_review:    "producer",
  asset_approval:  "producer",
};

const FORMAT_ICONS: Record<string, typeof ImageIcon> = {
  image: ImageIcon, static_image: ImageIcon,
  video: Video, video_ad: Video,
  email: Mail, document: FileText,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function derivePipelineStage(status: string): PipelineStage {
  switch (status) {
    case "done": return "completed";
    case "failed": return "failed";
    case "awaiting_review": return "awaiting_review";
    default: return "pending";
  }
}

function deriveFromEvents(events: CampaignEvent[]) {
  let currentAgent: string | null = null;
  let hitlData: Record<string, unknown> | null = null;
  let pipelineStage: PipelineStage = "pending";
  const completedAgents = new Set<string>();
  const phaseData: Partial<Record<AgentKey, Record<string, unknown>>> = {};

  for (const e of events) {
    switch (e.event_type) {
      case "agent_started":
        if (e.agent && e.agent !== "orchestrator") {
          currentAgent = e.agent;
          pipelineStage = e.agent as PipelineStage;
        }
        hitlData = null;
        break;
      case "agent_completed":
        if (e.agent) completedAgents.add(e.agent);
        currentAgent = null;
        break;
      case "hitl_required":
        hitlData = e.payload;
        pipelineStage = "awaiting_review";
        currentAgent = null;
        // Store the data for later read-only viewing
        if (typeof e.payload?.checkpoint === "string") {
          const agentKey = HITL_AGENT[e.payload.checkpoint];
          if (agentKey && e.payload.data) {
            const raw = e.payload.data;
            phaseData[agentKey] = typeof raw === "string"
              ? tryParse(raw)
              : raw as Record<string, unknown>;
          }
        }
        break;
      case "campaign_done":
        pipelineStage = "completed";
        currentAgent = null;
        hitlData = null;
        break;
      case "campaign_failed":
        pipelineStage = "failed";
        currentAgent = null;
        break;
    }
  }

  return { currentAgent, hitlData, pipelineStage, completedAgents, phaseData };
}

function tryParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return { raw_text: s }; }
}

function isImageAsset(assetType: string, format: string) {
  if (assetType === "image" || assetType === "static_image") return true;
  if (format === "image" || format === "static_image") return true;
  // format is sometimes an aspect ratio string like "4:5" — still an image
  if (/^\d+:\d+$/.test(format)) return assetType !== "video" && assetType !== "voice";
  return false;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Running agent spotlight shown while the pipeline is actively processing */
function AgentSpotlight({
  agentKey,
  color,
  events,
}: {
  agentKey: AgentKey;
  color: string;
  events: CampaignEvent[];
}) {
  const cfg = AGENTS.find((a) => a.key === agentKey)!;

  const toolEvents = events.filter(
    (e) => e.agent === agentKey && (e.event_type === "tool_call" || e.event_type === "tool_result")
  );
  const recent = toolEvents.slice(-6);
  const current = recent[recent.length - 1] ?? null;
  const history = recent.slice(0, -1);

  const currentMsg =
    current && typeof current.payload?.message === "string"
      ? current.payload.message
      : current
      ? `${current.event_type === "tool_call" ? "Running" : "Done"}: ${String(current.payload?.tool ?? "tool").replace(/_/g, " ")}`
      : null;

  const agentMeta = {
    researcher: { verb: "Researching", hint: "Searching the web, reading competitor pages, and capturing platform trends" },
    strategist: { verb: "Strategising", hint: "Building your distribution plan, hooks, and per-asset copy briefs" },
    producer:   { verb: "Producing", hint: "Planning visuals, generating images, and rendering email templates" },
    auditor:    { verb: "Auditing", hint: "Scoring each asset for brand fit, hook strength, and compliance" },
  }[agentKey];

  return (
    <div className="flex flex-col items-center justify-start flex-1 gap-5 py-8 px-6 overflow-y-auto">

      {/* Top: avatar + label */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="relative rounded-3xl p-3"
          style={{ background: color + "12", border: `2px solid ${color}28` }}
        >
          <AgentCanvas agent={agentKey} size={96} active />
          {/* Outer pulse ring */}
          <span
            className="absolute inset-0 rounded-3xl animate-ping opacity-[0.12]"
            style={{ background: color }}
          />
        </div>

        <div className="text-center space-y-1">
          <div
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full"
            style={{ background: color + "15", color }}
          >
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: color }} />
            {agentMeta.verb}
          </div>
          <h2 className="text-xl font-bold text-slate-900">{cfg.label}</h2>
          <p className="text-xs text-slate-400 max-w-[260px] leading-relaxed">{agentMeta.hint}</p>
        </div>
      </div>

      {/* Current action — large focus card */}
      <div
        className="w-full max-w-sm rounded-2xl border p-4"
        style={{ background: color + "06", borderColor: color + "20" }}
      >
        {currentMsg ? (
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 relative">
              {current?.event_type === "tool_call" ? (
                <>
                  <span
                    className="block h-3 w-3 rounded-full"
                    style={{ background: color }}
                  />
                  <span
                    className="absolute inset-0 h-3 w-3 rounded-full animate-ping"
                    style={{ background: color, opacity: 0.4 }}
                  />
                </>
              ) : (
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5.5" stroke={color} strokeWidth="1" fill={color + "20"} />
                  <path d="M3 6l2.5 2.5 3.5-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <p className="text-sm font-medium text-slate-800 leading-snug flex-1">{currentMsg}</p>
            {current?.event_type === "tool_call" && (
              <span className="text-[10px] font-semibold shrink-0 mt-0.5" style={{ color }}>in progress</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex gap-1">
              {[0, 100, 200].map((d) => (
                <span
                  key={d}
                  className="h-2 w-2 rounded-full animate-bounce"
                  style={{ background: color, opacity: 0.6, animationDelay: `${d}ms`, animationDuration: "1s" }}
                />
              ))}
            </div>
            <span className="text-xs text-slate-400">Starting up…</span>
          </div>
        )}
      </div>

      {/* History log — completed steps above current */}
      {history.length > 0 && (
        <div className="w-full max-w-sm space-y-1">
          {history.map((e) => {
            const msg =
              typeof e.payload?.message === "string"
                ? e.payload.message
                : `${e.event_type === "tool_call" ? "Running" : "Done"}: ${String(e.payload?.tool ?? "").replace(/_/g, " ")}`;
            const isDone = e.event_type === "tool_result";
            return (
              <div key={e.seq ?? e.id ?? msg} className="flex items-center gap-2 py-1">
                {isDone ? (
                  <svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-slate-300" />
                )}
                <p className="text-[11px] text-slate-400 leading-snug truncate">{msg}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Email full-view in the modal — iframe + desktop/mobile toggle */
function EmailModalPreview({
  url,
  metadata,
}: {
  url: string;
  metadata?: Record<string, unknown>;
}) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [frameHeight, setFrameHeight] = useState(520);
  const frameWidth = viewport === "desktop" ? 600 : 375;

  return (
    <div>
      {/* Inbox-style chrome */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 bg-white">
        <div className="flex-1 min-w-0">
          {typeof metadata?.sender_name === "string" && (
            <p className="text-xs text-slate-400">{metadata.sender_name}</p>
          )}
          {typeof metadata?.subject_line === "string" && (
            <p className="text-sm font-semibold text-slate-800 truncate">{metadata.subject_line}</p>
          )}
          {typeof metadata?.preview_text === "string" && (
            <p className="text-xs text-slate-400 truncate">{metadata.preview_text}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setViewport("desktop")}
            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
              viewport === "desktop" ? "bg-indigo-50 text-indigo-600" : "text-slate-300 hover:text-slate-500"
            }`}
          >
            <Monitor className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewport("mobile")}
            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
              viewport === "mobile" ? "bg-indigo-50 text-indigo-600" : "text-slate-300 hover:text-slate-500"
            }`}
          >
            <Smartphone className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Iframe container — centered, scrollable if tall */}
      <div className="flex justify-center bg-slate-100 py-6 overflow-x-auto" style={{ minHeight: 400 }}>
        <iframe
          src={url}
          sandbox="allow-same-origin"
          title="Email preview"
          style={{
            width: frameWidth,
            height: frameHeight,
            border: "none",
            background: "#ffffff",
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            borderRadius: 4,
            display: "block",
            flexShrink: 0,
          }}
          onLoad={(e) => {
            try {
              const doc = e.currentTarget.contentDocument;
              if (doc?.body) setFrameHeight(doc.body.scrollHeight + 32);
            } catch {
              // cross-origin — keep default height
            }
          }}
        />
      </div>
    </div>
  );
}

/** Audit results shown when campaign is done */
function AuditorOutput({ score, assets }: { score: number | null | undefined; assets: AssetResponse[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const stored = assets.filter((a) => a.status === "stored");
  const scoreColor = score == null ? "#94a3b8" : score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="p-6 space-y-6">
      {/* Score hero */}
      <div className="flex items-center gap-6 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative h-24 w-24 shrink-0">
          <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="12" />
            {score != null && (
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke={scoreColor}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - score / 100)}`}
                style={{ transition: "stroke-dashoffset 1s ease" }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black font-mono leading-none" style={{ color: scoreColor }}>
              {score?.toFixed(0) ?? "—"}
            </span>
            <span className="text-xs text-slate-400">/100</span>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Audit Score</p>
          <p className="text-2xl font-bold text-slate-900">
            {score == null ? "Pending" : score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Needs Work"}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {stored.length} asset{stored.length !== 1 ? "s" : ""} ready · audited by AI quality checks
          </p>
        </div>
      </div>

      {/* Asset list */}
      {stored.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Produced Assets</p>
          <div className="space-y-2">
            {stored.map((asset) => {
              const imgUrl = toAssetUrl(asset.storage_url);
              const showImg = isImageAsset(asset.asset_type, asset.format) && !!imgUrl;
              const isOpen = expanded === asset.id;

              return (
                <div key={asset.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : asset.id)}
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    {/* Thumbnail */}
                    <div className="h-14 w-14 rounded-lg shrink-0 overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center">
                      {showImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imgUrl!} alt={asset.format} className="h-full w-full object-cover" />
                      ) : (
                        (() => {
                          const Icon = FORMAT_ICONS[asset.format] ?? FORMAT_ICONS[asset.asset_type] ?? FileText;
                          return <Icon className="h-6 w-6 text-slate-300" />;
                        })()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-800 capitalize">
                        {asset.format.replace(/_/g, " ")} · {asset.platform}
                      </p>
                      <p className="text-xs text-slate-400 capitalize mt-0.5">
                        {asset.asset_type.replace(/_/g, " ")}
                      </p>
                    </div>
                    {imgUrl && (
                      <a
                        href={imgUrl}
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-300 hover:text-indigo-500 transition-colors p-1.5"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                    {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100">
                      {showImg && (
                        <div className="bg-slate-50 flex items-center justify-center p-4">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imgUrl!}
                            alt={asset.format}
                            className="max-h-[60vh] max-w-full rounded-xl shadow-sm object-contain"
                          />
                        </div>
                      )}
                      {asset.prompt_used && (
                        <div className="px-4 py-3 space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prompt Used</p>
                          <p className="text-xs text-slate-600 leading-relaxed">{asset.prompt_used}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Producer output shown when producer is complete (before audit) */
function ProducerOutput({ assets }: { assets: AssetResponse[] }) {
  const [modal, setModal] = useState<AssetResponse | null>(null);
  const stored = assets.filter((a) => a.status === "stored");

  if (stored.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
        <Palette className="h-10 w-10 text-slate-200" />
        <p className="text-sm">Assets will appear here once generated</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Generated Assets <span className="text-slate-300 ml-2">({stored.length})</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {stored.map((asset) => {
          const imgUrl = toAssetUrl(asset.storage_url);
          const showImg = isImageAsset(asset.asset_type, asset.format) && !!imgUrl;
          const Icon = FORMAT_ICONS[asset.format] ?? FORMAT_ICONS[asset.asset_type] ?? FileText;

          return (
            <button
              key={asset.id}
              type="button"
              onClick={() => setModal(asset)}
              className="group text-left bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-md transition-all"
            >
              <div className="relative overflow-hidden" style={{ height: 140 }}>
                {showImg ? (
                  <div className="h-full w-full" style={{ background: "#f8fafc" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgUrl!} alt={asset.format} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                ) : asset.asset_type === "email" ? (
                  <div className="h-full w-full flex flex-col" style={{ background: "#f0f2f5" }}>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 shrink-0" style={{ background: "#e2e5ea" }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: "#ff5f57" }} />
                      <span className="h-2 w-2 rounded-full" style={{ background: "#febc2e" }} />
                      <span className="h-2 w-2 rounded-full" style={{ background: "#28c840" }} />
                      {asset.metadata?.sender_name && (
                        <span className="text-[9px] text-slate-500 ml-1 truncate">{asset.metadata.sender_name}</span>
                      )}
                    </div>
                    <div className="flex-1 bg-white px-2.5 py-2 space-y-1 overflow-hidden">
                      <p className="text-[11px] font-bold text-slate-800 leading-tight line-clamp-2">
                        {asset.metadata?.subject_line ?? "Email Campaign"}
                      </p>
                      {asset.metadata?.preview_text && (
                        <p className="text-[9px] text-slate-400 leading-snug line-clamp-2">
                          {asset.metadata.preview_text}
                        </p>
                      )}
                      <div className="pt-1 space-y-1">
                        <div className="h-1.5 rounded bg-slate-100 w-full" />
                        <div className="h-1.5 rounded bg-slate-100 w-4/5" />
                        <div className="h-1.5 rounded bg-slate-100 w-3/5" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full w-full flex items-center justify-center" style={{ background: "#f8fafc" }}>
                    <Icon className="h-10 w-10 text-slate-200" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Maximize2 className="h-6 w-6 text-white drop-shadow" />
                </div>
                <span className="absolute top-2 left-2 text-[10px] font-bold bg-white/90 px-1.5 py-0.5 rounded-md text-slate-600 capitalize">
                  {asset.platform}
                </span>
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold text-slate-700 capitalize truncate">{asset.format.replace(/_/g, " ")}</p>
                <p className="text-[10px] text-slate-400 capitalize mt-0.5">{asset.asset_type.replace(/_/g, " ")}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Lightbox */}
      {modal && (() => {
        const assetUrl = toAssetUrl(modal.storage_url);
        const showImg = isImageAsset(modal.asset_type, modal.format) && !!assetUrl;
        const isEmail = modal.asset_type === "email";
        const Icon = FORMAT_ICONS[modal.format] ?? FORMAT_ICONS[modal.asset_type] ?? FileText;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm"
            onClick={() => setModal(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              style={{ width: "100%", maxWidth: isEmail ? 700 : 640, maxHeight: "90vh" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
                <div>
                  <p className="font-bold text-slate-800 capitalize">
                    {isEmail && modal.metadata?.subject_line
                      ? modal.metadata.subject_line
                      : `${modal.format.replace(/_/g, " ")} · ${modal.platform}`}
                  </p>
                  {isEmail && modal.metadata?.preview_text && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate max-w-sm">{modal.metadata.preview_text}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {assetUrl && (
                    <a href={assetUrl} download className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                      <Download className="h-3.5 w-3.5" /> Download
                    </a>
                  )}
                  <button onClick={() => setModal(null)} className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 ml-1">
                    <span className="text-slate-400 text-sm">✕</span>
                  </button>
                </div>
              </div>

              {/* Modal body */}
              <div className="flex-1 overflow-auto">
                {isEmail && assetUrl ? (
                  <EmailModalPreview url={assetUrl} metadata={modal.metadata} />
                ) : showImg ? (
                  <div className="bg-slate-50 flex items-center justify-center p-4" style={{ minHeight: 300 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assetUrl!} alt={modal.format} className="max-h-[65vh] w-full object-contain rounded-xl" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-16 text-slate-300">
                    <Icon className="h-16 w-16" />
                    <p className="text-sm">Preview unavailable</p>
                  </div>
                )}
              </div>

              {!isEmail && modal.prompt_used && (
                <div className="px-5 py-4 border-t border-slate-100 shrink-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Prompt</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{modal.prompt_used}</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CampaignLiveView({ campaignId }: { campaignId: string }) {
  const { data: campaign, refetch: refetchCampaign } = useCampaign(campaignId);
  const { data: assets = [], refetch: refetchAssets } = useCampaignAssets(campaignId);
  const resumeCampaign = useResumeCampaign();
  const retryCampaign = useRetryCampaign();

  const { data: restEvents } = useQuery({
    queryKey: ["campaign-events", campaignId],
    queryFn: () => campaignApi.getEvents(campaignId),
    enabled: !!campaignId,
  });

  const {
    events: streamEvents,
    hitlData: streamHitl,
    clearHitl,
    forceConnect,
  } = useCampaignStream(campaignId, campaign?.status);

  const allEvents = streamEvents.length > 0 ? streamEvents : (restEvents ?? []);

  // Derive all state from events (single source of truth)
  const derived = deriveFromEvents(allEvents);
  const pipelineStage =
    streamEvents.length > 0
      ? derived.pipelineStage
      : (derived.pipelineStage !== "pending" ? derived.pipelineStage : derivePipelineStage(campaign?.status ?? "pending"));
  const currentAgent = derived.currentAgent as AgentKey | null;
  const hitlData = streamEvents.length > 0 ? streamHitl : (campaign?.status === "awaiting_review" ? derived.hitlData : null);
  const completedAgents = derived.completedAgents;
  const phaseData = derived.phaseData;

  // Also pick up strategy from campaign.strategy_doc if not in events
  if (campaign?.strategy_doc && !phaseData.strategist) {
    phaseData.strategist = campaign.strategy_doc as Record<string, unknown>;
  }

  const isDone = pipelineStage === "completed";
  const isFailed = pipelineStage === "failed";
  const isHitl = !!hitlData;
  const isRunning = !isDone && !isFailed && !isHitl && !!currentAgent;

  // Active tab — auto-follow the pipeline
  const [activeTab, setActiveTab] = useState<AgentKey>("researcher");
  useEffect(() => {
    if (currentAgent) setActiveTab(currentAgent as AgentKey);
  }, [currentAgent]);
  useEffect(() => {
    if (isHitl && hitlData) {
      const checkpoint = hitlData.checkpoint as string ?? hitlData.interrupt_type as string ?? "";
      const agent = HITL_AGENT[checkpoint];
      if (agent) setActiveTab(agent);
    }
  }, [isHitl, hitlData]);
  useEffect(() => {
    if (isDone) setActiveTab("auditor");
  }, [isDone]);

  // Timer
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!campaign?.created_at || isDone || isFailed) return;
    const start = new Date(campaign.created_at).getTime();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [campaign?.created_at, isDone, isFailed]);

  useEffect(() => {
    if (isDone) refetchAssets();
  }, [isDone, refetchAssets]);


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
      refetchCampaign();
      // If the SSE connection dropped while in failed state, kick it open again.
      forceConnect();
      toast.success("Retrying from last checkpoint");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    }
  }

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const activeAgentCfg = AGENTS.find((a) => a.key === activeTab);
  const hitlCheckpoint = hitlData ? ((hitlData.checkpoint as string) ?? (hitlData.interrupt_type as string) ?? "") : "";

  // Refetch assets when the asset review HITL fires so thumbnails are fresh.
  useEffect(() => {
    if (isHitl && (hitlCheckpoint === "asset_review" || hitlCheckpoint === "asset_approval")) {
      refetchAssets();
    }
  }, [isHitl, hitlCheckpoint, refetchAssets]);
  const hitlParsedData = hitlData?.data
    ? (typeof hitlData.data === "string" ? tryParse(hitlData.data) : hitlData.data as Record<string, unknown>)
    : {};

  return (
    <div className="flex h-full flex-col bg-slate-50">

      {/* ── Header ── */}
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
              <p className="text-xs text-slate-400">{campaign.platforms.join(", ")} · {campaign.objective}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isDone && !isFailed && (
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
              isRunning && "text-indigo-600",
              !isDone && !isFailed && !isHitl && !isRunning && "text-slate-400"
            )}
            style={{
              background: isDone ? "rgba(34,197,94,0.1)"
                : isFailed ? "rgba(239,68,68,0.1)"
                : isHitl ? "rgba(245,158,11,0.1)"
                : "rgba(99,102,241,0.1)",
            }}
          >
            {isDone ? "Done" : isFailed ? "Failed" : isHitl ? "Review Required" : isRunning ? "Running" : "Pending"}
          </span>
        </div>
      </div>

      {/* ── 3-zone body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Zone 1: Pipeline sidebar ── */}
        <div className="w-[180px] shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pipeline</p>
          </div>
          <div className="flex flex-col gap-1 px-2 flex-1">
            {AGENTS.map((agent) => {
              const isActive = currentAgent === agent.key;
              const isDoneAgent = completedAgents.has(agent.key) || isDone;
              const isHitlAt = isHitl && HITL_AGENT[hitlCheckpoint] === agent.key;
              const isSelected = activeTab === agent.key;

              return (
                <button
                  key={agent.key}
                  type="button"
                  onClick={() => setActiveTab(agent.key)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left",
                    !isActive && !isDoneAgent && !isHitlAt && "opacity-35"
                  )}
                  style={
                    isSelected && !isActive
                      ? { background: agent.color + "0a", border: `1px solid ${agent.color}20` }
                      : isActive
                      ? { background: agent.color + "12", border: `1px solid ${agent.color}30` }
                      : isDoneAgent
                      ? { background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)" }
                      : { background: "transparent", border: "1px solid transparent" }
                  }
                >
                  <div className="relative shrink-0 h-8 w-8">
                    {isDoneAgent ? (
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(34,197,94,0.12)" }}>
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      </div>
                    ) : (
                      <>
                        <div className="rounded-lg overflow-hidden h-8 w-8">
                          <AgentCanvas agent={agent.key} size={32} active={isActive} />
                        </div>
                        {isActive && (
                          <span className="absolute inset-0 rounded-lg animate-ping opacity-20" style={{ background: agent.color }} />
                        )}
                        {isHitlAt && (
                          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 border-2 border-white" />
                        )}
                      </>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold truncate" style={{ color: isActive ? agent.color : isDoneAgent ? "#22c55e" : "#94a3b8" }}>
                      {agent.label}
                    </p>
                    <p className="text-[9px] text-slate-400">
                      {isActive ? "Running…" : isDoneAgent ? "Complete" : isHitlAt ? "Review" : "Queued"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pipeline status footer */}
          <div className="px-3 py-3 border-t border-slate-100">
            <div
              className={cn("flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl",
                isDone && "text-emerald-600", isFailed && "text-red-500",
                isHitl && "text-amber-500", !isDone && !isFailed && !isHitl && "text-slate-400"
              )}
              style={{
                background: isDone ? "rgba(34,197,94,0.08)" : isFailed ? "rgba(239,68,68,0.08)"
                  : isHitl ? "rgba(245,158,11,0.08)" : "rgba(148,163,184,0.08)",
              }}
            >
              {isDone ? <><Sparkles className="h-3 w-3" /> Campaign done</>
                : isFailed ? <><span>✕</span> Failed</>
                : isHitl ? <><PauseCircle className="h-3 w-3" /> Review</>
                : isRunning ? <><Loader2 className="h-3 w-3 animate-spin" /> Processing</>
                : <><span className="h-2 w-2 rounded-full bg-slate-300" /> Pending</>}
            </div>
          </div>
        </div>

        {/* ── Zone 2: Center — phase outputs ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Phase tab bar */}
          <div className="flex items-center border-b border-slate-200 bg-white shrink-0 px-2">
            {AGENTS.map((agent) => {
              const isDoneAgent = completedAgents.has(agent.key) || isDone;
              const isActive = currentAgent === agent.key;
              const isSelected = activeTab === agent.key;
              const isHitlAt = isHitl && HITL_AGENT[hitlCheckpoint] === agent.key;
              const hasContent = isDoneAgent || isActive || isHitlAt;

              return (
                <button
                  key={agent.key}
                  type="button"
                  onClick={() => hasContent && setActiveTab(agent.key)}
                  disabled={!hasContent}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-all -mb-px",
                    isSelected
                      ? "border-current"
                      : "border-transparent text-slate-400 hover:text-slate-600",
                    !hasContent && "opacity-30 cursor-default"
                  )}
                  style={isSelected ? { color: agent.color, borderColor: agent.color } : {}}
                >
                  {isDoneAgent ? (
                    <Check className="h-3 w-3" style={{ color: isSelected ? agent.color : "#22c55e" }} />
                  ) : isActive || isHitlAt ? (
                    <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: isHitlAt ? "#f59e0b" : agent.color }} />
                  ) : null}
                  {agent.label}
                  {isHitlAt && (
                    <span className="ml-1 text-[9px] font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-full">
                      Review
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── HITL takes over center ── */}
          {isHitl && hitlData && HITL_AGENT[hitlCheckpoint] === activeTab && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Amber banner */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-amber-200 shrink-0" style={{ background: "rgba(245,158,11,0.06)" }}>
                <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(245,158,11,0.12)" }}>
                  <PauseCircle className="h-4 w-4 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-700 text-sm">Human review required — pipeline paused</p>
                  <p className="text-xs text-amber-500 mt-0.5">Review the output below, then approve or reject to continue</p>
                </div>
              </div>

              {/* Review content */}
              <div className="flex-1 overflow-hidden">
                {hitlCheckpoint === "research_review" && (
                  <ResearchReview data={hitlParsedData} onResume={handleResume} isResuming={resumeCampaign.isPending} />
                )}
                {(hitlCheckpoint === "plan_approval") && (
                  <StrategyReview data={hitlParsedData} onResume={handleResume} isResuming={resumeCampaign.isPending} />
                )}
                {(hitlCheckpoint === "asset_review" || hitlCheckpoint === "asset_approval") && (
                  <AssetReview data={hitlParsedData} campaignId={campaignId} assets={assets} onResume={handleResume} isResuming={resumeCampaign.isPending} />
                )}
              </div>
            </div>
          )}

          {/* ── Active agent spotlight (running, not HITL) ── */}
          {isRunning && currentAgent === activeTab && !isHitl && (
            <div className="flex-1 overflow-auto">
              <AgentSpotlight
                agentKey={currentAgent}
                color={activeAgentCfg?.color ?? "#6366f1"}
                events={allEvents}
              />
            </div>
          )}

          {/* ── Phase output: completed phases ── */}
          {!isHitl && !(isRunning && currentAgent === activeTab) && (
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                {activeTab === "researcher" && (completedAgents.has("researcher") || isDone) && phaseData.researcher && (
                  <ResearchReview data={phaseData.researcher} onResume={handleResume} isResuming={false} readonly />
                )}
                {activeTab === "strategist" && (completedAgents.has("strategist") || isDone) && phaseData.strategist && (
                  <StrategyReview data={phaseData.strategist} onResume={handleResume} isResuming={false} readonly />
                )}
                {activeTab === "producer" && (completedAgents.has("producer") || isDone) && (
                  <ProducerOutput assets={assets} />
                )}
                {activeTab === "auditor" && isDone && (
                  <AuditorOutput score={campaign?.audit_score} assets={assets} />
                )}

                {/* Empty state for a tab with no data yet */}
                {(() => {
                  const isDoneAgent = completedAgents.has(activeTab) || isDone;
                  const hasData =
                    (activeTab === "researcher" && phaseData.researcher) ||
                    (activeTab === "strategist" && phaseData.strategist) ||
                    (activeTab === "producer" && assets.length > 0) ||
                    (activeTab === "auditor" && isDone);
                  if (isDoneAgent && !hasData) {
                    return (
                      <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
                        {activeAgentCfg && <activeAgentCfg.Icon className="h-10 w-10 text-slate-200" />}
                        <p className="text-sm">Output not yet available</p>
                      </div>
                    );
                  }
                  if (!isDoneAgent && !isRunning) {
                    return (
                      <div className="flex flex-col items-center justify-center py-24 text-slate-300 gap-3">
                        {activeAgentCfg && <activeAgentCfg.Icon className="h-10 w-10 text-slate-200" />}
                        <p className="text-sm text-slate-400">Waiting to start</p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </ScrollArea>
            </div>
          )}

          {/* Failed state in center */}
          {isFailed && (
            <div className="flex flex-col items-center justify-center flex-1 gap-5 p-8 text-center">
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)" }}>
                <span className="text-red-500 text-3xl">✕</span>
              </div>
              <div>
                <p className="font-bold text-red-600 text-lg">Pipeline failed</p>
                <p className="text-sm text-slate-500 mt-1 max-w-sm leading-relaxed">
                  {campaign?.error ?? "An unexpected error occurred during pipeline execution."}
                </p>
                {campaign?.failed_node && (
                  <p className="text-xs text-slate-400 mt-3 font-mono bg-slate-100 rounded-lg px-3 py-2 inline-block">
                    Failed at: {campaign.failed_node}
                  </p>
                )}
              </div>
              {campaign?.resumable ? (
                <button
                  onClick={handleRetry}
                  disabled={retryCampaign.isPending}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                >
                  <RotateCw className={cn("h-4 w-4", retryCampaign.isPending && "animate-spin")} />
                  {retryCampaign.isPending ? "Retrying…" : "Retry from checkpoint"}
                </button>
              ) : (
                <p className="text-xs text-slate-400">This failure isn&apos;t retryable — please launch a new campaign.</p>
              )}
            </div>
          )}
        </div>

        {/* ── Zone 3: Right — activity feed ── */}
        <div className="w-[280px] shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Activity</p>
              {allEvents.length > 0 && (
                <span className="text-[10px] text-slate-400">{allEvents.length} events</span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <ActivityFeed events={allEvents} />
          </div>

          {/* Done: audit score summary at bottom */}
          {isDone && campaign?.audit_score != null && (
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-white">
                  <span
                    className="text-sm font-black font-mono leading-none"
                    style={{
                      color: campaign.audit_score >= 80 ? "#22c55e"
                        : campaign.audit_score >= 60 ? "#f59e0b" : "#ef4444"
                    }}
                  >
                    {campaign.audit_score.toFixed(0)}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700">Audit Score</p>
                  <p className="text-[10px] text-slate-400">{assets.filter(a => a.status === "stored").length} assets ready</p>
                </div>
                <ThumbsUp className="h-4 w-4 text-emerald-400 ml-auto" />
              </div>
            </div>
          )}

          {/* HITL approve/reject in right panel footer (secondary CTA, main is in center) */}
          {isHitl && (
            <div className="shrink-0 border-t border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Quick Decision</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleResume(false)}
                  disabled={resumeCampaign.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors"
                >
                  <ThumbsDown className="h-3 w-3" /> Reject
                </button>
                <button
                  onClick={() => handleResume(true)}
                  disabled={resumeCampaign.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
                >
                  {resumeCampaign.isPending
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <><ThumbsUp className="h-3 w-3" /> Approve</>}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
