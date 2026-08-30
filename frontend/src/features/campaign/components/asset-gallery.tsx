"use client";

import { useState } from "react";
import { cn, toAssetUrl } from "@/shared/lib/utils";
import { Download, Image as ImageIcon, Video, Mail, FileText, X, ExternalLink, Maximize2, Monitor, Smartphone } from "lucide-react";
import type { AssetResponse } from "../types";

const PLATFORM_META: Record<string, { color: string; bg: string }> = {
  instagram: { color: "#ec4899", bg: "rgba(236,72,153,0.1)" },
  facebook:  { color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  tiktok:    { color: "#0f172a", bg: "rgba(15,23,42,0.1)" },
  youtube:   { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  linkedin:  { color: "#0ea5e9", bg: "rgba(14,165,233,0.1)" },
  google:    { color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
  email:     { color: "#8b5cf6", bg: "rgba(139,92,246,0.1)" },
};

const FORMAT_ICONS: Record<string, typeof ImageIcon> = {
  image: ImageIcon, static_image: ImageIcon,
  video: Video, video_ad: Video,
  email: Mail,
  carousel: ImageIcon, story: ImageIcon,
  document: FileText,
};

function getPlatformMeta(platform: string) {
  return PLATFORM_META[platform.toLowerCase()] ?? { color: "#6366f1", bg: "rgba(99,102,241,0.1)" };
}

function isImageAsset(assetType: string, format: string) {
  if (assetType === "image" || assetType === "static_image") return true;
  if (format === "image" || format === "static_image") return true;
  if (/^\d+:\d+$/.test(format)) return assetType !== "video" && assetType !== "voice";
  return false;
}

function isEmailAsset(assetType: string) {
  return assetType === "email";
}

function statusStyle(status: string) {
  switch (status) {
    case "stored":     return { color: "#16a34a", bg: "rgba(34,197,94,0.1)", label: "Ready" };
    case "generating": return { color: "#6366f1", bg: "rgba(99,102,241,0.1)", label: "Generating" };
    case "failed":     return { color: "#dc2626", bg: "rgba(239,68,68,0.1)", label: "Failed" };
    default:           return { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", label: status };
  }
}

const VIEWPORT_WIDTH = { desktop: 640, mobile: 375 } as const;

function EmailPreview({ url, metadata }: { url: string; metadata: AssetResponse["metadata"] }) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [height, setHeight] = useState(500);

  return (
    <div>
      {/* Inbox-style chrome — sender/subject/preview, like an email client */}
      <div className="px-5 py-3 border-b border-slate-100 bg-white">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-slate-800 truncate">
            {metadata?.sender_name || "Sender"}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setViewport("desktop")}
              className={cn(
                "h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                viewport === "desktop" ? "bg-indigo-50 text-indigo-600" : "text-slate-300 hover:text-slate-500"
              )}
              aria-label="Desktop preview"
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewport("mobile")}
              className={cn(
                "h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                viewport === "mobile" ? "bg-indigo-50 text-indigo-600" : "text-slate-300 hover:text-slate-500"
              )}
              aria-label="Mobile preview"
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>
        </div>
        {metadata?.subject_line && (
          <p className="text-sm font-semibold text-slate-700 mt-1 truncate">{metadata.subject_line}</p>
        )}
        {metadata?.preview_text && (
          <p className="text-xs text-slate-400 mt-0.5 truncate">{metadata.preview_text}</p>
        )}
      </div>

      {/* Isolated iframe — the actual email-safe HTML, never rendered inline
          in the app's own DOM (avoids Tailwind/global-style bleed either way) */}
      <div className="flex justify-center bg-slate-100 py-6 overflow-x-auto" style={{ minHeight: 300 }}>
        <iframe
          src={url}
          sandbox="allow-same-origin"
          style={{ width: VIEWPORT_WIDTH[viewport], height, border: "none", background: "#ffffff" }}
          className="shadow-sm rounded"
          onLoad={(e) => {
            try {
              const doc = e.currentTarget.contentDocument;
              if (doc?.body) setHeight(doc.body.scrollHeight);
            } catch {
              // cross-origin or not yet ready — keep the current height
            }
          }}
        />
      </div>
    </div>
  );
}

function AssetModal({ asset, onClose }: { asset: AssetResponse; onClose: () => void }) {
  const pm = getPlatformMeta(asset.platform);
  const Icon = FORMAT_ICONS[asset.format] ?? FORMAT_ICONS[asset.asset_type] ?? FileText;
  const st = statusStyle(asset.status);
  const imgUrl = toAssetUrl(asset.storage_url);
  const showImage = isImageAsset(asset.asset_type, asset.format) && imgUrl && asset.status === "stored";
  const showEmail = isEmailAsset(asset.asset_type) && imgUrl && asset.status === "stored";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full" style={{ background: pm.color }} />

        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: pm.bg }}>
              <Icon className="h-5 w-5" style={{ color: pm.color }} />
            </div>
            <div>
              <p className="font-bold text-slate-800 capitalize">{asset.format.replace(/_/g, " ")} · {asset.platform}</p>
              <p className="text-xs text-slate-400 capitalize mt-0.5">{asset.asset_type.replace(/_/g, " ")}</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Preview */}
        <div className="relative bg-slate-50" style={showEmail ? undefined : { minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {showEmail ? (
            <EmailPreview url={imgUrl!} metadata={asset.metadata} />
          ) : showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgUrl} alt={asset.format} className="max-h-[60vh] w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-slate-300">
              <Icon className="h-16 w-16" />
              <p className="text-sm">{asset.asset_type === "video_ad" ? "Video preview not available" : "Preview not available"}</p>
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: st.color, background: st.bg }}>{st.label}</span>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ color: pm.color, background: pm.bg }}>{asset.platform}</span>
            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full capitalize">{asset.asset_type.replace(/_/g, " ")}</span>
          </div>

          {asset.asset_type === "email" && asset.metadata?.subject_line && (
            <div className="space-y-2">
              <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                <div className="space-y-1 flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subject</p>
                  <p className="text-sm font-semibold text-slate-800">{asset.metadata.subject_line}</p>
                </div>
              </div>
              {asset.metadata?.preview_text && (
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Preview text</p>
                  <p className="text-xs text-slate-600">{asset.metadata.preview_text}</p>
                </div>
              )}
              {asset.metadata?.template_used && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">Template:</span>
                  <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{asset.metadata.template_used}</span>
                </div>
              )}
            </div>
          )}
          {asset.asset_type !== "email" && asset.prompt_used && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Prompt Used</p>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 leading-relaxed">{asset.prompt_used}</p>
            </div>
          )}

          {imgUrl && asset.status === "stored" && (
            <div className="flex items-center gap-2 pt-1">
              <a
                href={imgUrl}
                download
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
              >
                <Download className="h-4 w-4" /> Download
              </a>
              <a
                href={imgUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <ExternalLink className="h-4 w-4 text-slate-400" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AssetGallery({ assets, auditScore }: { assets: AssetResponse[]; auditScore?: number | null }) {
  const [selectedAsset, setSelectedAsset] = useState<AssetResponse | null>(null);

  if (!assets.length) return null;

  const scoreColor =
    auditScore == null ? "#94a3b8"
    : auditScore >= 80 ? "#22c55e"
    : auditScore >= 60 ? "#f59e0b"
    : "#ef4444";

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Generated Assets</p>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{assets.length}</span>
          {auditScore != null && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full font-mono" style={{ color: scoreColor, background: scoreColor + "18" }}>
              {auditScore.toFixed(0)}/100
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {assets.map((asset) => {
          const pm = getPlatformMeta(asset.platform);
          const Icon = FORMAT_ICONS[asset.format] ?? FORMAT_ICONS[asset.asset_type] ?? FileText;
          const st = statusStyle(asset.status);
          const imgUrl = toAssetUrl(asset.storage_url);
          const showThumb = isImageAsset(asset.asset_type, asset.format) && imgUrl && asset.status === "stored";

          return (
            <button
              key={asset.id}
              type="button"
              onClick={() => setSelectedAsset(asset)}
              className="group text-left bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-md transition-all"
            >
              {/* Thumbnail */}
              <div className="relative overflow-hidden" style={{ height: 120, background: showThumb ? "#f8fafc" : pm.bg }}>
                {showThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgUrl}
                    alt={asset.format}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : isEmailAsset(asset.asset_type) ? (
                  <div className="h-full w-full flex flex-col" style={{ background: "#f0f2f5" }}>
                    {/* Mini email-client chrome */}
                    <div className="flex items-center gap-1.5 px-2 py-1.5 shrink-0" style={{ background: "#e2e5ea" }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: "#ff5f57" }} />
                      <span className="h-2 w-2 rounded-full" style={{ background: "#febc2e" }} />
                      <span className="h-2 w-2 rounded-full" style={{ background: "#28c840" }} />
                      {asset.metadata?.sender_name && (
                        <span className="text-[9px] text-slate-500 ml-1 truncate">{asset.metadata.sender_name}</span>
                      )}
                    </div>
                    {/* Mini inbox row */}
                    <div className="flex-1 bg-white px-2.5 py-2 space-y-1 overflow-hidden">
                      <p className="text-[11px] font-bold text-slate-800 leading-tight line-clamp-2">
                        {asset.metadata?.subject_line ?? "Email Campaign"}
                      </p>
                      {asset.metadata?.preview_text && (
                        <p className="text-[9px] text-slate-400 leading-snug line-clamp-3">
                          {asset.metadata.preview_text}
                        </p>
                      )}
                      {/* Skeleton body lines */}
                      <div className="pt-1 space-y-1">
                        <div className="h-1.5 rounded bg-slate-100 w-full" />
                        <div className="h-1.5 rounded bg-slate-100 w-4/5" />
                        <div className="h-1.5 rounded bg-slate-100 w-3/5" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <Icon className="h-10 w-10 opacity-30" style={{ color: pm.color }} />
                  </div>
                )}
                {/* Platform badge */}
                <span
                  className="absolute top-2 left-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white shadow-sm"
                  style={{ color: pm.color }}
                >
                  {asset.platform}
                </span>
                {/* Expand icon on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Maximize2 className="h-5 w-5 text-white drop-shadow" />
                </div>
              </div>

              <div className="p-2.5 space-y-1.5">
                <p className="text-xs font-semibold text-slate-700 capitalize truncate">
                  {asset.format.replace(/_/g, " ")}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: st.color, background: st.bg }}>
                    {st.label}
                  </span>
                  {imgUrl && asset.status === "stored" && (
                    <a
                      href={imgUrl}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className={cn("text-slate-300 hover:text-indigo-500 transition-colors")}
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

      {selectedAsset && <AssetModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />}
    </>
  );
}
