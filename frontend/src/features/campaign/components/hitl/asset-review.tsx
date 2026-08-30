"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, Image as ImageIcon, Video, Mail, FileText, Download, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn, toAssetUrl } from "@/shared/lib/utils";
import type { AssetResponse } from "../../types";

type Props = {
  data: Record<string, unknown>;
  campaignId: string;
  assets?: AssetResponse[];
  onResume: (approved: boolean, feedback?: string) => void;
  isResuming: boolean;
};

const FORMAT_ICONS: Record<string, typeof ImageIcon> = {
  image: ImageIcon, static_image: ImageIcon,
  video: Video, video_ad: Video,
  email: Mail,
};

function scoreColor(score: number) {
  if (score >= 8) return "#22c55e";
  if (score >= 6) return "#f59e0b";
  return "#ef4444";
}

function isImageAsset(assetType: string, format: string) {
  if (assetType === "image" || assetType === "static_image") return true;
  if (/^\d+:\d+$/.test(format)) return assetType !== "video" && assetType !== "voice";
  return false;
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px]">
      <span className="text-slate-400">{label}</span>
      <span className="font-bold font-mono" style={{ color: scoreColor(value) }}>
        {value.toFixed(1)}
      </span>
    </span>
  );
}

export function AssetReview({ data, assets = [], onResume, isResuming }: Props) {
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const auditAssets = (data.assets as Record<string, unknown>[] | undefined) ?? [];
  const avgScore = data.avg_audit_score as number | undefined;

  // Match each audit entry to a stored asset by platform + format (best-effort)
  function findAsset(audit: Record<string, unknown>): AssetResponse | undefined {
    const platform = audit.platform as string;
    const format = audit.format as string;
    const assetType = audit.asset_type as string;
    return (
      assets.find((a) => a.platform === platform && a.format === format) ??
      assets.find((a) => a.platform === platform && a.asset_type === assetType) ??
      assets.find((a) => a.asset_type === assetType)
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Asset Review</p>
          {avgScore !== undefined && (
            <div
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full"
              style={{
                background: avgScore >= 8 ? "rgba(34,197,94,0.1)" : avgScore >= 6 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)",
                color: scoreColor(avgScore),
              }}
            >
              Avg {avgScore.toFixed(1)} / 10
            </div>
          )}
        </div>

        {/* Asset cards */}
        <div className="space-y-3">
          {auditAssets.map((audit, i) => {
            const stored = findAsset(audit);
            const imgUrl = stored ? toAssetUrl(stored.storage_url) : null;
            const assetType = (audit.asset_type as string) ?? (stored?.asset_type ?? "image");
            const format = (audit.format as string) ?? (stored?.format ?? "");
            const platform = (audit.platform as string) ?? (stored?.platform ?? "");
            const showImg = isImageAsset(assetType, format) && !!imgUrl;
            const isEmail = assetType === "email";
            const Icon = FORMAT_ICONS[assetType] ?? FORMAT_ICONS[format] ?? FileText;
            const weighted = audit.weighted_avg as number | undefined;
            const isOpen = expanded === i;

            return (
              <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : i)}
                  className="w-full flex items-start gap-4 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="h-16 w-16 rounded-lg shrink-0 overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center relative">
                    {showImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgUrl!} alt={format} className="h-full w-full object-cover" />
                    ) : isEmail && imgUrl ? (
                      // Scaled iframe so the real HTML renders inside the 64×64 thumb
                      <div className="absolute inset-0 overflow-hidden">
                        <iframe
                          src={imgUrl}
                          sandbox="allow-same-origin"
                          title="Email preview"
                          style={{
                            width: 600,
                            height: 600,
                            border: "none",
                            transform: "scale(0.1067)",
                            transformOrigin: "top left",
                            pointerEvents: "none",
                          }}
                        />
                      </div>
                    ) : (
                      <Icon className="h-6 w-6 text-slate-300" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[...new Set([platform, format, assetType].filter(Boolean))].map((tag) => (
                        <span key={tag} className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md capitalize">
                          {tag.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>

                    {weighted !== undefined && (
                      <div className="flex items-center gap-3 mt-1.5">
                        {typeof audit.brand_score === "number" && <ScorePill label="Brand" value={audit.brand_score} />}
                        {typeof audit.hook_score === "number" && <ScorePill label="Hook" value={audit.hook_score} />}
                        {typeof audit.platform_score === "number" && <ScorePill label="Platform" value={audit.platform_score} />}
                        <span
                          className="ml-auto text-xs font-black font-mono"
                          style={{ color: scoreColor(weighted) }}
                        >
                          {weighted.toFixed(1)}
                        </span>
                      </div>
                    )}

                    {typeof audit.critique === "string" && (
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed line-clamp-2">{audit.critique}</p>
                    )}
                  </div>
                </button>

                {/* Expanded: full image / email iframe + download */}
                {isOpen && (
                  <div className="border-t border-slate-100">
                    {isEmail && imgUrl ? (
                      <div className="flex justify-center bg-slate-100 py-4">
                        <iframe
                          src={imgUrl}
                          sandbox="allow-same-origin"
                          title="Email preview"
                          style={{
                            width: 500,
                            height: 520,
                            border: "none",
                            background: "#fff",
                            borderRadius: 4,
                            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                            display: "block",
                          }}
                        />
                      </div>
                    ) : showImg ? (
                      <div className="bg-slate-50 flex items-center justify-center p-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgUrl!}
                          alt={format}
                          className="max-h-[50vh] max-w-full rounded-xl shadow-sm object-contain"
                        />
                      </div>
                    ) : null}
                    {imgUrl && (
                      <div className="flex justify-end px-4 py-2 border-t border-slate-100">
                        <a
                          href={imgUrl}
                          download
                          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-600"
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </a>
                      </div>
                    )}
                    {typeof audit.critique === "string" && (
                      <div className="px-4 py-3 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Critique</p>
                        <p className="text-xs text-slate-600 leading-relaxed">{audit.critique}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {auditAssets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-2">
              <ImageIcon className="h-10 w-10" />
              <p className="text-sm text-slate-400">No assets to review</p>
            </div>
          )}
        </div>

        {/* Feedback textarea */}
        {showFeedback && (
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. 'Redo the TikTok hook, too generic'"
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
          />
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setShowFeedback(!showFeedback)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {showFeedback ? "Hide Notes" : "Add Notes"}
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => onResume(false, feedback || "Assets rejected")}
            disabled={isResuming}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors",
              isResuming && "opacity-50 cursor-not-allowed"
            )}
          >
            <ThumbsDown className="h-3.5 w-3.5" /> Reject
          </button>
          <button
            type="button"
            onClick={() => onResume(true, feedback || undefined)}
            disabled={isResuming}
            className={cn(
              "flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90",
              isResuming && "opacity-70 cursor-not-allowed"
            )}
            style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
          >
            {isResuming
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <ThumbsUp className="h-3.5 w-3.5" />}
            Approve Assets
          </button>
        </div>
      </div>
    </ScrollArea>
  );
}
