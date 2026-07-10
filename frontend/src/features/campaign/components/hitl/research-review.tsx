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
  Calendar,
  Mic,
  Target,
  Swords,
  Image,
  Video,
  Mail,
  ExternalLink,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
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
  color = "text-indigo-400",
}: {
  icon: typeof FlaskConical;
  title: string;
  count?: number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`h-4 w-4 ${color}`} />
      <h4 className="text-sm font-semibold">{title}</h4>
      {count !== undefined && (
        <Badge variant="outline" className="text-[10px] ml-auto">{count}</Badge>
      )}
    </div>
  );
}

function CompetitorCard({ comp }: { comp: Record<string, unknown> }) {
  const name = String(comp.competitor_name ?? comp.name ?? "Competitor");
  const formats = (comp.ad_formats ?? []) as string[];
  const hooks = (comp.hooks_used ?? []) as Record<string, unknown>[];
  const positioning = String(comp.positioning ?? "");
  const strengths = (comp.strengths ?? []) as string[];
  const weaknesses = (comp.weaknesses_to_exploit ?? comp.weaknesses ?? []) as string[];

  return (
    <div className="rounded-xl border border-border/40 bg-gradient-to-br from-card/80 to-card/40 p-4 space-y-3 hover:border-border/60 transition-colors">
      <div className="flex items-center justify-between">
        <h5 className="font-semibold">{name}</h5>
        <div className="flex gap-1">
          {formats.map((f, i) => (
            <Badge key={i} variant="outline" className="text-[10px] capitalize">{f}</Badge>
          ))}
        </div>
      </div>

      {positioning && (
        <p className="text-xs text-muted-foreground italic">{positioning}</p>
      )}

      {hooks.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Hooks</p>
          {hooks.map((h, i) => (
            <div key={i} className="rounded-lg bg-muted/20 px-3 py-2 text-xs">
              <p className="font-medium">&ldquo;{String(h.hook_text ?? h)}&rdquo;</p>
              {(typeof h.platform === "string" || typeof h.format === "string") && (
                <p className="text-muted-foreground mt-0.5">
                  {typeof h.platform === "string" && <span>{h.platform}</span>}
                  {typeof h.platform === "string" && typeof h.format === "string" && <span> · </span>}
                  {typeof h.format === "string" && <span>{h.format}</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {strengths.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-green-400/70 mb-1 flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" /> Strengths
            </p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {strengths.map((s, i) => <li key={i}>• {s}</li>)}
            </ul>
          </div>
        )}
        {weaknesses.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-red-400/70 mb-1 flex items-center gap-1">
              <ThumbsDown className="h-3 w-3" /> Weaknesses to Exploit
            </p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {weaknesses.map((w, i) => <li key={i}>• {w}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function PlatformCard({ platform }: { platform: Record<string, unknown> }) {
  const name = String(platform.platform ?? "Platform");
  const trendingFormats = (platform.trending_formats ?? []) as string[];
  const contentThemes = (platform.content_themes ?? []) as string[];
  const dos = (platform.dos ?? []) as string[];
  const donts = (platform.donts ?? []) as string[];
  const specs = (platform.ad_specs ?? []) as Record<string, unknown>[];
  const ctr = platform.benchmark_ctr as number | undefined;
  const engagement = platform.benchmark_engagement_rate as number | undefined;
  const postTimes = platform.optimal_posting_times as string | undefined;

  return (
    <div className="rounded-xl border border-border/40 bg-gradient-to-br from-card/80 to-card/40 p-4 space-y-3 hover:border-border/60 transition-colors">
      <div className="flex items-center justify-between">
        <h5 className="font-semibold capitalize">{name}</h5>
        <div className="flex items-center gap-2">
          {ctr !== undefined && (
            <span className="text-xs text-muted-foreground">
              CTR: <span className="font-mono text-green-400">{ctr}%</span>
            </span>
          )}
          {engagement !== undefined && (
            <span className="text-xs text-muted-foreground">
              Eng: <span className="font-mono text-green-400">{engagement}%</span>
            </span>
          )}
        </div>
      </div>

      {trendingFormats.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {trendingFormats.map((f, i) => (
            <Badge key={i} className="bg-green-500/10 text-green-400 border-green-500/20 text-[11px]">{f}</Badge>
          ))}
        </div>
      )}

      {contentThemes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {contentThemes.map((t, i) => (
            <Badge key={i} variant="outline" className="text-[11px]">{t}</Badge>
          ))}
        </div>
      )}

      {specs.length > 0 && (
        <div className="rounded-lg bg-muted/20 p-2 text-xs space-y-1">
          {specs.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-muted-foreground">
              <span className="font-medium text-foreground capitalize">{String(s.format)}</span>
              <span>{String(s.aspect_ratio)}</span>
              {typeof s.max_duration === "number" && s.max_duration > 0 && <span>{s.max_duration}s</span>}
            </div>
          ))}
        </div>
      )}

      {(dos.length > 0 || donts.length > 0) && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          {dos.length > 0 && (
            <div>
              <p className="text-green-400/70 text-[10px] uppercase tracking-wider mb-1">Do&apos;s</p>
              <ul className="text-muted-foreground space-y-0.5">
                {dos.map((d, i) => <li key={i}>✓ {d}</li>)}
              </ul>
            </div>
          )}
          {donts.length > 0 && (
            <div>
              <p className="text-red-400/70 text-[10px] uppercase tracking-wider mb-1">Don&apos;ts</p>
              <ul className="text-muted-foreground space-y-0.5">
                {donts.map((d, i) => <li key={i}>✗ {d}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {postTimes && (
        <p className="text-xs text-muted-foreground">Best times: {postTimes}</p>
      )}
    </div>
  );
}

function AngleCard({ angle }: { angle: Record<string, unknown> }) {
  const name = String(angle.angle_name ?? angle.name ?? angle.angle ?? "Angle");
  const rationale = String(angle.rationale ?? "");
  const emotion = String(angle.target_emotion ?? "");
  const platforms = (angle.best_platforms ?? []) as string[];
  const formats = (angle.suggested_formats ?? []) as string[];
  const funnel = String(angle.funnel_fit ?? "");
  const hook = String(angle.hook_direction ?? "");

  return (
    <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/5 to-transparent p-4 space-y-2.5 hover:border-indigo-500/30 transition-colors">
      <div className="flex items-center justify-between">
        <h5 className="font-semibold">{name}</h5>
        <div className="flex gap-1.5">
          {emotion && (
            <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] capitalize">{emotion}</Badge>
          )}
          {funnel && (
            <Badge variant="outline" className="text-[10px] uppercase">{funnel}</Badge>
          )}
        </div>
      </div>

      {hook && (
        <div className="rounded-lg bg-muted/20 px-3 py-2">
          <p className="text-sm italic">&ldquo;{hook}&rdquo;</p>
        </div>
      )}

      {rationale && (
        <p className="text-xs text-muted-foreground">{rationale}</p>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {platforms.map((p, i) => (
          <Badge key={i} variant="outline" className="text-[10px] capitalize">{p}</Badge>
        ))}
        {formats.map((f, i) => (
          <Badge key={i} className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[10px]">{f}</Badge>
        ))}
      </div>
    </div>
  );
}

function AssetTypeSection({ insights }: { insights: Record<string, unknown> }) {
  const staticImg = insights.static_image as Record<string, unknown> | undefined;
  const video = insights.video_ad as Record<string, unknown> | undefined;
  const email = insights.email_template as Record<string, unknown> | undefined;

  const sections: { icon: typeof Image; label: string; data: Record<string, unknown> }[] = [];
  if (staticImg) sections.push({ icon: Image, label: "Static Image", data: staticImg });
  if (video) sections.push({ icon: Video, label: "Video Ad", data: video });
  if (email) sections.push({ icon: Mail, label: "Email", data: email });

  if (sections.length === 0) return null;

  return (
    <div className="space-y-3">
      {sections.map(({ icon: Icon, label, data: d }) => (
        <div key={label} className="rounded-xl border border-border/40 bg-gradient-to-br from-card/80 to-card/40 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-pink-400" />
            <h5 className="text-sm font-semibold">{label}</h5>
          </div>
          {Array.isArray(d.best_practices) && d.best_practices.length > 0 && (
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {(d.best_practices as string[]).map((bp, i) => <li key={i}>• {bp}</li>)}
            </ul>
          )}
          {Array.isArray(d.visual_patterns) && (d.visual_patterns as string[]).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(d.visual_patterns as string[]).map((v, i) => (
                <Badge key={i} variant="outline" className="text-[10px]">{v}</Badge>
              ))}
            </div>
          )}
          {Array.isArray(d.cta_patterns) && (d.cta_patterns as string[]).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(d.cta_patterns as string[]).map((c, i) => (
                <Badge key={i} className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">{c}</Badge>
              ))}
            </div>
          )}
          {typeof d.hook_timing === "string" && (
            <p className="text-xs text-muted-foreground">Hook timing: <span className="font-mono text-indigo-400">{d.hook_timing}</span></p>
          )}
          {typeof d.script_structure === "string" && d.script_structure && (
            <p className="text-xs text-muted-foreground">{d.script_structure}</p>
          )}
          {Array.isArray(d.sound_trends) && (d.sound_trends as string[]).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(d.sound_trends as string[]).map((s, i) => (
                <Badge key={i} variant="outline" className="text-[10px]">{s}</Badge>
              ))}
            </div>
          )}
          {Array.isArray(d.subject_line_patterns) && (d.subject_line_patterns as string[]).length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Subject Lines</p>
              {(d.subject_line_patterns as string[]).map((s, i) => (
                <p key={i} className="text-xs rounded-lg bg-muted/20 px-2 py-1">{s}</p>
              ))}
            </div>
          )}
          {(typeof d.benchmark_open_rate === "number" || typeof d.benchmark_click_rate === "number") && (
            <div className="flex gap-4 text-xs">
              {typeof d.benchmark_open_rate === "number" && (
                <span className="text-muted-foreground">Open: <span className="font-mono text-green-400">{d.benchmark_open_rate}%</span></span>
              )}
              {typeof d.benchmark_click_rate === "number" && (
                <span className="text-muted-foreground">Click: <span className="font-mono text-green-400">{d.benchmark_click_rate}%</span></span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ResearchReview({ data, onResume, isResuming }: Props) {
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  const competitors = (data.competitor_ad_patterns ?? []) as Record<string, unknown>[];
  const platforms = (data.platform_insights ?? []) as Record<string, unknown>[];
  const audience = data.audience_intelligence as Record<string, unknown> | undefined;
  const assetInsights = data.asset_type_insights as Record<string, unknown> | undefined;
  const seasonal = (data.seasonal_context ?? []) as string[];
  const angles = (data.recommended_angles ?? []) as Record<string, unknown>[];
  const tones = (data.tone_recommendations ?? []) as string[];
  const sources = (data.sources ?? []) as string[];

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
        {competitors.length > 0 && (
          <div>
            <SectionHeader icon={Swords} title="Competitor Analysis" count={competitors.length} color="text-red-400" />
            <div className="space-y-3">
              {competitors.map((c, i) => <CompetitorCard key={i} comp={c} />)}
            </div>
          </div>
        )}

        {/* Platform Insights */}
        {platforms.length > 0 && (
          <div>
            <SectionHeader icon={TrendingUp} title="Platform Insights" count={platforms.length} color="text-green-400" />
            <div className="space-y-3">
              {platforms.map((p, i) => <PlatformCard key={i} platform={p} />)}
            </div>
          </div>
        )}

        {/* Audience Intelligence */}
        {audience && (
          <div>
            <SectionHeader icon={Users} title="Audience Intelligence" color="text-cyan-400" />
            <div className="rounded-xl border border-border/40 bg-gradient-to-br from-card/80 to-card/40 p-4 space-y-3">
              {Array.isArray(audience.purchase_triggers) && (audience.purchase_triggers as string[]).length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-amber-400/70 mb-1.5">Purchase Triggers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(audience.purchase_triggers as string[]).map((t, i) => (
                      <Badge key={i} className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[11px]">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(audience.common_objections) && (audience.common_objections as string[]).length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-red-400/70 mb-1.5">Common Objections</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(audience.common_objections as string[]).map((o, i) => (
                      <Badge key={i} className="bg-red-500/10 text-red-400 border-red-500/20 text-[11px]">{o}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(audience.current_behavior_trends) && (audience.current_behavior_trends as string[]).length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Behavior Trends</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {(audience.current_behavior_trends as string[]).map((b, i) => <li key={i}>• {b}</li>)}
                  </ul>
                </div>
              )}
              {Array.isArray(audience.content_preferences) && (audience.content_preferences as string[]).length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Content Preferences</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(audience.content_preferences as string[]).map((c, i) => (
                      <Badge key={i} variant="outline" className="text-[11px]">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Asset Type Insights */}
        {assetInsights && (
          <div>
            <SectionHeader icon={BarChart3} title="Asset Type Insights" color="text-pink-400" />
            <AssetTypeSection insights={assetInsights} />
          </div>
        )}

        {/* Recommended Angles */}
        {angles.length > 0 && (
          <div>
            <SectionHeader icon={Target} title="Recommended Angles" count={angles.length} color="text-indigo-400" />
            <div className="space-y-3">
              {angles.map((a, i) => <AngleCard key={i} angle={a} />)}
            </div>
          </div>
        )}

        {/* Seasonal + Tone + Sources */}
        <div className="grid grid-cols-1 gap-4">
          {seasonal.length > 0 && (
            <div>
              <SectionHeader icon={Calendar} title="Seasonal Context" color="text-amber-400" />
              <div className="rounded-xl border border-border/40 bg-gradient-to-br from-card/80 to-card/40 p-4">
                <ul className="text-sm text-muted-foreground space-y-1">
                  {seasonal.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>
          )}

          {tones.length > 0 && (
            <div>
              <SectionHeader icon={Mic} title="Tone Recommendations" color="text-purple-400" />
              <div className="flex flex-wrap gap-2">
                {tones.map((t, i) => (
                  <Badge key={i} className="bg-purple-500/10 text-purple-400 border-purple-500/20">{t}</Badge>
                ))}
              </div>
            </div>
          )}

          {sources.length > 0 && (
            <div>
              <SectionHeader icon={ExternalLink} title="Sources" count={sources.length} color="text-muted-foreground" />
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {sources.map((s, i) => <li key={i}>• {s}</li>)}
              </ul>
            </div>
          )}
        </div>

        <Separator className="opacity-20" />

        {/* Feedback */}
        {showFeedback && (
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Add notes for the strategist... e.g. 'Focus more on the Eid gifting angle' or 'Drop TikTok, focus Instagram only'"
            rows={3}
            className="border-border/40"
          />
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 sticky bottom-0 bg-background/80 backdrop-blur-sm py-3 -mx-5 px-5 border-t border-border/20">
          <Button variant="outline" size="sm" onClick={() => setShowFeedback(!showFeedback)}>
            <MessageSquare className="mr-1 h-4 w-4" />
            {showFeedback ? "Hide Notes" : "Add Notes"}
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onResume(false, feedback || "Research rejected")} disabled={isResuming}>
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
