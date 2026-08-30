"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Lightbulb,
  Loader2,
  MessageSquare,
  Target,
  Megaphone,
  Palette,
  BarChart3,
} from "lucide-react";

type Props = {
  data: Record<string, unknown>;
  onResume: (approved: boolean, feedback?: string) => void;
  isResuming: boolean;
  readonly?: boolean;
};

function SectionHeader({
  icon: Icon,
  title,
  color = "text-indigo-400",
}: {
  icon: typeof Lightbulb;
  title: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`h-4 w-4 ${color}`} />
      <h4 className="text-sm font-semibold">{title}</h4>
    </div>
  );
}

function PlatformTacticCard({ platform, tactics }: { platform: string; tactics: Record<string, unknown> }) {
  const formats = (tactics.formats ?? []) as string[];
  const cadence = tactics.posting_cadence as string | undefined;
  const cta = tactics.cta as string | undefined;

  return (
    <div className="rounded-xl border border-border/40 bg-gradient-to-br from-card/80 to-card/40 p-4 space-y-2">
      <h5 className="font-semibold capitalize">{platform}</h5>
      {formats.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {formats.map((f, i) => (
            <Badge key={i} className="bg-green-500/10 text-green-400 border-green-500/20 text-[11px]">{f}</Badge>
          ))}
        </div>
      )}
      <div className="flex gap-4 text-xs text-muted-foreground">
        {cadence && <span>Cadence: <span className="text-foreground">{cadence}</span></span>}
        {cta && <span>CTA: <span className="font-medium text-indigo-400">{cta}</span></span>}
      </div>
    </div>
  );
}

function AssetPlanCard({ asset, index }: { asset: Record<string, unknown>; index: number }) {
  const platform = String(asset.platform ?? "?");
  const format = String(asset.format ?? "?");
  const assetType = String(asset.asset_type ?? "").replace(/_/g, " ");
  const funnel = String(asset.funnel_stage ?? asset.funnel_fit ?? "?");
  const role = String(asset.role_in_campaign ?? "");
  const hook = String(asset.hook ?? asset.hook_direction ?? "");
  const headline = String(asset.headline ?? asset.subject_line ?? "");
  const keyMessage = String(asset.key_message ?? "");
  const cta = String(asset.cta ?? asset.cta_text ?? "");
  const angle = String(asset.angle ?? "");
  const visualBrief = String(
    asset.visual_brief ?? asset.visual_description ?? asset.image_prompt ??
    asset.visual_style ?? asset.hero_image_brief ?? ""
  );
  const copyNotes = String(asset.copy_notes ?? "");

  return (
    <div className="rounded-xl border border-border/40 bg-gradient-to-br from-card/80 to-card/40 p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/10 text-[11px] font-bold text-indigo-400">
          {index + 1}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {assetType && <Badge className="bg-pink-500/10 text-pink-400 border-pink-500/20 text-[10px] capitalize">{assetType}</Badge>}
          <Badge variant="outline" className="text-[10px] capitalize">{platform}</Badge>
          <Badge variant="outline" className="text-[10px]">{format}</Badge>
          <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px] uppercase">{funnel}</Badge>
          {role && <Badge variant="outline" className="text-[10px] capitalize">{role}</Badge>}
        </div>
      </div>

      {hook && (
        <div className="rounded-lg bg-muted/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Hook</p>
          <p className="text-sm italic">&ldquo;{hook}&rdquo;</p>
        </div>
      )}

      {headline && <p className="text-sm font-medium">{headline}</p>}
      {keyMessage && <p className="text-xs"><span className="text-muted-foreground">Key message:</span> {keyMessage}</p>}
      {angle && <p className="text-xs"><span className="text-muted-foreground">Angle:</span> {angle}</p>}
      {cta && <p className="text-xs"><span className="text-muted-foreground">CTA:</span> <span className="font-medium text-indigo-400">{cta}</span></p>}
      {visualBrief && <p className="text-xs text-muted-foreground line-clamp-3">{visualBrief}</p>}
      {copyNotes && <p className="text-xs text-muted-foreground italic">{copyNotes}</p>}
    </div>
  );
}

export function StrategyReview({ data, onResume, isResuming, readonly = false }: Props) {
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  const positioning = (data.positioning ?? data.campaign_theme ?? "") as string;
  const uvp = (data.unique_value_prop ?? data.target_emotion ?? "") as string;
  const narrativeArc = (data.narrative_arc ?? "") as string;
  const pillars = (data.messaging_pillars ?? data.key_messages ?? []) as string[];
  const tone = (data.tone_of_voice ?? data.tone ?? "") as string;
  const themes = (data.content_themes ?? []) as string[];
  const platformTactics = (data.platform_tactics ?? {}) as Record<string, Record<string, unknown>>;
  const assetBrief = data.asset_brief as Record<string, unknown> | undefined;
  const assetPlan = (data.asset_plan ?? data.assets ?? []) as Record<string, unknown>[];
  const kpis = (data.kpis ?? []) as string[];
  const avoid = (data.what_to_avoid ?? []) as string[];

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
            <Lightbulb className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Strategy Plan</h3>
            <p className="text-xs text-muted-foreground">Review the campaign strategy before production</p>
          </div>
        </div>

        <Separator className="opacity-20" />

        {/* Positioning + UVP */}
        {(positioning || uvp) && (
          <div className="rounded-xl border border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-transparent p-5 space-y-2">
            {positioning && <p className="text-lg font-semibold">&ldquo;{positioning}&rdquo;</p>}
            {uvp && <p className="text-sm text-muted-foreground">{uvp}</p>}
            {narrativeArc && <p className="text-sm text-muted-foreground italic">{narrativeArc}</p>}
            {tone && (
              <p className="text-xs text-muted-foreground">
                Tone: <span className="text-purple-400">{tone}</span>
              </p>
            )}
          </div>
        )}

        {/* Messaging Pillars */}
        {pillars.length > 0 && (
          <div>
            <SectionHeader icon={Megaphone} title="Messaging Pillars" color="text-amber-400" />
            <div className="flex flex-wrap gap-2">
              {pillars.map((p, i) => (
                <Badge key={i} className="bg-amber-500/10 text-amber-400 border-amber-500/20">{p}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Content Themes */}
        {themes.length > 0 && (
          <div>
            <SectionHeader icon={Palette} title="Content Themes" color="text-cyan-400" />
            <div className="flex flex-wrap gap-2">
              {themes.map((t, i) => (
                <Badge key={i} variant="outline">{t}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Platform Tactics */}
        {Object.keys(platformTactics).length > 0 && (
          <div>
            <SectionHeader icon={Target} title="Platform Tactics" color="text-green-400" />
            <div className="space-y-3">
              {Object.entries(platformTactics).map(([platform, tactics]) => (
                <PlatformTacticCard key={platform} platform={platform} tactics={tactics} />
              ))}
            </div>
          </div>
        )}

        {/* Asset Plan (per-asset cards) */}
        {assetPlan.length > 0 && (
          <div>
            <SectionHeader icon={Palette} title={`Asset Plan (${assetPlan.length} assets)`} color="text-pink-400" />
            <div className="space-y-3">
              {assetPlan.map((a, i) => <AssetPlanCard key={i} asset={a} index={i} />)}
            </div>
          </div>
        )}

        {/* Asset Brief (summary) */}
        {assetBrief && !assetPlan.length && (
          <div>
            <SectionHeader icon={Palette} title="Asset Brief" color="text-pink-400" />
            <div className="rounded-xl border border-border/40 bg-gradient-to-br from-card/80 to-card/40 p-4 space-y-2 text-sm">
              {Object.entries(assetBrief).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                  <span className="font-medium">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPIs */}
        {kpis.length > 0 && (
          <div>
            <SectionHeader icon={BarChart3} title="KPIs" color="text-blue-400" />
            <div className="flex flex-wrap gap-2">
              {kpis.map((k, i) => (
                <Badge key={i} variant="outline" className="capitalize">{k.replace(/_/g, " ")}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* What to Avoid */}
        {avoid.length > 0 && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-[10px] uppercase tracking-wider text-red-400 mb-2">What to Avoid</p>
            <ul className="text-sm text-red-300/80 space-y-1">
              {avoid.map((a, i) => <li key={i}>✗ {a}</li>)}
            </ul>
          </div>
        )}

        {/* Fallback */}
        {!positioning && !assetPlan.length && Object.keys(platformTactics).length === 0 && !assetBrief && (
          <div className="rounded-xl border border-border/40 bg-card/50 p-4">
            <pre className="text-xs text-muted-foreground overflow-auto max-h-[400px] whitespace-pre-wrap">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}

        {!readonly && (
          <>
            <Separator className="opacity-20" />

            {showFeedback && (
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g. 'The TikTok hook is too generic' or 'Add more urgency to the email CTA'"
                rows={3}
                className="border-border/40"
              />
            )}

            <div className="flex items-center gap-2 sticky bottom-0 bg-background/80 backdrop-blur-sm py-3 -mx-5 px-5 border-t border-border/20">
              <Button variant="outline" size="sm" onClick={() => setShowFeedback(!showFeedback)}>
                <MessageSquare className="mr-1 h-4 w-4" />
                {showFeedback ? "Hide Notes" : "Add Notes"}
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => onResume(false, feedback || "Strategy rejected")} disabled={isResuming}>
                Reject & Redo
              </Button>
              <Button
                className="bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20"
                onClick={() => onResume(true, feedback || undefined)}
                disabled={isResuming}
              >
                {isResuming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Approve Strategy
              </Button>
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
}
