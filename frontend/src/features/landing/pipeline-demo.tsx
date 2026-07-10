"use client";

import { useEffect, useState, useRef } from "react";
import { Search, Lightbulb, Layers, BarChart3, Check, AlertTriangle, Sparkles } from "lucide-react";

type AgentKey = "researcher" | "strategist" | "producer" | "auditor";

const AGENTS: {
  key: AgentKey;
  label: string;
  Icon: typeof Search;
  textCls: string;
  borderActive: string;
  bgActive: string;
  glow: string;
  dotCls: string;
}[] = [
  { key: "researcher", label: "Researcher", Icon: Search, textCls: "text-indigo-400", borderActive: "border-indigo-400", bgActive: "bg-indigo-500/20", glow: "rgba(99,102,241,0.5)", dotCls: "bg-indigo-400" },
  { key: "strategist", label: "Strategist", Icon: Lightbulb, textCls: "text-violet-400", borderActive: "border-violet-400", bgActive: "bg-violet-500/20", glow: "rgba(139,92,246,0.5)", dotCls: "bg-violet-400" },
  { key: "producer", label: "Producer", Icon: Layers, textCls: "text-pink-400", borderActive: "border-pink-400", bgActive: "bg-pink-500/20", glow: "rgba(236,72,153,0.5)", dotCls: "bg-pink-400" },
  { key: "auditor", label: "Auditor", Icon: BarChart3, textCls: "text-emerald-400", borderActive: "border-emerald-400", bgActive: "bg-emerald-500/20", glow: "rgba(52,211,153,0.5)", dotCls: "bg-emerald-400" },
];

type Step =
  | { type: "log"; agent: AgentKey; text: string; delay: number }
  | { type: "hitl"; label: string; delay: number }
  | { type: "done"; delay: number }
  | { type: "gap"; delay: number };

const STEPS: Step[] = [
  { type: "log", agent: "researcher", text: "[researcher] Scanning 47 active competitor campaigns...", delay: 520 },
  { type: "log", agent: "researcher", text: "[tool:web_search] → Fitness/wellness, UK market", delay: 480 },
  { type: "log", agent: "researcher", text: "[researcher] Instagram CTR benchmark: 2.4% — above avg", delay: 520 },
  { type: "log", agent: "researcher", text: "[tool:audience_intel] → Target: 25-34 urban professionals", delay: 480 },
  { type: "log", agent: "researcher", text: "[researcher] Weakness: competitors use generic lifestyle", delay: 520 },
  { type: "log", agent: "researcher", text: "[researcher] 8 high-signal creative angles identified", delay: 500 },
  { type: "log", agent: "researcher", text: "[researcher] ✓ Research complete", delay: 350 },
  { type: "hitl", label: "Research Review Required", delay: 750 },
  { type: "hitl", label: "Research Review Required", delay: 750 },
  { type: "hitl", label: "Research Review Required", delay: 750 },
  { type: "gap", delay: 450 },
  { type: "log", agent: "strategist", text: "[strategist] Anchoring: 'transformation anxiety' angle", delay: 520 },
  { type: "log", agent: "strategist", text: "[strategist] Platforms: Instagram × TikTok", delay: 480 },
  { type: "log", agent: "strategist", text: "[strategist] Assets: 2× static · 1× video · 1× email", delay: 520 },
  { type: "log", agent: "strategist", text: "[strategist] Tone: bold · emotional · direct", delay: 480 },
  { type: "log", agent: "strategist", text: "[strategist] ✓ Strategy locked", delay: 350 },
  { type: "hitl", label: "Plan Approval Required", delay: 750 },
  { type: "hitl", label: "Plan Approval Required", delay: 750 },
  { type: "hitl", label: "Plan Approval Required", delay: 750 },
  { type: "gap", delay: 450 },
  { type: "log", agent: "producer", text: "[producer] Generating Instagram static_image...", delay: 520 },
  { type: "log", agent: "producer", text: '[tool:gen] Hook: "Stop scrolling. This changes you."', delay: 480 },
  { type: "log", agent: "producer", text: "[producer] Generating TikTok video_ad (0:15)...", delay: 520 },
  { type: "log", agent: "producer", text: "[producer] Generating email_template...", delay: 480 },
  { type: "log", agent: "producer", text: "[producer] ✓ 4 assets produced", delay: 350 },
  { type: "log", agent: "auditor", text: "[auditor] Checking brand safety compliance...", delay: 520 },
  { type: "log", agent: "auditor", text: "[auditor] CTR likelihood estimate: 94 / 100", delay: 480 },
  { type: "log", agent: "auditor", text: "[auditor] Hook strength: 91st percentile", delay: 520 },
  { type: "log", agent: "auditor", text: "[auditor] Platform policy: ✓ Instagram · ✓ TikTok", delay: 480 },
  { type: "log", agent: "auditor", text: "[auditor] ✓ Campaign audit complete — ready to ship", delay: 350 },
  { type: "done", delay: 900 },
  { type: "done", delay: 900 },
  { type: "done", delay: 900 },
  { type: "done", delay: 900 },
  { type: "done", delay: 900 },
];

const AGENT_RANGES: Record<AgentKey, [number, number]> = {
  researcher: [0, 6],
  strategist: [11, 15],
  producer: [20, 24],
  auditor: [25, 29],
};

function getAgentState(key: AgentKey, step: number): "pending" | "active" | "completed" {
  const [start, end] = AGENT_RANGES[key];
  if (step < start) return "pending";
  if (step <= end) return "active";
  return "completed";
}

function getTrackProgress(step: number): number {
  if (step >= 30) return 1;
  if (step >= 25) return 1;
  if (step >= 20) return 0.66 + ((step - 20) / 4) * 0.34;
  if (step >= 15) return 0.66;
  if (step >= 11) return 0.33 + ((step - 11) / 4) * 0.33;
  if (step >= 7) return 0.33;
  return (step / 6) * 0.33;
}

function getVisibleLogs(step: number): { agent: AgentKey; text: string }[] {
  const logs: { agent: AgentKey; text: string }[] = [];
  for (let i = 0; i <= step && i < STEPS.length; i++) {
    const s = STEPS[i];
    if (s.type === "log") logs.push({ agent: s.agent, text: s.text });
  }
  return logs.slice(-6);
}

const LOG_TEXT_CLS: Record<AgentKey, string> = {
  researcher: "text-indigo-400",
  strategist: "text-violet-400",
  producer: "text-pink-400",
  auditor: "text-emerald-400",
};

export function PipelineDemo() {
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    function advance() {
      const current = stepRef.current;
      const s = STEPS[current];
      const delay = s?.delay ?? 500;
      const next = (current + 1) % STEPS.length;
      t = setTimeout(() => {
        stepRef.current = next;
        setStep(next);
        advance();
      }, delay);
    }
    advance();
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [step]);

  const logs = getVisibleLogs(step);
  const currentStep = STEPS[step];
  const hitl = currentStep?.type === "hitl" ? (currentStep as { type: "hitl"; label: string; delay: number }).label : null;
  const done = currentStep?.type === "done";
  const trackPct = getTrackProgress(step);

  return (
    <div className="relative w-full rounded-2xl border border-white/10 bg-[#0d0d1a]/90 backdrop-blur-xl overflow-hidden shadow-2xl ring-1 ring-white/5">
      {/* Top bar */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/6 bg-white/3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
        <span className="ml-3 text-[11px] text-zinc-500 font-mono tracking-wider">adgen · live pipeline</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-green-400/70 font-mono">running</span>
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* Pipeline track + nodes */}
        <div className="relative">
          {/* Track background */}
          <div className="absolute top-5 left-[20px] right-[20px] h-px rounded-full bg-white/10" />
          {/* Track fill — animated */}
          <div
            className="absolute top-5 left-[20px] h-px rounded-full transition-all duration-700 ease-in-out"
            style={{
              width: `calc((100% - 40px) * ${trackPct})`,
              background: "linear-gradient(to right, #6366f1, #8b5cf6, #ec4899, #34d399)",
            }}
          />
          {/* Nodes */}
          <div className="relative flex justify-between">
            {AGENTS.map((agent) => {
              const state = getAgentState(agent.key, step);
              const isActive = state === "active";
              const isComplete = state === "completed";

              return (
                <div key={agent.key} className="flex flex-col items-center gap-1.5">
                  <div
                    className={[
                      "relative flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-all duration-500",
                      isActive ? `${agent.bgActive} ${agent.borderActive}` : isComplete ? "bg-emerald-500/15 border-emerald-500/50" : "bg-white/4 border-white/10",
                    ].join(" ")}
                    style={isActive ? { boxShadow: `0 0 20px 2px ${agent.glow}` } : {}}
                  >
                    {isComplete ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <agent.Icon className={["h-4 w-4 transition-colors duration-300", isActive ? agent.textCls : "text-white/20"].join(" ")} />
                    )}
                    {isActive && (
                      <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ${agent.dotCls} ring-2 ring-[#0d0d1a]`} />
                    )}
                  </div>
                  <span className={["text-[10px] font-medium transition-colors duration-300", isActive ? agent.textCls : isComplete ? "text-emerald-400/60" : "text-white/20"].join(" ")}>
                    {agent.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Log stream */}
        <div
          ref={logContainerRef}
          className="rounded-xl bg-black/40 border border-white/5 p-3 h-[140px] overflow-hidden font-mono text-[11px] leading-[1.7]"
        >
          {logs.length === 0 ? (
            <span className="text-white/20">Waiting for input...</span>
          ) : (
            <div className="flex flex-col">
              {logs.map((log, i) => {
                const isLast = i === logs.length - 1;
                const isTool = log.text.startsWith("[tool");
                const isDoneLog = log.text.includes("✓");
                return (
                  <div key={i} className={["transition-opacity duration-300", isLast ? "opacity-100" : "opacity-40"].join(" ")}>
                    {isTool ? (
                      <span className="text-cyan-400/80">{log.text}</span>
                    ) : isDoneLog ? (
                      <span className="text-emerald-400">{log.text}</span>
                    ) : (
                      <span className={LOG_TEXT_CLS[log.agent]}>{log.text}</span>
                    )}
                  </div>
                );
              })}
              {!hitl && !done && <span className="inline-block h-3 w-1.5 bg-white/50 animate-pulse mt-0.5" />}
            </div>
          )}
        </div>

        {/* HITL banner */}
        {hitl && (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/8 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-amber-300">{hitl}</p>
              <p className="text-[10px] text-amber-400/50">Awaiting your decision before proceeding</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <div className="h-6 w-12 rounded-md border border-white/10 bg-white/5" />
              <div className="h-6 w-16 rounded-md border border-amber-400/40 bg-amber-400/15" />
            </div>
          </div>
        )}

        {/* Done */}
        {done && (
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[11px] font-semibold text-emerald-400">Campaign complete · 4 assets ready</span>
              <span className="ml-auto font-mono font-bold text-emerald-400 text-[13px]">94/100</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { platform: "Instagram", format: "Static", grad: "from-indigo-500/25 to-violet-500/10", badge: "text-indigo-300 bg-indigo-500/15" },
                { platform: "TikTok", format: "Video 0:15", grad: "from-pink-500/25 to-rose-500/10", badge: "text-pink-300 bg-pink-500/15" },
                { platform: "Email", format: "Template", grad: "from-cyan-500/25 to-blue-500/10", badge: "text-cyan-300 bg-cyan-500/15" },
              ].map((c) => (
                <div key={c.platform} className={`rounded-lg bg-gradient-to-br ${c.grad} border border-white/8 p-2 text-center`}>
                  <div className={`inline-block rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${c.badge} mb-1`}>{c.platform}</div>
                  <p className="text-[9px] text-white/40">{c.format}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
