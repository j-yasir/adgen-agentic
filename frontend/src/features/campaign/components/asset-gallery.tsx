"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/utils";
import { Download, Image as ImageIcon, Video, Mail, FileText, X, ExternalLink } from "lucide-react";
import type { AssetResponse } from "../types";

const PLATFORM_META: Record<string, { color: string; bg: string }> = {
  instagram:  { color: "#ec4899", bg: "rgba(236,72,153,0.1)" },
  facebook:   { color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  tiktok:     { color: "#0f172a", bg: "rgba(15,23,42,0.1)" },
  youtube:    { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  linkedin:   { color: "#0ea5e9", bg: "rgba(14,165,233,0.1)" },
  google:     { color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
  email:      { color: "#8b5cf6", bg: "rgba(139,92,246,0.1)" },
  twitter:    { color: "#0f172a", bg: "rgba(15,23,42,0.08)" },
};

const FORMAT_ICONS: Record<string, typeof ImageIcon> = {
  image:        ImageIcon,
  static_image: ImageIcon,
  video:        Video,
  video_ad:     Video,
  email:        Mail,
  carousel:     ImageIcon,
  story:        ImageIcon,
  document:     FileText,
};

function getPlatformMeta(platform: string) {
  return PLATFORM_META[platform.toLowerCase()] ?? { color: "#6366f1", bg: "rgba(99,102,241,0.1)" };
}

function getFormatIcon(format: string, assetType: string) {
  return FORMAT_ICONS[format] ?? FORMAT_ICONS[assetType] ?? FileText;
}

function statusStyle(status: string) {
  switch (status) {
    case "stored":     return { color: "#16a34a", bg: "rgba(34,197,94,0.1)", label: "Ready" };
    case "generating": return { color: "#6366f1", bg: "rgba(99,102,241,0.1)", label: "Generating" };
    case "failed":     return { color: "#dc2626", bg: "rgba(239,68,68,0.1)", label: "Failed" };
    default:           return { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", label: status };
  }
}

function AssetModal({
  asset,
  onClose,
}: {
  asset: AssetResponse;
  onClose: () => void;
}) {
  const pm = getPlatformMeta(asset.platform);
  const Icon = getFormatIcon(asset.format, asset.asset_type);
  const st = statusStyle(asset.status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header strip */}
        <div className="h-1 w-full" style={{ background: pm.color }} />

        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: pm.bg }}
            >
              <Icon className="h-5 w-5" style={{ color: pm.color }} />
            </div>
            <div>
              <p className="font-bold text-slate-800 capitalize">
                {asset.format.replace(/_/g, " ")} · {asset.platform}
              </p>
              <p className="text-xs text-slate-400 capitalize mt-0.5">{asset.asset_type.replace(/_/g, " ")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Preview area */}
        <div
          className="flex items-center justify-center"
          style={{ height: 180, background: pm.bg }}
        >
          <Icon className="h-16 w-16 opacity-20" style={{ color: pm.color }} />
        </div>

        <div className="p-5 space-y-4">
          {/* Status + badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ color: st.color, background: st.bg }}
            >
              {st.label}
            </span>
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ color: pm.color, background: pm.bg }}
            >
              {asset.platform}
            </span>
            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full capitalize">
              {asset.asset_type.replace(/_/g, " ")}
            </span>
          </div>

          {/* Prompt used */}
          {asset.prompt_used && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Prompt Used</p>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 leading-relaxed">
                {asset.prompt_used}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {asset.storage_url && asset.status === "stored" && (
              <>
                <a
                  href={asset.storage_url}
                  download
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
                <a
                  href={asset.storage_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <ExternalLink className="h-4 w-4 text-slate-400" />
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AssetGallery({
  assets,
  auditScore,
}: {
  assets: AssetResponse[];
  auditScore?: number | null;
}) {
  const [selectedAsset, setSelectedAsset] = useState<AssetResponse | null>(null);

  if (!assets.length) return null;

  const scoreColor =
    auditScore == null ? "#94a3b8"
    : auditScore >= 80 ? "#22c55e"
    : auditScore >= 60 ? "#f59e0b"
    : "#ef4444";

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Generated Assets
          </p>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {assets.length} assets
          </span>
          {auditScore != null && (
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full font-mono"
              style={{ color: scoreColor, background: scoreColor + "18" }}
            >
              {auditScore.toFixed(0)}/100
            </span>
          )}
        </div>
        <button
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" />
          Download All
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {assets.map((asset) => {
          const pm = getPlatformMeta(asset.platform);
          const Icon = getFormatIcon(asset.format, asset.asset_type);
          const st = statusStyle(asset.status);

          return (
            <button
              key={asset.id}
              type="button"
              onClick={() => setSelectedAsset(asset)}
              className="group text-left bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all"
            >
              {/* Thumbnail area */}
              <div
                className="flex items-center justify-center relative"
                style={{ height: 96, background: pm.bg }}
              >
                <Icon
                  className="h-8 w-8 opacity-40 group-hover:opacity-60 transition-opacity"
                  style={{ color: pm.color }}
                />
                {/* Platform chip */}
                <span
                  className="absolute top-2 left-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ color: pm.color, background: "white", boxShadow: "0 0 0 1px " + pm.color + "30" }}
                >
                  {asset.platform}
                </span>
              </div>

              {/* Card body */}
              <div className="p-2.5 space-y-1.5">
                <p className="text-xs font-semibold text-slate-700 capitalize truncate">
                  {asset.format.replace(/_/g, " ")}
                </p>
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    )}
                    style={{ color: st.color, background: st.bg }}
                  >
                    {st.label}
                  </span>
                  {asset.storage_url && asset.status === "stored" && (
                    <a
                      href={asset.storage_url}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="text-slate-300 hover:text-indigo-500 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedAsset && (
        <AssetModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
    </>
  );
}
