"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Building2, Users, Megaphone, Shield, Trophy, BarChart2,
  MessageSquare, Package, CheckCircle2, XCircle, Globe, MapPin,
  Briefcase, Zap, Heart, AlertTriangle, Star, Quote, Plus, X, Pencil,
  Loader2,
} from "lucide-react";
import { usePatchBkoField } from "../hooks/use-businesses";

// ── Helpers ───────────────────────────────────────────────────────────────────

function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

// ── Editable primitives ───────────────────────────────────────────────────────

type SaveFn = (path: string, value: unknown) => Promise<void>;

function EditableText({
  value,
  path,
  placeholder = "Click to edit…",
  className = "",
  onSave,
}: {
  value: string;
  path: string;
  placeholder?: string;
  className?: string;
  onSave: SaveFn;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = useCallback(async () => {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(path, draft); setEditing(false); }
    catch { setDraft(value); setEditing(false); }
    finally { setSaving(false); }
  }, [draft, value, path, onSave]);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
          className={`flex-1 min-w-0 rounded-lg border border-indigo-300 bg-white px-2 py-0.5 text-sm outline-none ring-2 ring-indigo-100 ${className}`}
        />
        {saving && <Loader2 className="h-3 w-3 animate-spin text-indigo-400 shrink-0" />}
      </div>
    );
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`group/ef relative cursor-text inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 -ml-1.5 hover:bg-indigo-50 transition-colors ${className}`}
    >
      {value || <span className="text-slate-300 italic text-xs">{placeholder}</span>}
      <Pencil className="h-2.5 w-2.5 text-slate-300 opacity-0 group-hover/ef:opacity-100 transition-opacity shrink-0" />
    </span>
  );
}

function EditableTextarea({
  value,
  path,
  placeholder = "Click to edit…",
  className = "",
  onSave,
}: {
  value: string;
  path: string;
  placeholder?: string;
  className?: string;
  onSave: SaveFn;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [editing]);

  const commit = useCallback(async () => {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(path, draft); setEditing(false); }
    catch { setDraft(value); setEditing(false); }
    finally { setSaving(false); }
  }, [draft, value, path, onSave]);

  if (editing) {
    return (
      <div className="relative">
        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
          rows={3}
          className={`w-full rounded-lg border border-indigo-300 bg-white px-2.5 py-1.5 text-sm leading-relaxed outline-none ring-2 ring-indigo-100 resize-none ${className}`}
        />
        {saving && <Loader2 className="h-3 w-3 animate-spin text-indigo-400 absolute top-2 right-2" />}
      </div>
    );
  }

  return (
    <p
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`group/ef cursor-text rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-indigo-50 transition-colors relative ${className}`}
    >
      {value || <span className="text-slate-300 italic text-xs">{placeholder}</span>}
      <Pencil className="h-2.5 w-2.5 text-slate-300 opacity-0 group-hover/ef:opacity-100 transition-opacity absolute top-1.5 right-1.5" />
    </p>
  );
}

function EditableTags({
  values,
  path,
  color = "#6366f1",
  onSave,
}: {
  values: string[];
  path: string;
  color?: string;
  onSave: SaveFn;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  const remove = useCallback(async (idx: number) => {
    const next = values.filter((_, i) => i !== idx);
    setSaving(true);
    try { await onSave(path, next); }
    finally { setSaving(false); }
  }, [values, path, onSave]);

  const add = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed) { setAdding(false); return; }
    const next = [...values, trimmed];
    setSaving(true);
    try { await onSave(path, next); setDraft(""); setAdding(false); }
    catch { setAdding(false); }
    finally { setSaving(false); }
  }, [draft, values, path, onSave]);

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {values.map((v, i) => (
        <span
          key={i}
          className="group/tag inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
          style={{ background: color + "18", color, border: `1px solid ${color}30` }}
        >
          {v}
          <button
            onClick={() => remove(i)}
            className="opacity-0 group-hover/tag:opacity-100 transition-opacity hover:text-red-500"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      {adding ? (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={add}
            onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") { setDraft(""); setAdding(false); } }}
            className="w-28 rounded-full border border-indigo-300 bg-white px-2.5 py-0.5 text-xs outline-none ring-1 ring-indigo-100"
            placeholder="Add…"
          />
          {saving && <Loader2 className="h-3 w-3 animate-spin text-indigo-400 shrink-0" />}
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-500 px-2 py-0.5 rounded-full border border-dashed border-slate-200 hover:border-indigo-300 transition-colors"
        >
          <Plus className="h-2.5 w-2.5" /> Add
        </button>
      )}
    </div>
  );
}

function EditableList({
  values,
  path,
  color = "#6366f1",
  onSave,
  renderItem,
}: {
  values: string[];
  path: string;
  color?: string;
  onSave: SaveFn;
  renderItem: (v: string, i: number, onChange: (val: string) => void, onRemove: () => void) => React.ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  const update = useCallback(async (next: string[]) => {
    setSaving(true);
    try { await onSave(path, next); }
    finally { setSaving(false); }
  }, [path, onSave]);

  const handleChange = useCallback((idx: number, val: string) => {
    const next = values.map((v, i) => (i === idx ? val : v));
    update(next);
  }, [values, update]);

  const handleRemove = useCallback((idx: number) => {
    update(values.filter((_, i) => i !== idx));
  }, [values, update]);

  const add = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed) { setAdding(false); return; }
    await update([...values, trimmed]);
    setDraft("");
    setAdding(false);
  }, [draft, values, update]);

  return (
    <div className="space-y-2">
      {values.map((v, i) =>
        renderItem(v, i, (val) => handleChange(i, val), () => handleRemove(i))
      )}
      {adding ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={add}
            onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") { setDraft(""); setAdding(false); } }}
            className="flex-1 rounded-lg border border-indigo-300 bg-white px-2.5 py-1 text-xs outline-none ring-1 ring-indigo-100"
            placeholder="Type and press Enter…"
          />
          {saving && <Loader2 className="h-3 w-3 animate-spin text-indigo-400 shrink-0" />}
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-500 transition-colors"
          style={{ color }}
        >
          <Plus className="h-3 w-3" /> Add item
        </button>
      )}
    </div>
  );
}

// ── Layout helpers ─────────────────────────────────────────────────────────────

function Chip({ children, color = "#6366f1" }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ background: color + "18", color, border: `1px solid ${color}30` }}
    >
      {children}
    </span>
  );
}

function SectionHeader({ icon: Icon, label, accent }: { icon: React.ElementType; label: string; accent: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="flex items-center justify-center w-8 h-8 rounded-xl shrink-0" style={{ background: accent + "18" }}>
        <Icon className="h-4 w-4" style={{ color: accent }} />
      </div>
      <h2 className="text-sm font-bold tracking-wide" style={{ color: accent }}>{label.toUpperCase()}</h2>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 ${className}`}>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[9px] font-bold tracking-widest uppercase text-slate-400 mb-1.5">{children}</p>;
}

// ── Section components ─────────────────────────────────────────────────────────

function IdentitySection({ data, onSave }: { data: Record<string, unknown>; onSave: SaveFn }) {
  const mission = asStr(data.mission);
  const tagline = asStr(data.tagline);
  const description = asStr(data.description);
  const meta = [
    { icon: Briefcase, label: "Industry", value: asStr(data.sub_industry) || asStr(data.industry), path: "identity.sub_industry" },
    { icon: Globe,     label: "Type",     value: asStr(data.business_type), path: "identity.business_type" },
    { icon: Users,     label: "Size",     value: asStr(data.company_size),  path: "identity.company_size" },
    { icon: MapPin,    label: "HQ",       value: asStr(data.headquarters),  path: "identity.headquarters" },
  ].filter((m) => m.value || true);

  return (
    <Card>
      <SectionHeader icon={Building2} label="Company" accent="#6366f1" />
      <div className="space-y-4">
        <div>
          <FieldLabel>Description</FieldLabel>
          <EditableTextarea value={description} path="identity.description" placeholder="Add company description…" onSave={onSave} className="text-sm text-slate-700 leading-relaxed" />
        </div>

        <div>
          <FieldLabel>Tagline</FieldLabel>
          <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl" style={{ background: "rgba(99,102,241,0.06)", borderLeft: "3px solid #6366f1" }}>
            <Quote className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
            <EditableText value={tagline} path="identity.tagline" placeholder="Add tagline…" className="text-sm font-medium text-indigo-800 italic flex-1" onSave={onSave} />
          </div>
        </div>

        <div>
          <FieldLabel>Mission</FieldLabel>
          <EditableTextarea value={mission} path="identity.mission" placeholder="Add mission statement…" onSave={onSave} className="text-sm text-slate-600" />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {meta.map(({ icon: Icon, label, value, path }) => (
            <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50">
              <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold tracking-widest uppercase text-slate-400">{label}</p>
                <EditableText value={value} path={path} placeholder="—" className="text-xs font-semibold text-slate-700 w-full" onSave={onSave} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function OfferingsSection({ data, onSave }: { data: Record<string, unknown>; onSave: SaveFn }) {
  const products = asArr(data.products_services);

  return (
    <Card>
      <SectionHeader icon={Package} label="Products & Services" accent="#8b5cf6" />
      {products.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No offerings data yet</p>
      ) : (
        <div className="space-y-3">
          {products.map((p, i) => {
            const product = asObj(p);
            const name = asStr(product.name);
            const desc = asStr(product.description) || asStr(product.short_description);
            const price = asStr(product.price_range) || asStr(product.price);
            const cats = asArr(product.categories).map((c) => asStr(c)).filter(Boolean);
            const isHero = product.is_hero === true;
            const base = `offerings.products_services.${i}`;

            return (
              <div
                key={i}
                className="rounded-xl p-3.5 relative"
                style={{
                  background: isHero ? "rgba(139,92,246,0.06)" : "rgba(241,245,249,0.8)",
                  border: isHero ? "1px solid rgba(139,92,246,0.2)" : "1px solid rgba(226,232,240,0.8)",
                }}
              >
                {isHero && (
                  <span className="absolute top-2.5 right-2.5 text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6" }}>
                    Hero
                  </span>
                )}
                <EditableText value={name} path={`${base}.name`} placeholder="Product name…" className="text-sm font-bold text-slate-800 pr-12 block w-full" onSave={onSave} />
                <EditableTextarea value={desc} path={`${base}.description`} placeholder="Product description…" className="text-xs text-slate-500 mt-0.5" onSave={onSave} />
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold tracking-widest uppercase text-slate-400">Price</span>
                    <EditableText value={price} path={`${base}.price_range`} placeholder="Price range…" className="text-xs font-semibold text-emerald-700" onSave={onSave} />
                  </div>
                  {cats.map((c) => <Chip key={c} color="#8b5cf6">{c}</Chip>)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function AudienceSection({ data, onSave }: { data: Record<string, unknown>; onSave: SaveFn }) {
  const awareness = asStr(data.audience_awareness_level);
  const segments = asArr(data.segments).map((s) => asStr(s)).filter(Boolean);
  const psycho = asObj(data.psychographics);
  const demo = asObj(data.demographics);
  const painPoints = asArr(psycho.pain_points || data.pain_points).map((s) => asStr(s)).filter(Boolean);
  const desires = asArr(psycho.desires || data.desires).map((s) => asStr(s)).filter(Boolean);
  const triggers = asArr(psycho.emotional_triggers || data.triggers).map((s) => asStr(s)).filter(Boolean);

  const awarenessColors: Record<string, string> = {
    unaware: "#94a3b8", problem_aware: "#f59e0b", solution_aware: "#6366f1",
    product_aware: "#8b5cf6", most_aware: "#22c55e",
  };
  const ac = awarenessColors[awareness] ?? "#6366f1";

  return (
    <Card>
      <SectionHeader icon={Users} label="Audience" accent="#ec4899" />
      <div className="space-y-4">
        <div>
          <FieldLabel>Awareness Level</FieldLabel>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold" style={{ background: ac + "18", color: ac }}>
            <Zap className="h-3.5 w-3.5" />
            <EditableText value={awareness.replace(/_/g, " ")} path="audience.audience_awareness_level" placeholder="Set awareness level…" className="font-semibold" onSave={async (p, v) => onSave(p, asStr(v).replace(/ /g, "_"))} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(["age_range", "location", "income_level"] as const).map((key) => (
            <div key={key} className="px-3 py-2 bg-slate-50 rounded-xl">
              <FieldLabel>{key.replace(/_/g, " ")}</FieldLabel>
              <EditableText value={asStr(demo[key])} path={`audience.demographics.${key}`} placeholder="—" className="text-xs font-semibold text-slate-700" onSave={onSave} />
            </div>
          ))}
        </div>

        <div>
          <FieldLabel>Segments</FieldLabel>
          <EditableTags values={segments} path="audience.segments" color="#ec4899" onSave={onSave} />
        </div>

        <div className="space-y-2">
          <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)" }}>
            <FieldLabel>Pain Points</FieldLabel>
            <EditableList
              values={painPoints}
              path="audience.psychographics.pain_points"
              color="#ef4444"
              onSave={onSave}
              renderItem={(v, i, onChange, onRemove) => (
                <div key={i} className="flex items-start gap-1.5 group/li">
                  <XCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                  <EditableText value={v} path="" placeholder="Pain point…" className="text-xs text-slate-600 flex-1" onSave={async (_, val) => onChange(asStr(val))} />
                  <button onClick={onRemove} className="opacity-0 group-hover/li:opacity-100 transition-opacity text-red-300 hover:text-red-500"><X className="h-3 w-3" /></button>
                </div>
              )}
            />
          </div>

          <div className="rounded-xl p-3" style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)" }}>
            <FieldLabel>Desires</FieldLabel>
            <EditableList
              values={desires}
              path="audience.psychographics.desires"
              color="#22c55e"
              onSave={onSave}
              renderItem={(v, i, onChange, onRemove) => (
                <div key={i} className="flex items-start gap-1.5 group/li">
                  <Heart className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                  <EditableText value={v} path="" placeholder="Desire…" className="text-xs text-slate-600 flex-1" onSave={async (_, val) => onChange(asStr(val))} />
                  <button onClick={onRemove} className="opacity-0 group-hover/li:opacity-100 transition-opacity text-slate-300 hover:text-red-500"><X className="h-3 w-3" /></button>
                </div>
              )}
            />
          </div>

          <div className="rounded-xl p-3" style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.15)" }}>
            <FieldLabel>Emotional Triggers</FieldLabel>
            <EditableTags values={triggers} path="audience.psychographics.emotional_triggers" color="#f59e0b" onSave={onSave} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function BrandSection({ data, onSave }: { data: Record<string, unknown>; onSave: SaveFn }) {
  const voice = asObj(data.voice);
  const visual = asObj(data.visual_identity);
  const dos = asArr(data.dos).map((s) => asStr(s)).filter(Boolean);
  const donts = asArr(data.donts).map((s) => asStr(s)).filter(Boolean);
  const secondaryTones = asArr(voice.secondary_tones).map((s) => asStr(s)).filter(Boolean);
  const colors = asArr(visual.primary_colors).map((s) => asStr(s)).filter(Boolean);
  const fonts = asArr(visual.fonts).map((s) => asStr(s)).filter(Boolean);

  return (
    <Card>
      <SectionHeader icon={Megaphone} label="Brand Voice" accent="#06b6d4" />
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <FieldLabel>Primary Tone</FieldLabel>
            <EditableText value={asStr(voice.primary_tone)} path="brand.voice.primary_tone" placeholder="Set tone…" className="text-sm font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full" onSave={onSave} />
          </div>
          <div className="flex-1">
            <FieldLabel>Style</FieldLabel>
            <EditableText value={asStr(voice.style)} path="brand.voice.style" placeholder="Writing style…" className="text-sm text-slate-600 italic" onSave={onSave} />
          </div>
        </div>

        <div>
          <FieldLabel>Secondary Tones</FieldLabel>
          <EditableTags values={secondaryTones} path="brand.voice.secondary_tones" color="#06b6d4" onSave={onSave} />
        </div>

        {colors.length > 0 && (
          <div>
            <FieldLabel>Brand Colors</FieldLabel>
            <div className="flex gap-3 flex-wrap">
              {colors.map((c) => (
                <div key={c} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg border border-slate-200 shadow-sm shrink-0" style={{ background: c }} />
                  <span className="text-xs font-mono text-slate-500">{c}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {fonts.length > 0 && (
          <div>
            <FieldLabel>Fonts</FieldLabel>
            <EditableTags values={fonts} path="brand.visual_identity.fonts" color="#64748b" onSave={onSave} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)" }}>
            <FieldLabel>Do</FieldLabel>
            <EditableList
              values={dos} path="brand.dos" color="#22c55e" onSave={onSave}
              renderItem={(v, i, onChange, onRemove) => (
                <div key={i} className="flex items-start gap-1.5 group/li">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                  <EditableText value={v} path="" placeholder="Do…" className="text-xs text-slate-600 flex-1" onSave={async (_, val) => onChange(asStr(val))} />
                  <button onClick={onRemove} className="opacity-0 group-hover/li:opacity-100 transition-opacity text-slate-300 hover:text-red-500"><X className="h-3 w-3" /></button>
                </div>
              )}
            />
          </div>
          <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)" }}>
            <FieldLabel>Don't</FieldLabel>
            <EditableList
              values={donts} path="brand.donts" color="#ef4444" onSave={onSave}
              renderItem={(v, i, onChange, onRemove) => (
                <div key={i} className="flex items-start gap-1.5 group/li">
                  <XCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                  <EditableText value={v} path="" placeholder="Don't…" className="text-xs text-slate-600 flex-1" onSave={async (_, val) => onChange(asStr(val))} />
                  <button onClick={onRemove} className="opacity-0 group-hover/li:opacity-100 transition-opacity text-slate-300 hover:text-red-500"><X className="h-3 w-3" /></button>
                </div>
              )}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function CompetitiveSection({ data, onSave }: { data: Record<string, unknown>; onSave: SaveFn }) {
  const position = asStr(data.market_position) || asStr(data.positioning_statement);
  const usps = asArr(data.unique_selling_points || data.usps).map((s) => asStr(s)).filter(Boolean);
  const differentiators = asArr(data.differentiators).map((s) => asStr(s)).filter(Boolean);
  const competitors = asArr(data.main_competitors || data.competitors).map((s) => asStr(s)).filter(Boolean);

  return (
    <Card>
      <SectionHeader icon={Trophy} label="Competitive" accent="#f59e0b" />
      <div className="space-y-4">
        <div>
          <FieldLabel>Market Position</FieldLabel>
          <EditableTextarea value={position} path="competitive_position.market_position" placeholder="Describe your market position…" onSave={onSave} className="text-sm font-medium text-amber-900" />
        </div>
        <div>
          <FieldLabel>Unique Selling Points</FieldLabel>
          <EditableList
            values={usps} path="competitive_position.unique_selling_points" color="#f59e0b" onSave={onSave}
            renderItem={(v, i, onChange, onRemove) => (
              <div key={i} className="flex items-start gap-2.5 group/li">
                <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5" style={{ background: "rgba(245,158,11,0.15)", color: "#d97706" }}>{i + 1}</span>
                <EditableText value={v} path="" placeholder="USP…" className="text-xs text-slate-700 flex-1 leading-relaxed" onSave={async (_, val) => onChange(asStr(val))} />
                <button onClick={onRemove} className="opacity-0 group-hover/li:opacity-100 transition-opacity text-slate-300 hover:text-red-500 mt-0.5"><X className="h-3 w-3" /></button>
              </div>
            )}
          />
        </div>
        <div>
          <FieldLabel>Differentiators</FieldLabel>
          <EditableTags values={differentiators} path="competitive_position.differentiators" color="#f59e0b" onSave={onSave} />
        </div>
        <div>
          <FieldLabel>Key Competitors</FieldLabel>
          <EditableTags values={competitors} path="competitive_position.main_competitors" color="#64748b" onSave={onSave} />
        </div>
      </div>
    </Card>
  );
}

function SocialProofSection({ data, onSave }: { data: Record<string, unknown>; onSave: SaveFn }) {
  const testimonials = asArr(data.testimonials).slice(0, 3);
  const certs = asArr(data.certifications || data.awards).map((s) => asStr(s)).filter(Boolean);
  const ratings = asObj(data.ratings);
  const ratingVal = asStr(ratings.average) || asStr(ratings.score) || null;

  return (
    <Card>
      <SectionHeader icon={Star} label="Social Proof" accent="#22c55e" />
      <div className="space-y-4">
        {ratingVal && (
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="h-4 w-4" style={{ color: i <= Math.round(Number(ratingVal)) ? "#f59e0b" : "#e2e8f0", fill: i <= Math.round(Number(ratingVal)) ? "#f59e0b" : "none" }} />
              ))}
            </div>
            <span className="text-sm font-bold text-slate-700">{ratingVal}</span>
            {ratings.count != null && <span className="text-xs text-slate-400">({String(ratings.count)} reviews)</span>}
          </div>
        )}
        {testimonials.length > 0 && (
          <div className="space-y-2">
            {testimonials.map((t, i) => {
              const obj = asObj(t);
              const text = asStr(obj.text || obj.quote);
              const author = asStr(obj.author || obj.name);
              if (!text) return null;
              return (
                <div key={i} className="rounded-xl p-3" style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)" }}>
                  <div className="flex gap-2">
                    <Quote className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <EditableTextarea value={text} path={`social_proof.testimonials.${i}.text`} placeholder="Testimonial…" className="text-xs text-slate-700 italic" onSave={onSave} />
                      {author && <p className="text-[10px] font-semibold text-emerald-600 mt-1">— {author}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div>
          <FieldLabel>Certifications & Awards</FieldLabel>
          <EditableTags values={certs} path="social_proof.certifications" color="#22c55e" onSave={onSave} />
        </div>
      </div>
    </Card>
  );
}

function MarketingSection({ data, onSave }: { data: Record<string, unknown>; onSave: SaveFn }) {
  const channels = asArr(data.current_channels || data.channels).map((s) => asStr(s)).filter(Boolean);
  const moments = asArr(data.seasonal_moments || data.key_moments).map((s) => asStr(s)).filter(Boolean);
  const budget = asStr(data.budget_range || data.budget);
  const goals = asArr(data.current_goals || data.goals).map((s) => asStr(s)).filter(Boolean);

  const channelColors: Record<string, string> = {
    instagram: "#e1306c", facebook: "#1877f2", tiktok: "#000000",
    youtube: "#ff0000", google: "#4285f4", linkedin: "#0a66c2",
    email: "#8b5cf6", twitter: "#1da1f2",
  };

  return (
    <Card>
      <SectionHeader icon={BarChart2} label="Marketing" accent="#a855f7" />
      <div className="space-y-4">
        <div>
          <FieldLabel>Active Channels</FieldLabel>
          <EditableTags values={channels} path="marketing_context.current_channels" color="#a855f7" onSave={onSave} />
        </div>
        <div>
          <FieldLabel>Budget</FieldLabel>
          <EditableText value={budget} path="marketing_context.budget_range" placeholder="e.g. $5,000–$10,000/mo" className="text-sm text-slate-700" onSave={onSave} />
        </div>
        <div>
          <FieldLabel>Current Goals</FieldLabel>
          <EditableList
            values={goals} path="marketing_context.current_goals" color="#a855f7" onSave={onSave}
            renderItem={(v, i, onChange, onRemove) => (
              <div key={i} className="flex items-start gap-2 group/li">
                <span className="text-purple-400 text-xs font-black shrink-0">›</span>
                <EditableText value={v} path="" placeholder="Goal…" className="text-xs text-slate-600 flex-1" onSave={async (_, val) => onChange(asStr(val))} />
                <button onClick={onRemove} className="opacity-0 group-hover/li:opacity-100 transition-opacity text-slate-300 hover:text-red-500"><X className="h-3 w-3" /></button>
              </div>
            )}
          />
        </div>
        <div>
          <FieldLabel>Seasonal Moments</FieldLabel>
          <EditableTags values={moments} path="marketing_context.seasonal_moments" color="#a855f7" onSave={onSave} />
        </div>
      </div>
    </Card>
  );
}

function MessagingSection({ data, onSave }: { data: Record<string, unknown>; onSave: SaveFn }) {
  const valueProps = asArr(data.primary_value_propositions).map((s) => asStr(s)).filter(Boolean);
  const hooks = asArr(data.emotional_hooks).map((s) => asStr(s)).filter(Boolean);
  const forbidden = asArr(data.forbidden_topics).map((s) => asStr(s)).filter(Boolean);
  const taglineVars = asArr(data.tagline_variations);
  const tagline = asStr(taglineVars[0] ?? data.tagline);

  return (
    <Card>
      <SectionHeader icon={MessageSquare} label="Messaging" accent="#f97316" />
      <div className="space-y-4">
        <div>
          <FieldLabel>Tagline</FieldLabel>
          <div className="px-4 py-2.5 rounded-xl" style={{ background: "rgba(249,115,22,0.08)", borderLeft: "3px solid #f97316" }}>
            <EditableText value={tagline} path="messaging.tagline" placeholder="Brand tagline…" className="text-sm font-semibold text-orange-900 italic" onSave={onSave} />
          </div>
        </div>
        <div>
          <FieldLabel>Value Propositions</FieldLabel>
          <EditableList
            values={valueProps} path="messaging.primary_value_propositions" color="#f97316" onSave={onSave}
            renderItem={(v, i, onChange, onRemove) => (
              <div key={i} className="flex items-start gap-2.5 group/li">
                <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5" style={{ background: "rgba(249,115,22,0.15)", color: "#ea580c" }}>{i + 1}</span>
                <EditableText value={v} path="" placeholder="Value prop…" className="text-xs text-slate-700 flex-1 leading-relaxed" onSave={async (_, val) => onChange(asStr(val))} />
                <button onClick={onRemove} className="opacity-0 group-hover/li:opacity-100 transition-opacity text-slate-300 hover:text-red-500 mt-0.5"><X className="h-3 w-3" /></button>
              </div>
            )}
          />
        </div>
        <div>
          <FieldLabel>Emotional Hooks</FieldLabel>
          <EditableTags values={hooks} path="messaging.emotional_hooks" color="#f97316" onSave={onSave} />
        </div>
        <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)" }}>
          <FieldLabel>Forbidden Topics</FieldLabel>
          <EditableTags values={forbidden} path="messaging.forbidden_topics" color="#ef4444" onSave={onSave} />
        </div>
      </div>
    </Card>
  );
}

function ComplianceSection({ data, onSave }: { data: Record<string, unknown>; onSave: SaveFn }) {
  const restricted = asArr(data.restricted_claims).map((s) => asStr(s)).filter(Boolean);
  const required = asArr(data.required_disclaimers || data.required_disclosures).map((s) => asStr(s)).filter(Boolean);
  const regulatory = asStr(data.regulatory_notes || data.notes);

  if (restricted.length === 0 && required.length === 0 && !regulatory) return null;

  return (
    <Card>
      <SectionHeader icon={Shield} label="Compliance" accent="#64748b" />
      <div className="space-y-4">
        <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)" }}>
          <FieldLabel>Restricted Claims</FieldLabel>
          <EditableList
            values={restricted} path="compliance.restricted_claims" color="#ef4444" onSave={onSave}
            renderItem={(v, i, onChange, onRemove) => (
              <div key={i} className="flex items-start gap-1.5 group/li">
                <AlertTriangle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                <EditableText value={v} path="" placeholder="Restricted claim…" className="text-xs text-slate-600 flex-1" onSave={async (_, val) => onChange(asStr(val))} />
                <button onClick={onRemove} className="opacity-0 group-hover/li:opacity-100 transition-opacity text-slate-300 hover:text-red-500"><X className="h-3 w-3" /></button>
              </div>
            )}
          />
        </div>
        <div>
          <FieldLabel>Required Disclaimers</FieldLabel>
          <EditableList
            values={required} path="compliance.required_disclaimers" color="#64748b" onSave={onSave}
            renderItem={(v, i, onChange, onRemove) => (
              <div key={i} className="flex items-start gap-1.5 group/li">
                <Shield className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                <EditableText value={v} path="" placeholder="Disclaimer…" className="text-xs text-slate-600 flex-1" onSave={async (_, val) => onChange(asStr(val))} />
                <button onClick={onRemove} className="opacity-0 group-hover/li:opacity-100 transition-opacity text-slate-300 hover:text-red-500"><X className="h-3 w-3" /></button>
              </div>
            )}
          />
        </div>
        <div>
          <FieldLabel>Regulatory Notes</FieldLabel>
          <EditableTextarea value={regulatory} path="compliance.regulatory_notes" placeholder="Add regulatory notes…" onSave={onSave} className="text-xs text-slate-600 leading-relaxed" />
        </div>
      </div>
    </Card>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function BkoViewer({ bko, businessId }: { bko: Record<string, unknown>; businessId: string }) {
  const { mutateAsync } = usePatchBkoField(businessId);

  const onSave = useCallback<SaveFn>(async (path, value) => {
    await mutateAsync({ path, value });
  }, [mutateAsync]);

  const id   = asObj(bko.identity);
  const of_  = asObj(bko.offerings);
  const au   = asObj(bko.audience);
  const br   = asObj(bko.brand);
  const co   = asObj(bko.competitive_position);
  const sp   = asObj(bko.social_proof);
  const mk   = asObj(bko.marketing_context);
  const ms   = asObj(bko.messaging);
  const cm   = asObj(bko.compliance);

  return (
    <div className="space-y-4">
      {!!bko.identity            && <IdentitySection    data={id}  onSave={onSave} />}
      {!!bko.offerings           && <OfferingsSection   data={of_} onSave={onSave} />}
      {!!bko.audience            && <AudienceSection    data={au}  onSave={onSave} />}
      {!!bko.brand               && <BrandSection       data={br}  onSave={onSave} />}
      {!!bko.competitive_position && <CompetitiveSection data={co}  onSave={onSave} />}
      {!!bko.social_proof        && <SocialProofSection data={sp}  onSave={onSave} />}
      {!!bko.marketing_context   && <MarketingSection   data={mk}  onSave={onSave} />}
      {!!bko.messaging           && <MessagingSection   data={ms}  onSave={onSave} />}
      {!!bko.compliance          && <ComplianceSection  data={cm}  onSave={onSave} />}
    </div>
  );
}
