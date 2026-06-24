"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Loader2, MessageSquare, Image, Video, Mic } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type Props = {
  data: Record<string, unknown>;
  campaignId: string;
  onResume: (approved: boolean, feedback?: string) => void;
  isResuming: boolean;
};

function scoreColor(score: number) {
  if (score >= 8) return "text-green-400";
  if (score >= 6) return "text-amber-400";
  return "text-red-400";
}

function scoreBg(score: number) {
  if (score >= 8) return "bg-green-500/10 border-green-500/20";
  if (score >= 6) return "bg-amber-500/10 border-amber-500/20";
  return "bg-red-500/10 border-red-500/20";
}

const ASSET_ICONS: Record<string, typeof Image> = {
  image: Image,
  video: Video,
  voice: Mic,
};

export function AssetReview({ data, onResume, isResuming }: Props) {
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  const assets = data.assets as Record<string, unknown>[] | undefined;
  const avgScore = data.avg_audit_score as number | undefined;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-400" />
            <h3 className="text-lg font-semibold">Asset Review</h3>
          </div>
          {avgScore !== undefined && (
            <div className={cn("rounded-lg border px-3 py-1", scoreBg(avgScore))}>
              <span className="text-xs text-muted-foreground">Avg Score: </span>
              <span className={cn("font-mono font-bold", scoreColor(avgScore))}>
                {avgScore.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        {assets && assets.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {assets.map((asset, i) => {
              const assetType = (asset.asset_type as string) ?? "image";
              const Icon = ASSET_ICONS[assetType] ?? Image;
              const weighted = asset.weighted_avg as number | undefined;

              return (
                <Card key={i} className={cn("border-border/50 bg-card/50")}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted/30">
                        <Icon className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{(asset.platform as string) ?? "?"}</Badge>
                          <Badge variant="outline">{(asset.format as string) ?? "?"}</Badge>
                          <Badge variant="outline" className="capitalize">{assetType}</Badge>
                        </div>

                        {weighted !== undefined && (
                          <div className="flex items-center gap-4 text-xs">
                            <span>
                              Brand:{" "}
                              <span className={scoreColor((asset.brand_score as number) ?? 0)}>
                                {((asset.brand_score as number) ?? 0).toFixed(1)}
                              </span>
                            </span>
                            <span>
                              Hook:{" "}
                              <span className={scoreColor((asset.hook_score as number) ?? 0)}>
                                {((asset.hook_score as number) ?? 0).toFixed(1)}
                              </span>
                            </span>
                            <span>
                              Platform:{" "}
                              <span className={scoreColor((asset.platform_score as number) ?? 0)}>
                                {((asset.platform_score as number) ?? 0).toFixed(1)}
                              </span>
                            </span>
                            <span className={cn("font-bold", scoreColor(weighted))}>
                              Avg: {weighted.toFixed(1)}
                            </span>
                          </div>
                        )}

                        {typeof asset.critique === "string" && (
                          <p className="text-xs text-muted-foreground">
                            {asset.critique as string}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4">
              <pre className="text-xs overflow-auto max-h-[300px]">
                {JSON.stringify(data, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {showFeedback && (
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. 'Redo the TikTok hook, too generic'"
            rows={3}
          />
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setShowFeedback(!showFeedback)}>
            <MessageSquare className="mr-1 h-4 w-4" />
            {showFeedback ? "Hide Notes" : "Add Notes"}
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onResume(false, feedback || "Assets rejected")} disabled={isResuming}>
            Reject
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => onResume(true, feedback || undefined)} disabled={isResuming}>
            {isResuming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Approve Assets
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}
