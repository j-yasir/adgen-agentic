"use client";

import { ResearchReview } from "./research-review";
import { StrategyReview } from "./strategy-review";
import { AssetReview } from "./asset-review";

type Props = {
  hitlData: Record<string, unknown>;
  campaignId: string;
  onResume: (approved: boolean, feedback?: string) => void;
  isResuming: boolean;
};

function parseData(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return { raw_text: raw }; }
  }
  if (typeof raw === "object" && raw !== null) return raw as Record<string, unknown>;
  return {};
}

export function ReviewPanel({ hitlData, campaignId, onResume, isResuming }: Props) {
  const checkpoint = (hitlData.checkpoint as string) ?? (hitlData.interrupt_type as string) ?? "";
  const data = parseData(hitlData.data);

  switch (checkpoint) {
    case "research_review":
      return <ResearchReview data={data} onResume={onResume} isResuming={isResuming} />;
    case "plan_approval":
      return <StrategyReview data={data} onResume={onResume} isResuming={isResuming} />;
    case "asset_review":
    case "asset_approval":
      return <AssetReview data={data} campaignId={campaignId} onResume={onResume} isResuming={isResuming} />;
    default:
      return (
        <div className="space-y-4 p-4">
          <h3 className="text-lg font-semibold text-amber-400">Review Required</h3>
          <p className="text-sm text-muted-foreground">
            Checkpoint: {checkpoint || "unknown"}
          </p>
          <pre className="rounded-lg bg-muted/30 p-4 text-xs overflow-auto max-h-[400px]">
            {JSON.stringify(data, null, 2)}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={() => onResume(false, "Rejected")}
              disabled={isResuming}
              className="rounded-lg border border-border/50 px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              Reject
            </button>
            <button
              onClick={() => onResume(true)}
              disabled={isResuming}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 transition-colors"
            >
              Approve
            </button>
          </div>
        </div>
      );
  }
}
