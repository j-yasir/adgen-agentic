"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/shared/lib/utils";
import { Download, Image, Video, Mic } from "lucide-react";
import type { AssetResponse } from "../types";

const ASSET_ICONS: Record<string, typeof Image> = {
  image: Image,
  video: Video,
  voice: Mic,
};

function scoreColor(score: number) {
  if (score >= 8) return "text-green-400";
  if (score >= 6) return "text-amber-400";
  return "text-red-400";
}

export function AssetGallery({
  assets,
  auditScore,
}: {
  assets: AssetResponse[];
  auditScore?: number | null;
}) {
  if (!assets.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Generated Assets</h3>
          <Badge variant="outline">{assets.length} assets</Badge>
          {auditScore && (
            <span className={cn("font-mono text-sm font-bold", scoreColor(auditScore))}>
              Score: {auditScore.toFixed(1)}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm">
          <Download className="mr-1 h-4 w-4" />
          Download All
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {assets.map((asset) => {
          const Icon = ASSET_ICONS[asset.asset_type] ?? Image;

          return (
            <Card key={asset.id} className="group border-border/50 bg-card/50 hover:border-indigo-500/30 transition-colors cursor-pointer overflow-hidden">
              <div className="flex h-32 items-center justify-center bg-muted/20">
                <Icon className="h-8 w-8 text-muted-foreground/50 group-hover:text-indigo-400/50 transition-colors" />
              </div>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{asset.platform}</Badge>
                  <Badge variant="outline" className="text-[10px]">{asset.format}</Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">{asset.asset_type}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <Badge
                    className={cn(
                      "text-[10px]",
                      asset.status === "stored" && "bg-green-500/10 text-green-400",
                      asset.status === "generating" && "bg-indigo-500/10 text-indigo-400",
                      asset.status === "failed" && "bg-red-500/10 text-red-400"
                    )}
                  >
                    {asset.status}
                  </Badge>
                  {asset.storage_url && asset.status === "stored" && (
                    <a href={asset.storage_url} download className="text-muted-foreground hover:text-foreground">
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
