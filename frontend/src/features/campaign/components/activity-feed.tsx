"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/shared/lib/utils";
import { formatTime } from "@/shared/lib/utils";
import {
  FlaskConical,
  Lightbulb,
  Palette,
  Shield,
  Wrench,
  CheckCircle2,
  PauseCircle,
  AlertCircle,
  Sparkles,
  Bot,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import type { CampaignEvent } from "../types";

const AGENT_CONFIG: Record<string, { icon: typeof Bot; color: string }> = {
  researcher: { icon: FlaskConical, color: "text-blue-400" },
  strategist: { icon: Lightbulb, color: "text-purple-400" },
  producer: { icon: Palette, color: "text-pink-400" },
  auditor: { icon: Shield, color: "text-amber-400" },
  orchestrator: { icon: Bot, color: "text-indigo-400" },
  system: { icon: Sparkles, color: "text-green-400" },
};

function getEventIcon(event: CampaignEvent) {
  switch (event.event_type) {
    case "agent_started": {
      const cfg = AGENT_CONFIG[event.agent ?? "orchestrator"];
      const Icon = cfg?.icon ?? Bot;
      return <Icon className={cn("h-4 w-4", cfg?.color ?? "text-muted-foreground")} />;
    }
    case "tool_call":
      return <Wrench className="h-4 w-4 text-cyan-400" />;
    case "tool_result":
      return <CheckCircle2 className="h-4 w-4 text-cyan-400" />;
    case "agent_completed": {
      const cfg = AGENT_CONFIG[event.agent ?? "system"];
      return <CheckCircle2 className={cn("h-4 w-4", cfg?.color ?? "text-green-400")} />;
    }
    case "agent_error":
      return <AlertTriangle className="h-4 w-4 text-red-400" />;
    case "hitl_required":
      return <PauseCircle className="h-4 w-4 text-amber-400" />;
    case "status_changed":
      return <ArrowRight className="h-4 w-4 text-indigo-400" />;
    case "campaign_done":
      return <Sparkles className="h-4 w-4 text-green-400" />;
    case "campaign_failed":
      return <AlertCircle className="h-4 w-4 text-red-400" />;
    default:
      return <Bot className="h-4 w-4 text-muted-foreground" />;
  }
}

function getEventMessage(event: CampaignEvent): string {
  const p = event.payload;

  if (typeof p.message === "string") return p.message;

  switch (event.event_type) {
    case "agent_started":
      return `${event.agent ?? "Agent"} started`;
    case "tool_call":
      return `${p.tool ?? "tool"}${typeof p.input === "string" ? ` — ${p.input.slice(0, 80)}` : ""}`;
    case "tool_result":
      return `${p.tool ?? "tool"} → ${typeof p.result_summary === "string" ? p.result_summary.slice(0, 80) : "done"}`;
    case "agent_completed":
      return typeof p.summary === "string"
        ? p.summary.slice(0, 100)
        : `${event.agent ?? "Agent"} completed`;
    case "agent_error":
      return typeof p.error === "string" ? p.error.slice(0, 100) : "Agent error";
    case "hitl_required":
      return typeof p.checkpoint === "string"
        ? `Review required: ${p.checkpoint.replace(/_/g, " ")}`
        : "Review required";
    case "status_changed":
      return typeof p.status === "string" ? `Status → ${p.status}` : "Status changed";
    case "campaign_done":
      return "Campaign completed successfully";
    case "campaign_failed":
      return typeof p.error === "string" ? p.error : "Campaign failed";
    default:
      return typeof p.message === "string" ? p.message : JSON.stringify(p).slice(0, 80);
  }
}

export function ActivityFeed({ events }: { events: CampaignEvent[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

  useEffect(() => {
    if (!userScrolledUp.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [events.length]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 100;
    userScrolledUp.current =
      el.scrollHeight - el.scrollTop - el.clientHeight > threshold;
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-12">
        <div className="flex gap-1">
          <div className="h-2 w-2 rounded-full bg-indigo-500/50 animate-pulse" />
          <div className="h-2 w-2 rounded-full bg-indigo-500/50 animate-pulse delay-150" />
          <div className="h-2 w-2 rounded-full bg-indigo-500/50 animate-pulse delay-300" />
        </div>
        <p className="text-sm">Waiting for pipeline to start...</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full" ref={containerRef} onScrollCapture={handleScroll}>
      <div className="space-y-1 p-3">
        {events.map((event, i) => (
          <div
            key={event.id ?? i}
            className={cn(
              "flex items-start gap-3 rounded-lg px-3 py-2 text-sm transition-all animate-in slide-in-from-bottom-1 duration-200",
              event.event_type === "hitl_required" &&
                "bg-amber-500/5 border border-amber-500/20",
              event.event_type === "campaign_done" &&
                "bg-green-500/5 border border-green-500/20",
              (event.event_type === "campaign_failed" || event.event_type === "agent_error") &&
                "bg-red-500/5 border border-red-500/20"
            )}
          >
            <div className="mt-0.5 shrink-0">{getEventIcon(event)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground/90 break-words">
                {getEventMessage(event)}
              </p>
            </div>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {formatTime(event.created_at)}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
