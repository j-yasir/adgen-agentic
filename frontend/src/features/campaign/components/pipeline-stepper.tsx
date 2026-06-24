"use client";

import { cn } from "@/shared/lib/utils";
import { Check, FlaskConical, Lightbulb, Palette, Shield, Loader2 } from "lucide-react";
import type { PipelineStage } from "../types";

const STAGES = [
  { key: "researcher", label: "Research", icon: FlaskConical },
  { key: "strategist", label: "Strategy", icon: Lightbulb },
  { key: "producer", label: "Production", icon: Palette },
  { key: "auditor", label: "Audit", icon: Shield },
] as const;

const STAGE_ORDER: Record<string, number> = {
  pending: -1,
  researcher: 0,
  strategist: 1,
  producer: 2,
  auditor: 3,
  awaiting_review: -1,
  completed: 4,
  failed: -1,
};

export function PipelineStepper({
  stage,
  currentAgent,
}: {
  stage: PipelineStage;
  currentAgent: string | null;
}) {
  const activeIndex = currentAgent
    ? STAGE_ORDER[currentAgent] ?? -1
    : STAGE_ORDER[stage] ?? -1;

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {STAGES.map((s, i) => {
        const isCompleted = activeIndex > i || stage === "completed";
        const isActive = currentAgent === s.key;
        const isAwaiting = stage === "awaiting_review" && activeIndex === -1 && i === STAGES.findIndex((st) => STAGE_ORDER[st.key] >= 0 && currentAgent === null);
        const Icon = s.icon;

        return (
          <div key={s.key} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-8 lg:w-16 transition-colors",
                  isCompleted ? "bg-green-500" : "bg-border/50"
                )}
              />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                  isCompleted && "border-green-500 bg-green-500/10 text-green-400",
                  isActive && "border-indigo-500 bg-indigo-500/10 text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.3)] animate-pulse",
                  isAwaiting && "border-amber-500 bg-amber-500/10 text-amber-400",
                  !isCompleted && !isActive && !isAwaiting && "border-border/50 text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  isCompleted && "text-green-400",
                  isActive && "text-indigo-400",
                  isAwaiting && "text-amber-400",
                  !isCompleted && !isActive && !isAwaiting && "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </div>
          </div>
        );
      })}

      <div className="h-px w-8 lg:w-16 bg-border/50" />
      <div className="flex flex-col items-center gap-1.5">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
            stage === "completed" && "border-green-500 bg-green-500/10 text-green-400",
            stage === "failed" && "border-red-500 bg-red-500/10 text-red-400",
            stage !== "completed" && stage !== "failed" && "border-border/50 text-muted-foreground"
          )}
        >
          {stage === "completed" ? (
            <Check className="h-4 w-4" />
          ) : (
            <span className="text-xs font-bold">✓</span>
          )}
        </div>
        <span
          className={cn(
            "text-xs font-medium",
            stage === "completed" ? "text-green-400" : "text-muted-foreground"
          )}
        >
          Done
        </span>
      </div>
    </div>
  );
}
