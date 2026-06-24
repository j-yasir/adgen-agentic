"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lightbulb, Loader2, MessageSquare } from "lucide-react";

type Props = {
  data: Record<string, unknown>;
  onResume: (approved: boolean, feedback?: string) => void;
  isResuming: boolean;
};

export function StrategyReview({ data, onResume, isResuming }: Props) {
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  const theme = data.campaign_theme as string | undefined;
  const emotion = data.target_emotion as string | undefined;
  const assetPlan = data.asset_plan as Record<string, unknown>[] | undefined;
  const avoid = data.what_to_avoid as string[] | undefined;
  const keyMessages = data.key_messages as string[] | undefined;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-purple-400" />
          <h3 className="text-lg font-semibold">Strategy Plan</h3>
        </div>

        {(theme || emotion) && (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4">
              {theme && <p className="font-semibold text-lg">&ldquo;{theme}&rdquo;</p>}
              {emotion && <p className="text-sm text-muted-foreground mt-1">Target Emotion: {emotion}</p>}
            </CardContent>
          </Card>
        )}

        {assetPlan && assetPlan.length > 0 && (
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Asset Plan ({assetPlan.length} assets)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {assetPlan.map((asset, i) => (
                <div key={i} className="rounded-lg border border-border/30 p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{(asset.platform as string) ?? "?"}</Badge>
                    <Badge variant="outline">{(asset.format as string) ?? "?"}</Badge>
                    <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                      {(asset.funnel_stage as string) ?? "?"}
                    </Badge>
                  </div>
                  {typeof asset.hook === "string" && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Hook:</span>{" "}
                      <span className="font-medium">&ldquo;{asset.hook}&rdquo;</span>
                    </p>
                  )}
                  {typeof asset.cta === "string" && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">CTA:</span> {asset.cta}
                    </p>
                  )}
                  {typeof asset.visual_brief === "string" && (
                    <p className="text-xs text-muted-foreground">{asset.visual_brief}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {keyMessages && keyMessages.length > 0 && (
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Key Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {keyMessages.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </CardContent>
          </Card>
        )}

        {avoid && avoid.length > 0 && (
          <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-red-400">What to Avoid</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-300/80">
                {avoid.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </CardContent>
          </Card>
        )}

        {!assetPlan && !theme && (
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
            placeholder="e.g. 'The TikTok hook is too generic, make it more specific'"
            rows={3}
          />
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setShowFeedback(!showFeedback)}>
            <MessageSquare className="mr-1 h-4 w-4" />
            {showFeedback ? "Hide Notes" : "Add Notes"}
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onResume(false, feedback || "Strategy rejected")} disabled={isResuming}>
            Reject & Redo
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => onResume(true, feedback || undefined)} disabled={isResuming}>
            {isResuming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Approve Strategy
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}
