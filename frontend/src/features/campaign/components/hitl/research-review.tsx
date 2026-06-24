"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  FlaskConical,
  Loader2,
  MessageSquare,
  Users,
  TrendingUp,
  Lightbulb,
  Eye,
  Calendar,
  Mic,
  Target,
  Swords,
} from "lucide-react";

type Props = {
  data: Record<string, unknown>;
  onResume: (approved: boolean, feedback?: string) => void;
  isResuming: boolean;
};

function SectionHeader({
  icon: Icon,
  title,
  count,
}: {
  icon: typeof FlaskConical;
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-indigo-400" />
      <h4 className="text-sm font-semibold">{title}</h4>
      {count !== undefined && (
        <Badge variant="outline" className="text-[10px] ml-auto">
          {count}
        </Badge>
      )}
    </div>
  );
}

function CompetitorCard({ competitor }: { competitor: Record<string, unknown> }) {
  const name = (competitor.competitor_name ?? competitor.name ?? "Competitor") as string;
  const formats = (competitor.ad_formats ?? competitor.formats ?? []) as string[];
  const hooks = (competitor.hooks_used ?? competitor.hooks ?? []) as string[];
  const positioning = (competitor.positioning ?? competitor.positioning_strategy ?? "") as string;
  const strengths = (competitor.strengths ?? []) as string[];

  return (
    <div className="rounded-xl border border-border/40 bg-gradient-to-br from-card/80 to-card/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="font-semibold text-sm">{name}</h5>
        <Swords className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {hooks.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Hooks Used</p>
          <div className="flex flex-wrap gap-1.5">
            {hooks.map((h, i) => (
              <Badge key={i} className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[11px]">
                {String(h)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {formats.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Ad Formats</p>
          <div className="flex flex-wrap gap-1.5">
            {formats.map((f, i) => (
              <Badge key={i} variant="outline" className="text-[11px]">{String(f)}</Badge>
            ))}
          </div>
        </div>
      )}

      {strengths.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Strengths</p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {strengths.map((s, i) => <li key={i}>• {String(s)}</li>)}
          </ul>
        </div>
      )}

      {positioning && (
        <p className="text-xs text-muted-foreground italic">{String(positioning).slice(0, 150)}</p>
      )}
    </div>
  );
}

function TrendCard({ trend }: { trend: Record<string, unknown> }) {
  const platform = (trend.platform ?? trend.name ?? "Platform") as string;
  const formats = (trend.trending_formats ?? trend.formats ?? []) as string[];
  const hooks = (trend.trending_hooks ?? trend.hooks ?? []) as string[];
  const summary = (trend.summary ?? trend.insight ?? trend.notes ?? "") as string;
  const metrics = (trend.benchmark_metrics ?? trend.metrics ?? {}) as Record<string, unknown>;

  return (
    <div className="rounded-xl border border-border/40 bg-gradient-to-br from-card/80 to-card/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="font-semibold text-sm">{platform}</h5>
        <TrendingUp className="h-3.5 w-3.5 text-green-400" />
      </div>

      {formats.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {formats.map((f, i) => (
            <Badge key={i} className="bg-green-500/10 text-green-400 border-green-500/20 text-[11px]">
              {String(f)}
            </Badge>
          ))}
        </div>
      )}

      {hooks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {hooks.map((h, i) => (
            <Badge key={i} variant="outline" className="text-[11px]">{String(h)}</Badge>
          ))}
        </div>
      )}

      {Object.keys(metrics).length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(metrics).map(([k, v]) => (
            <div key={k} className="text-xs">
              <span className="text-muted-foreground">{k.replace(/_/g, " ")}: </span>
              <span className="font-mono text-indigo-400">{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      {summary && <p className="text-xs text-muted-foreground">{String(summary).slice(0, 200)}</p>}
    </div>
  );
}

export function ResearchReview({ data, onResume, isResuming }: Props) {
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  const competitors = (data.competitor_ad_patterns ?? data.competitors ?? data.competitor_analysis ?? []) as Record<string, unknown>[];
  const trends = (data.platform_trends ?? data.platform_specific_trends ?? data.trends ?? []) as Record<string, unknown>[];
  const angles = (data.recommended_angles ?? data.campaign_angles ?? data.angles ?? []) as unknown[];
  const audience = (data.audience_insights ?? data.behavioral_trends ?? data.audience ?? null) as Record<string, unknown> | string | null;
  const seasonal = (data.seasonal_context ?? data.seasonal ?? data.cultural_moments ?? null) as Record<string, unknown> | string | unknown[] | null;
  const tone = (data.tone_recommendations ?? data.recommended_tone ?? data.tone ?? null) as Record<string, unknown> | string | unknown[] | null;
  const hasContent = competitors.length > 0 || trends.length > 0 || angles.length > 0;

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
            <FlaskConical className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Research Report</h3>
            <p className="text-xs text-muted-foreground">Review findings before proceeding to strategy</p>
          </div>
        </div>

        <Separator className="opacity-20" />

        {/* Competitors */}
        {Array.isArray(competitors) && competitors.length > 0 && (
          <div>
            <SectionHeader icon={Eye} title="Competitor Analysis" count={competitors.length} />
            <div className="grid gap-3">
              {competitors.map((c, i) => (
                <CompetitorCard
                  key={i}
                  competitor={typeof c === "object" && c !== null ? c as Record<string, unknown> : { name: String(c) }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Platform Trends */}
        {Array.isArray(trends) && trends.length > 0 && (
          <div>
            <SectionHeader icon={TrendingUp} title="Platform Trends" count={trends.length} />
            <div className="grid gap-3">
              {trends.map((t, i) => (
                <TrendCard
                  key={i}
                  trend={typeof t === "object" && t !== null ? t as Record<string, unknown> : { name: String(t) }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recommended Angles */}
        {angles.length > 0 && (
          <div>
            <SectionHeader icon={Lightbulb} title="Recommended Angles" count={angles.length} />
            <div className="space-y-2">
              {angles.map((angle, i) => {
                if (typeof angle === "string") {
                  return (
                    <div key={i} className="flex items-start gap-3 rounded-xl border border-border/40 bg-gradient-to-r from-indigo-500/5 to-transparent p-3">
                      <Target className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                      <p className="text-sm">{angle}</p>
                    </div>
                  );
                }
                const a = angle as Record<string, unknown>;
                return (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-border/40 bg-gradient-to-r from-indigo-500/5 to-transparent p-3">
                    <Target className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{String(a.angle ?? a.name ?? a.title ?? `Angle ${i + 1}`)}</p>
                      {typeof a.description === "string" && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                      {typeof a.rationale === "string" && <p className="text-xs text-muted-foreground mt-0.5">{a.rationale}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Audience Insights */}
        {audience && (
          <div>
            <SectionHeader icon={Users} title="Audience Insights" />
            <div className="rounded-xl border border-border/40 bg-gradient-to-br from-card/80 to-card/40 p-4">
              {typeof audience === "string" ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{(audience as string).slice(0, 500)}</p>
              ) : typeof audience === "object" ? (
                <div className="space-y-2 text-sm">
                  {Object.entries(audience as Record<string, unknown>).map(([k, v]) => {
                    if (!v || (Array.isArray(v) && v.length === 0)) return null;
                    return (
                      <div key={k}>
                        <span className="text-muted-foreground text-xs uppercase tracking-wider">{k.replace(/_/g, " ")}</span>
                        <p className="mt-0.5">{Array.isArray(v) ? v.map(String).join(", ") : String(v).slice(0, 200)}</p>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Seasonal Context */}
        {seasonal && (
          <div>
            <SectionHeader icon={Calendar} title="Seasonal Context" />
            <div className="rounded-xl border border-border/40 bg-gradient-to-br from-card/80 to-card/40 p-4">
              {typeof seasonal === "string" ? (
                <p className="text-sm text-muted-foreground">{(seasonal as string).slice(0, 300)}</p>
              ) : Array.isArray(seasonal) ? (
                <div className="flex flex-wrap gap-2">
                  {(seasonal as unknown[]).map((s, i) => (
                    <Badge key={i} className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                      {typeof s === "object" ? JSON.stringify(s) : String(s)}
                    </Badge>
                  ))}
                </div>
              ) : typeof seasonal === "object" ? (
                <div className="space-y-2 text-sm">
                  {Object.entries(seasonal as Record<string, unknown>).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-muted-foreground text-xs">{k.replace(/_/g, " ")}: </span>
                      <span>{Array.isArray(v) ? v.map(String).join(", ") : String(v)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Tone */}
        {tone && (
          <div>
            <SectionHeader icon={Mic} title="Tone Recommendations" />
            <div className="rounded-xl border border-border/40 bg-gradient-to-br from-card/80 to-card/40 p-4">
              {typeof tone === "string" ? (
                <p className="text-sm">{(tone as string).slice(0, 300)}</p>
              ) : Array.isArray(tone) ? (
                <div className="flex flex-wrap gap-2">
                  {(tone as unknown[]).map((t, i) => (
                    <Badge key={i} className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                      {String(t)}
                    </Badge>
                  ))}
                </div>
              ) : typeof tone === "object" ? (
                <div className="space-y-1 text-sm">
                  {Object.entries(tone as Record<string, unknown>).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-muted-foreground text-xs">{k.replace(/_/g, " ")}: </span>
                      <span>{String(v)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Fallback for unknown structure */}
        {!hasContent && !audience && !seasonal && !tone && (
          <div className="rounded-xl border border-border/40 bg-card/50 p-4">
            <pre className="text-xs text-muted-foreground overflow-auto max-h-[400px] whitespace-pre-wrap">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}

        <Separator className="opacity-20" />

        {/* Feedback */}
        {showFeedback && (
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Add notes for the strategist... e.g. 'Focus more on the Eid angle' or 'Ignore TikTok, focus Instagram'"
            rows={3}
            className="border-border/40"
          />
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 sticky bottom-0 bg-background/80 backdrop-blur-sm py-3 -mx-5 px-5 border-t border-border/20">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFeedback(!showFeedback)}
          >
            <MessageSquare className="mr-1 h-4 w-4" />
            {showFeedback ? "Hide Notes" : "Add Notes"}
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={() => onResume(false, feedback || "Research rejected")}
            disabled={isResuming}
          >
            Reject & Redo
          </Button>
          <Button
            className="bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20"
            onClick={() => onResume(true, feedback || undefined)}
            disabled={isResuming}
          >
            {isResuming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Approve Research
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}
