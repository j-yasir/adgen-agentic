"use client";

import Link from "next/link";
import { formatRelativeTime } from "@/shared/lib/utils";
import { ArrowRight, Megaphone } from "lucide-react";
import type { BusinessResponse } from "../types";

const STRIP_COLORS = [
  "from-indigo-500 to-violet-500",
  "from-violet-500 to-purple-500",
  "from-pink-500 to-rose-500",
  "from-emerald-500 to-teal-500",
];

export function BusinessCard({
  business,
  index = 0,
}: {
  business: BusinessResponse;
  index?: number;
}) {
  const stripGrad = STRIP_COLORS[index % STRIP_COLORS.length];

  const completeness = business.bko
    ? ((business.bko as Record<string, unknown>).meta as Record<string, unknown>)
        ?.completeness_score
    : null;
  const score =
    typeof completeness === "number" ? Math.round(completeness * 100) : null;

  const initials = business.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link href={`/businesses/${business.id}`} className="group block">
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 overflow-hidden">
        {/* Top colour strip */}
        <div className={`h-1 w-full bg-gradient-to-r ${stripGrad}`} />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${stripGrad} text-white text-sm font-bold shadow-sm`}
              >
                {initials}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight">
                  {business.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {business.industry ?? "No industry set"}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
              BKO v{business.bko_version}
            </span>
          </div>

          {/* BKO completeness */}
          {score !== null && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400">BKO completeness</span>
                <span className="font-semibold text-indigo-600 font-mono">{score}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${stripGrad} rounded-full transition-all`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Updated {formatRelativeTime(business.updated_at)}
            </span>
            <div className="flex items-center gap-1 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs font-medium">Open</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function AddBusinessCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group w-full bg-white rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all duration-200 p-5 text-left"
    >
      <div className="flex flex-col items-center justify-center gap-3 py-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
          <span className="text-2xl font-light text-indigo-400 leading-none">+</span>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-600 group-hover:text-indigo-600 transition-colors">
            Add Business
          </p>
          <p className="text-xs text-slate-400 mt-0.5">URL import or manual wizard</p>
        </div>
      </div>
    </button>
  );
}
