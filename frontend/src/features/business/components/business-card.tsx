"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Building2 } from "lucide-react";
import { formatRelativeTime } from "@/shared/lib/utils";
import type { BusinessResponse } from "../types";

export function BusinessCard({ business }: { business: BusinessResponse }) {
  const completeness = business.bko
    ? ((business.bko as Record<string, unknown>).meta as Record<string, unknown>)?.completeness_score
    : null;
  const score = typeof completeness === "number" ? Math.round(completeness * 100) : null;

  return (
    <Link href={`/businesses/${business.id}`}>
      <Card className="group cursor-pointer border-border/50 bg-card/50 transition-all hover:border-indigo-500/30 hover:bg-card">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold group-hover:text-indigo-400 transition-colors">
                  {business.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {business.industry ?? "No industry"}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              v{business.bko_version}
            </Badge>
          </div>

          {score !== null && (
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">BKO Completeness</span>
                <span className="font-mono text-indigo-400">{score}%</span>
              </div>
              <Progress value={score} className="h-1.5" />
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Updated {formatRelativeTime(business.updated_at)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
