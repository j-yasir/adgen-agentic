"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/shared/providers/auth-provider";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PipelineDemo } from "./pipeline-demo";
import {
  ArrowRight,
  Zap,
  Eye,
  Shield,
  Search,
  Lightbulb,
  Layers,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Sparkles,
  Mail,
  Play,
  Image,
  Star,
} from "lucide-react";

// ─── Auth redirect ────────────────────────────────────────────────────────────

function AuthRedirect() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading && user) router.push("/businesses");
  }, [user, isLoading, router]);
  return null;
}

// ─── Count-up on scroll ───────────────────────────────────────────────────────

function CountUp({ to, suffix = "", duration = 1800 }: { to: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        function frame(now: number) {
          const pct = Math.min((now - start) / duration, 1);
          setCount(Math.round((1 - Math.pow(1 - pct, 3)) * to));
          if (pct < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, duration]);
  return <span ref={ref}>{count}{suffix}</span>;
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function LandingNav() {
  const { user, isLoading } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className={[
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-slate-200 bg-white/95 backdrop-blur-xl shadow-sm"
          : "bg-transparent",
      ].join(" ")}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <div className={["flex h-8 w-8 items-center justify-center rounded-lg transition-colors", scrolled ? "bg-indigo-100 border border-indigo-200" : "bg-white/15 border border-white/20"].join(" ")}>
            <Sparkles className={["h-4 w-4 transition-colors", scrolled ? "text-indigo-600" : "text-white"].join(" ")} />
          </div>
          <span className={["text-lg font-bold tracking-tight transition-colors", scrolled ? "text-slate-900" : "text-white"].join(" ")}>
            Ad<span className={scrolled ? "text-indigo-600" : "text-indigo-300"}>Gen</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {[
            { href: "#how-it-works", label: "How it Works" },
            { href: "#control", label: "Human Control" },
            { href: "#output", label: "Output" },
          ].map(({ href, label }) => (
            <a key={href} href={href} className={["text-sm transition-colors", scrolled ? "text-slate-500 hover:text-slate-900" : "text-white/70 hover:text-white"].join(" ")}>
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {!isLoading && user ? (
            <Link href="/businesses">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white border-0 shadow-lg">
                Dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm" className={["transition-colors", scrolled ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100" : "text-white/80 hover:text-white hover:bg-white/10"].join(" ")}>
                  Sign In
                </Button>
              </Link>
              <Link href="/login">
                <Button size="sm" className="bg-white text-indigo-700 hover:bg-indigo-50 border-0 shadow-lg font-semibold">
                  Get Started Free
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #1e1048 0%, #3b1078 25%, #5b21b6 55%, #7c3aed 80%, #a855f7 100%)",
      }}
    >
      {/* Noise overlay for depth */}
      <div className="pointer-events-none absolute inset-0 opacity-30"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.15'/%3E%3C/svg%3E\")" }}
      />
      {/* Radial light burst */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 70% 50% at 70% 40%, rgba(167,139,250,0.3) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 20% 60%, rgba(99,102,241,0.25) 0%, transparent 60%)" }}
      />
      {/* Grid lines */}
      <div className="pointer-events-none absolute inset-0 opacity-10"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "72px 72px" }}
      />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 lg:grid-cols-2 gap-12 px-6 pt-24 pb-16 w-full items-center">
        {/* Left — copy */}
        <div className="space-y-7">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            <Zap className="h-3 w-3 text-yellow-300" />
            4 AI Agents · 3 Human Checkpoints · 96 seconds
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.05] tracking-tight text-white">
              Brief to campaign.
              <br />
              <span className="relative">
                <span
                  className="relative z-10 bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(to right, #fbbf24, #f9a8d4, #c4b5fd)" }}
                >
                  In 96 seconds.
                </span>
              </span>
            </h1>
            <p className="text-lg text-white/70 leading-relaxed max-w-lg">
              4 specialized AI agents research your market, write your strategy, and produce
              campaign-ready creatives — with human approval gates so you stay in control at every step.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/login">
              <Button size="lg" className="bg-white text-indigo-700 hover:bg-indigo-50 border-0 h-13 px-8 text-base font-bold shadow-xl shadow-black/20">
                Launch Your First Campaign
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="outline" size="lg" className="h-13 px-8 text-base border-white/25 text-white hover:bg-white/10 hover:border-white/40 bg-transparent">
                See How It Works
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>

          {/* Trust */}
          <div className="flex flex-wrap gap-5 text-sm text-white/60">
            {["No credit card required", "Full reasoning visible", "You approve every asset"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400/80" />
                {t}
              </span>
            ))}
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex -space-x-2">
              {["bg-indigo-400", "bg-violet-400", "bg-pink-400", "bg-amber-400", "bg-emerald-400"].map((c, i) => (
                <div key={i} className={`h-8 w-8 rounded-full ${c} border-2 border-white/20 flex items-center justify-center text-xs font-bold text-white`}>
                  {["M", "A", "S", "K", "R"][i]}
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />)}
              </div>
              <p className="text-xs text-white/50">Loved by marketing teams</p>
            </div>
          </div>
        </div>

        {/* Right — Pipeline Demo */}
        <div className="relative">
          <div className="absolute -inset-8 rounded-3xl opacity-40 blur-3xl"
            style={{ background: "radial-gradient(ellipse at center, rgba(167,139,250,0.4), transparent 70%)" }}
          />
          <PipelineDemo />
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40">
        <span className="text-[9px] uppercase tracking-[0.2em]">Scroll</span>
        <ChevronDown className="h-4 w-4 animate-bounce" />
      </div>

      {/* Bottom fade to white */}
      <div className="pointer-events-none absolute bottom-0 inset-x-0 h-24"
        style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.08))" }}
      />
    </section>
  );
}

// ─── Metrics strip ─────────────────────────────────────────────────────────────

const METRICS = [
  { value: 96, suffix: "s", label: "Brief to variants", sub: "average end-to-end", color: "text-indigo-600" },
  { value: 4, suffix: "", label: "Specialized agents", sub: "working in sequence", color: "text-violet-600" },
  { value: 3, suffix: "", label: "Human checkpoints", sub: "you decide what ships", color: "text-pink-600" },
  { value: 0, suffix: " black boxes", label: "Zero opacity", sub: "full reasoning visible", color: "text-emerald-600" },
];

function MetricsStrip() {
  return (
    <section className="bg-white border-b border-slate-100">
      <div className="mx-auto max-w-7xl grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100">
        {METRICS.map((m, i) => (
          <div key={i} className="flex flex-col items-center py-10 px-6 text-center gap-1">
            <p className={`text-4xl font-black ${m.color}`}>
              <CountUp to={m.value} suffix={m.suffix} />
            </p>
            <p className="text-sm font-semibold text-slate-800">{m.label}</p>
            <p className="text-xs text-slate-400">{m.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── How it thinks ─────────────────────────────────────────────────────────────

const RSPA_AGENTS = [
  {
    key: "researcher",
    num: "01",
    label: "Researcher",
    tagline: "Knows your market before writing a word.",
    Icon: Search,
    gradient: "from-indigo-500 to-indigo-600",
    lightBg: "bg-indigo-50",
    border: "border-indigo-100",
    accent: "text-indigo-600",
    badgeBg: "bg-indigo-100 text-indigo-700",
    ringColor: "ring-indigo-100",
    points: [
      "Scans 50+ competitor campaigns per brief",
      "Pulls platform-specific CTR benchmarks",
      "Maps audience psychology & purchase triggers",
      "Identifies creative gaps competitors miss",
    ],
    output: '[researcher] Weakness: generic lifestyle dominates → scarcity hook opportunity',
    outputBg: "bg-indigo-50 border-indigo-100 text-indigo-700",
  },
  {
    key: "strategist",
    num: "02",
    label: "Strategist",
    tagline: "Turns research into a blueprint, not a prompt.",
    Icon: Lightbulb,
    gradient: "from-violet-500 to-violet-600",
    lightBg: "bg-violet-50",
    border: "border-violet-100",
    accent: "text-violet-600",
    badgeBg: "bg-violet-100 text-violet-700",
    ringColor: "ring-violet-100",
    points: [
      "Picks the highest-signal creative angle",
      "Defines tone, hook formula & messaging pillars",
      "Plans exact assets per platform & format",
      "Creates a brief the Producer can execute precisely",
    ],
    output: '[strategist] Angle: "transformation anxiety" · Tone: bold/emotional · 4 assets',
    outputBg: "bg-violet-50 border-violet-100 text-violet-700",
  },
  {
    key: "producer",
    num: "03",
    label: "Producer",
    tagline: "Generates on-brief. Not just on-prompt.",
    Icon: Layers,
    gradient: "from-pink-500 to-rose-500",
    lightBg: "bg-pink-50",
    border: "border-pink-100",
    accent: "text-pink-600",
    badgeBg: "bg-pink-100 text-pink-700",
    ringColor: "ring-pink-100",
    points: [
      "Executes the Strategist's asset brief exactly",
      "Produces static images, video scripts & emails",
      "Generates multiple variants per asset",
      "Tailors copy & visuals per platform spec",
    ],
    output: '[producer] Instagram static · TikTok 0:15 · Email template — all on-brief',
    outputBg: "bg-pink-50 border-pink-100 text-pink-700",
  },
  {
    key: "auditor",
    num: "04",
    label: "Auditor",
    tagline: "Scores every asset before it leaves the system.",
    Icon: BarChart3,
    gradient: "from-emerald-500 to-teal-500",
    lightBg: "bg-emerald-50",
    border: "border-emerald-100",
    accent: "text-emerald-600",
    badgeBg: "bg-emerald-100 text-emerald-700",
    ringColor: "ring-emerald-100",
    points: [
      "Estimates CTR likelihood vs platform benchmarks",
      "Checks brand safety & policy compliance",
      "Scores hook strength against proven formulas",
      "Flags anything below threshold for review",
    ],
    output: '[auditor] CTR: 94/100 · Hook: 91st percentile · Policy: ✓ pass · Ready',
    outputBg: "bg-emerald-50 border-emerald-100 text-emerald-700",
  },
];

function HowItThinks() {
  return (
    <section id="how-it-works" className="py-28 bg-slate-50">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-xs font-semibold text-violet-700">
            The RSPA Intelligence Loop
          </div>
          <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            Four agents. One mission.
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto text-lg leading-relaxed">
            Each agent is a specialist. Together they do what no single prompt
            — and no human team — can do in under two minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {RSPA_AGENTS.map((agent) => (
            <div
              key={agent.key}
              className={`group relative rounded-2xl border ${agent.border} bg-white p-7 space-y-5 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5`}
            >
              {/* Colored top strip */}
              <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${agent.gradient}`} />

              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${agent.gradient} shadow-lg`}>
                  <agent.Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${agent.accent}`}>
                      Agent {agent.num}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{agent.label}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{agent.tagline}</p>
                </div>
              </div>

              <ul className="space-y-2.5">
                {agent.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${agent.accent} opacity-80`} />
                    {p}
                  </li>
                ))}
              </ul>

              <div className={`rounded-xl border ${agent.outputBg} px-3 py-2.5 font-mono text-[11px] leading-relaxed`}>
                {agent.output}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── HITL section ─────────────────────────────────────────────────────────────

const CHECKPOINTS = [
  {
    step: "01",
    title: "Research Review",
    description: "Before strategy begins, you review the full market analysis — competitor patterns, platform benchmarks, audience intelligence. Add notes or reject and redo.",
    icon: Search,
    gradient: "from-indigo-500 to-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-100",
    accent: "text-indigo-600",
  },
  {
    step: "02",
    title: "Plan Approval",
    description: "Before a single asset is created, you approve the campaign blueprint. Creative angle, messaging pillars, tone, and exact asset plan — all yours to shape.",
    icon: Lightbulb,
    gradient: "from-violet-500 to-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-100",
    accent: "text-violet-600",
  },
  {
    step: "03",
    title: "Asset Review",
    description: "Every produced asset is audited and scored. You see the reasoning behind each score before deciding what ships. Nothing goes out without your sign-off.",
    icon: Shield,
    gradient: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    accent: "text-emerald-600",
  },
];

function HitlSection() {
  return (
    <section id="control" className="py-28 bg-white">
      <div className="mx-auto max-w-7xl px-6 grid lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-700">
            <Eye className="h-3 w-3" />
            Full Human Control
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
              AI power.
              <br />
              <span className="text-amber-500">Your judgment.</span>
            </h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Blind AI generation is a liability. Every strategic decision passes through
              your hands before it shapes what gets built. Three gates. Three moments
              to redirect, refine, or reject.
            </p>
          </div>
          <div className="space-y-2">
            {["Review the full market analysis before strategy starts", "Approve the creative blueprint before production", "Inspect every scored asset before it ships"].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-slate-600">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                  {i + 1}
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {CHECKPOINTS.map((cp) => (
            <div key={cp.step} className={`relative group rounded-2xl border ${cp.border} bg-white p-5 flex gap-4 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 overflow-hidden`}>
              <div className={`absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b ${cp.gradient}`} />
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${cp.gradient} shadow-md`}>
                <cp.icon className="h-5 w-5 text-white" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${cp.accent}`}>Checkpoint {cp.step}</span>
                </div>
                <h4 className="font-bold text-slate-900">{cp.title}</h4>
                <p className="text-sm text-slate-500 leading-relaxed">{cp.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Output gallery ────────────────────────────────────────────────────────────

function AdMockup({
  platform,
  format,
  score,
  hook,
  cta,
  gradient,
  border,
  badgeCls,
  scoreCls,
  Icon,
}: {
  platform: string;
  format: string;
  score: number;
  hook: string;
  cta: string;
  gradient: string;
  border: string;
  badgeCls: string;
  scoreCls: string;
  Icon: typeof Play;
}) {
  return (
    <div className={`rounded-2xl border ${border} bg-white overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}>
      {/* Visual */}
      <div className={`relative h-44 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center shadow-lg">
            <Icon className="h-7 w-7 text-white" />
          </div>
        </div>
        <div className={`absolute top-3 right-3 rounded-full px-2.5 py-1 text-[11px] font-bold bg-white shadow-sm ${scoreCls}`}>
          {score}/100
        </div>
        <div className="absolute top-3 left-3 rounded-lg px-2.5 py-1 text-[10px] font-semibold bg-white/90 text-slate-700 shadow-sm">
          {platform}
        </div>
      </div>
      {/* Copy */}
      <div className="p-5 space-y-3">
        <p className="text-sm font-semibold text-slate-800 leading-snug">{hook}</p>
        <div className={`inline-block rounded-lg px-3 py-1.5 text-xs font-semibold border ${badgeCls}`}>
          {cta}
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-[10px] text-slate-400">{format}</span>
          <span className={`text-[10px] font-bold ${scoreCls}`}>Audit ✓</span>
        </div>
      </div>
    </div>
  );
}

function OutputGallery() {
  return (
    <section id="output" className="py-28 bg-slate-50">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-4 py-1.5 text-xs font-semibold text-pink-700">
            <Sparkles className="h-3 w-3" />
            Real Output
          </div>
          <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            See what gets built.
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto text-lg leading-relaxed">
            Not mockups. Not examples. Actual assets scored and approved by the pipeline —
            ready to ship.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <AdMockup
            platform="Instagram"
            format="Static Image · Feed"
            score={94}
            hook='"Stop waiting for the perfect moment. Your transformation starts with one decision."'
            cta="Shop Now →"
            gradient="from-indigo-400 via-violet-500 to-purple-600"
            border="border-indigo-100"
            badgeCls="border-indigo-200 bg-indigo-50 text-indigo-700"
            scoreCls="text-indigo-600"
            Icon={Image}
          />
          <AdMockup
            platform="TikTok"
            format="Video Ad · 0:15"
            score={91}
            hook='"POV: You finally stopped scrolling and started changing. Here&apos;s how we make it stupid easy."'
            cta="Watch now"
            gradient="from-pink-400 via-rose-500 to-red-500"
            border="border-pink-100"
            badgeCls="border-pink-200 bg-pink-50 text-pink-700"
            scoreCls="text-pink-600"
            Icon={Play}
          />
          <AdMockup
            platform="Email"
            format="Newsletter · HTML"
            score={89}
            hook='"Don&apos;t miss this: the offer 3,000 people took last week is still open — but not for long."'
            cta="Claim your spot"
            gradient="from-cyan-400 via-teal-500 to-emerald-500"
            border="border-cyan-100"
            badgeCls="border-cyan-200 bg-cyan-50 text-cyan-700"
            scoreCls="text-cyan-600"
            Icon={Mail}
          />
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "CTR Likelihood", desc: "Estimated click-through vs platform benchmark", color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
            { label: "Hook Strength", desc: "Percentile ranking vs 10k+ tested hook formulas", color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100" },
            { label: "Policy Compliance", desc: "Platform ad policy check before anything leaves", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
          ].map((item) => (
            <div key={item.label} className={`rounded-xl border ${item.border} ${item.bg} p-5 text-center`}>
              <p className={`text-sm font-bold ${item.color} mb-1`}>{item.label}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ─────────────────────────────────────────────────────────────────

function FinalCta() {
  return (
    <section
      className="relative py-28 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1e1048 0%, #3b1078 30%, #5b21b6 60%, #7c3aed 85%, #a855f7 100%)" }}
    >
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(167,139,250,0.25), transparent 70%)" }}
      />
      <div className="pointer-events-none absolute inset-0 opacity-20"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "72px 72px" }}
      />

      <div className="relative mx-auto max-w-3xl px-6 text-center space-y-8">
        <div className="space-y-4">
          <p className="text-sm font-bold text-violet-300 uppercase tracking-[0.2em]">
            Ready when you are
          </p>
          <h2 className="text-4xl lg:text-6xl font-black tracking-tight text-white">
            Your next campaign
            <br />
            is 3 minutes away.
          </h2>
          <p className="text-white/60 text-lg max-w-lg mx-auto leading-relaxed">
            Write a brief. Watch 4 agents go to work. Review, approve, and ship — all inside one platform.
          </p>
        </div>

        <Link href="/login">
          <Button size="lg" className="bg-white text-indigo-700 hover:bg-indigo-50 border-0 h-14 px-10 text-base font-bold shadow-2xl shadow-black/30">
            Launch Your First Campaign
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>

        <p className="text-xs text-white/30">No credit card. No setup. Cancel any time.</p>
      </div>
    </section>
  );
}

// ─── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-white border-t border-slate-100 py-10">
      <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 border border-indigo-200">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
          </div>
          <span className="font-bold text-sm text-slate-900">
            Ad<span className="text-indigo-600">Gen</span>
          </span>
        </div>
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} AdGen. AI-powered ad generation platform.</p>
        <div className="flex gap-6 text-xs text-slate-400">
          <Link href="/login" className="hover:text-slate-700 transition-colors">Sign In</Link>
          <Link href="/login" className="hover:text-slate-700 transition-colors">Get Started</Link>
        </div>
      </div>
    </footer>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <AuthRedirect />
      <LandingNav />
      <HeroSection />
      <MetricsStrip />
      <HowItThinks />
      <HitlSection />
      <OutputGallery />
      <FinalCta />
      <Footer />
    </div>
  );
}
