"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/shared/providers/auth-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Sparkles,
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  Search,
  Lightbulb,
  Layers,
  BarChart3,
  Zap,
  Star,
  Check,
} from "lucide-react";

// ─── Left brand panel ─────────────────────────────────────────────────────────

const VALUE_PROPS = [
  { icon: Search, text: "Market research done before the first word is written" },
  { icon: Lightbulb, text: "Strategy and brief approved by you before production" },
  { icon: Layers, text: "Platform-tailored creatives across every format" },
  { icon: BarChart3, text: "Every asset scored and audited before it ships" },
];

const AGENTS = [
  { label: "Researcher", color: "#6366f1", done: true },
  { label: "Strategist", color: "#8b5cf6", done: true },
  { label: "Producer", color: "#ec4899", done: true },
  { label: "Auditor", color: "#34d399", done: true },
];

function LeftPanel() {
  return (
    <div
      className="hidden lg:flex lg:w-[46%] flex-col justify-between p-12 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #1e1048 0%, #3b1078 25%, #5b21b6 55%, #7c3aed 80%, #a855f7 100%)",
      }}
    >
      {/* Noise */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.15'/%3E%3C/svg%3E\")",
        }}
      />
      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      {/* Glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 30% 30%, rgba(167,139,250,0.25), transparent 60%)",
        }}
      />

      {/* Logo */}
      <div className="relative flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 border border-white/20">
          <Sparkles className="h-4.5 w-4.5 text-white" />
        </div>
        <span className="text-xl font-bold text-white tracking-tight">
          Ad<span className="text-indigo-300">Gen</span>
        </span>
      </div>

      {/* Main content */}
      <div className="relative space-y-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/80">
            <Zap className="h-3 w-3 text-yellow-300" />
            96 seconds. Brief to campaign.
          </div>
          <h2 className="text-4xl font-black text-white leading-[1.1] tracking-tight">
            The ad platform
            <br />
            that actually
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(to right, #fbbf24, #f9a8d4, #c4b5fd)",
              }}
            >
              thinks first.
            </span>
          </h2>
          <p className="text-white/60 text-base leading-relaxed max-w-sm">
            4 AI agents. 3 human checkpoints. Full reasoning visible at every step.
          </p>
        </div>

        {/* Value props */}
        <ul className="space-y-3">
          {VALUE_PROPS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm text-white/75">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 mt-0.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              {text}
            </li>
          ))}
        </ul>

        {/* Mini pipeline result card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono text-white/40 tracking-wider">adgen · pipeline complete</span>
          </div>

          {/* Agent nodes */}
          <div className="relative">
            <div className="absolute top-4 left-4 right-4 h-px bg-white/10 rounded-full" />
            <div
              className="absolute top-4 left-4 right-4 h-px rounded-full"
              style={{ background: "linear-gradient(to right, #6366f1, #8b5cf6, #ec4899, #34d399)" }}
            />
            <div className="relative flex justify-between">
              {AGENTS.map((a) => (
                <div key={a.label} className="flex flex-col items-center gap-1.5">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg border-2"
                    style={{
                      borderColor: a.color,
                      background: `${a.color}20`,
                    }}
                  >
                    <Check className="h-3.5 w-3.5" style={{ color: a.color }} />
                  </div>
                  <span className="text-[9px] text-white/40">{a.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Result */}
          <div className="flex items-center justify-between pt-1 border-t border-white/8">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-white/80">Campaign ready · 4 assets</p>
              <p className="text-[10px] text-white/40">Instagram · TikTok · Email</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-emerald-400">94</p>
              <p className="text-[9px] text-white/40 -mt-0.5">Audit score</p>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonial */}
      <div className="relative space-y-3">
        <div className="flex gap-0.5">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
          ))}
        </div>
        <p className="text-white/70 text-sm leading-relaxed italic max-w-xs">
          &ldquo;This completely changed how we approach paid campaigns. The research
          alone is worth it.&rdquo;
        </p>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-xs font-bold text-white">
            M
          </div>
          <div>
            <p className="text-xs font-semibold text-white/80">Maya Chen</p>
            <p className="text-[10px] text-white/40">Marketing Director, Lumio</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// Shared input overrides for light context (html has `dark` class globally)
const inputCls =
  "h-11 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm rounded-xl focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/20 dark:bg-white dark:border-slate-200 dark:text-slate-900 dark:placeholder:text-slate-400";

// ─── Auth form ─────────────────────────────────────────────────────────────────

export function AuthForm() {
  const { login, signup } = useAuth();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "" });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login(loginForm.email, loginForm.password);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await signup(signupForm.name, signupForm.email, signupForm.password);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      <LeftPanel />

      {/* Right — form panel */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-16">
        {/* Back link */}
        <Link
          href="/"
          className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Home
        </Link>

        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo (hidden on desktop — left panel shows it) */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 border border-indigo-200">
              <Sparkles className="h-4 w-4 text-indigo-600" />
            </div>
            <span className="text-lg font-bold text-slate-900">
              Ad<span className="text-indigo-600">Gen</span>
            </span>
          </div>

          {/* Heading */}
          <div className="space-y-1.5">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {tab === "login" ? "Welcome back." : "Create your account."}
            </h1>
            <p className="text-slate-500 text-sm">
              {tab === "login"
                ? "Sign in to your AdGen workspace."
                : "Free to start. No credit card required."}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {(["login", "signup"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={[
                  "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200",
                  tab === t
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                {t === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Login form */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-5">
              <Field id="login-email" label="Email address">
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  required
                  className={inputCls}
                />
              </Field>

              <Field id="login-password" label="Password" hint="Forgot password?">
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPw ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 text-base font-semibold border-0 text-white shadow-lg shadow-indigo-500/25 disabled:opacity-60"
                style={{
                  background: isSubmitting
                    ? "#818cf8"
                    : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                }}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  "Sign In →"
                )}
              </Button>

              <p className="text-center text-sm text-slate-500">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setTab("signup")}
                  className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Sign up free
                </button>
              </p>
            </form>
          )}

          {/* Signup form */}
          {tab === "signup" && (
            <form onSubmit={handleSignup} className="space-y-5">
              <Field id="signup-name" label="Full name">
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="Alex Johnson"
                  autoComplete="name"
                  value={signupForm.name}
                  onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                  required
                  className={inputCls}
                />
              </Field>

              <Field id="signup-email" label="Work email">
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  value={signupForm.email}
                  onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                  required
                  className={inputCls}
                />
              </Field>

              <Field id="signup-password" label="Password" hint="Min 8 characters">
                <div className="relative">
                  <Input
                    id="signup-password"
                    type={showPw ? "text" : "password"}
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                    value={signupForm.password}
                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                    required
                    minLength={8}
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              {/* Password strength hints */}
              {signupForm.password.length > 0 && (
                <div className="flex gap-1">
                  {[4, 8, 12].map((threshold, i) => (
                    <div
                      key={i}
                      className={[
                        "h-1 flex-1 rounded-full transition-colors duration-300",
                        signupForm.password.length >= threshold
                          ? i === 0 ? "bg-red-400" : i === 1 ? "bg-amber-400" : "bg-emerald-400"
                          : "bg-slate-200",
                      ].join(" ")}
                    />
                  ))}
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 text-base font-semibold border-0 text-white shadow-lg shadow-indigo-500/25 disabled:opacity-60"
                style={{
                  background: isSubmitting
                    ? "#818cf8"
                    : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                }}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  "Create Free Account →"
                )}
              </Button>

              {/* Perks */}
              <div className="grid grid-cols-1 gap-2 pt-1">
                {[
                  "Free to start, no credit card",
                  "Full pipeline access from day one",
                  "Cancel any time",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-slate-500">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>

              <p className="text-center text-sm text-slate-500">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setTab("login")}
                  className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}

          {/* Terms */}
          <p className="text-center text-xs text-slate-400 leading-relaxed">
            By continuing, you agree to AdGen&apos;s{" "}
            <span className="text-slate-500 underline underline-offset-2 cursor-pointer">Terms of Service</span>{" "}
            and{" "}
            <span className="text-slate-500 underline underline-offset-2 cursor-pointer">Privacy Policy</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
