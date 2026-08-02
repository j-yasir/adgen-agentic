"use client";

import { useEffect, useRef } from "react";

type AgentKey = "researcher" | "strategist" | "producer" | "auditor";

interface AgentCanvasProps {
  agent: AgentKey;
  size?: number;
  active?: boolean;
}

/* ── Researcher: radar sweep + blips ── */
function drawRadar(ctx: CanvasRenderingContext2D, t: number, size: number, alpha: number) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
  const COLOR = "#6366f1";

  ctx.clearRect(0, 0, size, size);
  ctx.globalAlpha = alpha;

  // Grid rings
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (r * i) / 3, 0, Math.PI * 2);
    ctx.strokeStyle = COLOR;
    ctx.globalAlpha = alpha * 0.15;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Cross hairs
  ctx.globalAlpha = alpha * 0.15;
  ctx.strokeStyle = COLOR;
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();

  // Sweep gradient (fading trail)
  const angle = (t * 0.0025) % (Math.PI * 2);
  const trailLen = Math.PI * 1.2;
  // Draw sweep as arc segments
  const steps = 40;
  for (let s = 0; s < steps; s++) {
    const frac = s / steps;
    const a = angle - trailLen * (1 - frac);
    const aEnd = angle - trailLen * (1 - (s + 1) / steps);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a, aEnd);
    ctx.closePath();
    ctx.fillStyle = COLOR;
    ctx.globalAlpha = alpha * frac * 0.18;
    ctx.fill();
  }

  // Sweep line
  ctx.globalAlpha = alpha * 0.8;
  ctx.strokeStyle = COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  ctx.stroke();

  // Blip dots (pseudo-random, stable positions, pulse in/out)
  const BLIPS = [
    { nx: 0.2, ny: -0.55, phase: 0 },
    { nx: -0.5, ny: 0.2, phase: 1.5 },
    { nx: 0.55, ny: 0.35, phase: 3 },
    { nx: -0.15, ny: 0.6, phase: 4.5 },
    { nx: 0.38, ny: -0.3, phase: 2 },
  ];
  BLIPS.forEach(({ nx, ny, phase }) => {
    const bx = cx + nx * r;
    const by = cy + ny * r;
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.003 + phase);
    ctx.beginPath();
    ctx.arc(bx, by, size * 0.028 * (0.6 + pulse * 0.4), 0, Math.PI * 2);
    ctx.fillStyle = COLOR;
    ctx.globalAlpha = alpha * 0.5 * pulse;
    ctx.fill();
    // glow ring
    ctx.beginPath();
    ctx.arc(bx, by, size * 0.05 * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = COLOR;
    ctx.globalAlpha = alpha * 0.15 * pulse;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  });

  ctx.globalAlpha = 1;
}

/* ── Strategist: node network builds connections ── */
const NET_NODES = (() => {
  const nodes: { x: number; y: number }[] = [];
  const cols = 4, rows = 4;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      nodes.push({ x: (c + 0.5) / cols, y: (r + 0.5) / rows });
    }
  }
  return nodes;
})();

const NET_EDGES = (() => {
  const edges: [number, number][] = [];
  const adj = [
    [0, 1], [1, 2], [2, 3],
    [4, 5], [5, 6], [6, 7],
    [8, 9], [9, 10], [10, 11],
    [12, 13], [13, 14], [14, 15],
    [0, 4], [4, 8], [8, 12],
    [1, 5], [5, 9], [9, 13],
    [2, 6], [6, 10], [10, 14],
    [3, 7], [7, 11], [11, 15],
    [0, 5], [1, 6], [5, 10], [6, 11],
    [4, 9], [9, 14], [2, 9], [6, 13],
  ];
  return adj as [number, number][];
})();

function drawNetwork(ctx: CanvasRenderingContext2D, t: number, size: number, alpha: number) {
  const COLOR = "#8b5cf6";
  const pad = size * 0.1;
  const w = size - pad * 2;

  ctx.clearRect(0, 0, size, size);

  const cycleLen = 4000;
  const phase = (t % cycleLen) / cycleLen;

  // Draw edges progressively
  NET_EDGES.forEach(([a, b], i) => {
    const edgeFrac = i / NET_EDGES.length;
    const edgeAlpha = Math.min(1, Math.max(0, (phase - edgeFrac * 0.7) / 0.05));
    if (edgeAlpha <= 0) return;

    const ax = pad + NET_NODES[a].x * w;
    const ay = pad + NET_NODES[a].y * w;
    const bx = pad + NET_NODES[b].x * w;
    const by = pad + NET_NODES[b].y * w;

    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.strokeStyle = COLOR;
    ctx.globalAlpha = alpha * edgeAlpha * 0.35;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  });

  // Draw nodes
  NET_NODES.forEach((n, i) => {
    const nx = pad + n.x * w;
    const ny = pad + n.y * w;
    const nodeFrac = i / NET_NODES.length;
    const nodeAlpha = Math.min(1, Math.max(0, (phase - nodeFrac * 0.5) / 0.08));
    if (nodeAlpha <= 0) return;

    const pulse = 0.7 + 0.3 * Math.sin(t * 0.002 + i * 0.7);
    ctx.beginPath();
    ctx.arc(nx, ny, size * 0.03 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = COLOR;
    ctx.globalAlpha = alpha * nodeAlpha * 0.9;
    ctx.fill();
  });

  // Travelling signal dot
  const signalEdge = Math.floor(phase * NET_EDGES.length * 0.8) % NET_EDGES.length;
  const [sa, sb] = NET_EDGES[signalEdge];
  const sigT = (phase * NET_EDGES.length * 0.8) % 1;
  const sx = pad + (NET_NODES[sa].x + (NET_NODES[sb].x - NET_NODES[sa].x) * sigT) * w;
  const sy = pad + (NET_NODES[sa].y + (NET_NODES[sb].y - NET_NODES[sa].y) * sigT) * w;
  ctx.beginPath();
  ctx.arc(sx, sy, size * 0.04, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.globalAlpha = alpha * 0.9;
  ctx.fill();

  ctx.globalAlpha = 1;
}

/* ── Producer: particles stream to center, output layers emerge ── */
interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number;
}

const producerState: {
  particles: Particle[];
  lastT: number;
} = { particles: [], lastT: 0 };

function drawForge(ctx: CanvasRenderingContext2D, t: number, size: number, alpha: number) {
  const COLOR = "#ec4899";
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  const dt = Math.min(t - producerState.lastT, 50);
  producerState.lastT = t;

  // Spawn particles from edges
  if (Math.random() < 0.4) {
    const edge = Math.floor(Math.random() * 4);
    let px = 0, py = 0;
    if (edge === 0) { px = Math.random() * size; py = 0; }
    else if (edge === 1) { px = size; py = Math.random() * size; }
    else if (edge === 2) { px = Math.random() * size; py = size; }
    else { px = 0; py = Math.random() * size; }

    const dx = cx - px, dy = cy - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = 0.03 + Math.random() * 0.04;
    producerState.particles.push({
      x: px, y: py,
      vx: (dx / dist) * speed * size,
      vy: (dy / dist) * speed * size,
      life: 0,
      maxLife: 60 + Math.random() * 30,
    });
  }

  // Update + draw particles
  producerState.particles = producerState.particles.filter((p) => p.life < p.maxLife);
  producerState.particles.forEach((p) => {
    p.x += p.vx * (dt / 16);
    p.y += p.vy * (dt / 16);
    p.life++;

    const frac = p.life / p.maxLife;
    const a = alpha * (1 - frac) * 0.7;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size * 0.018 * (1 - frac * 0.5), 0, Math.PI * 2);
    ctx.fillStyle = COLOR;
    ctx.globalAlpha = a;
    ctx.fill();
  });

  // Center core
  const pulse = 0.7 + 0.3 * Math.sin(t * 0.004);
  const coreR = size * 0.1 * pulse;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2);
  grad.addColorStop(0, COLOR);
  grad.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.arc(cx, cy, coreR * 2, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.globalAlpha = alpha * 0.4;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
  ctx.fillStyle = COLOR;
  ctx.globalAlpha = alpha * 0.9;
  ctx.fill();

  // Output layer bands emanating outward
  const BANDS = 3;
  for (let b = 0; b < BANDS; b++) {
    const bandPhase = ((t * 0.001 + b / BANDS) % 1);
    const bandR = bandPhase * size * 0.45;
    ctx.beginPath();
    ctx.arc(cx, cy, bandR, 0, Math.PI * 2);
    ctx.strokeStyle = COLOR;
    ctx.globalAlpha = alpha * (1 - bandPhase) * 0.3;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

/* ── Auditor: scan line, lines turn green, checkmark ── */
function drawScanner(ctx: CanvasRenderingContext2D, t: number, size: number, alpha: number) {
  const COLOR_SCAN = "#22c55e";
  const pad = size * 0.12;
  const docW = size - pad * 2;
  const docH = size - pad * 2;

  ctx.clearRect(0, 0, size, size);

  const cycleLen = 3000;
  const phase = (t % cycleLen) / cycleLen;

  // Document background
  ctx.fillStyle = "#f0fdf4";
  ctx.globalAlpha = alpha * 0.5;
  ctx.beginPath();
  ctx.roundRect(pad, pad, docW, docH, 4);
  ctx.fill();

  ctx.strokeStyle = COLOR_SCAN;
  ctx.globalAlpha = alpha * 0.3;
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Lines of text
  const LINE_COUNT = 8;
  const lineSpacing = docH / (LINE_COUNT + 1);
  for (let l = 0; l < LINE_COUNT; l++) {
    const ly = pad + lineSpacing * (l + 1);
    const lineLen = 0.4 + 0.5 * (Math.sin(l * 1.7 + 0.3) * 0.5 + 0.5);
    const lineFrac = (l + 1) / (LINE_COUNT + 1);
    const scanned = phase > lineFrac * 0.75;

    const lx = pad + docW * 0.08;
    const lw = docW * 0.84 * lineLen;

    ctx.beginPath();
    ctx.roundRect(lx, ly - 1, lw, 2, 1);
    ctx.fillStyle = scanned ? COLOR_SCAN : "#94a3b8";
    ctx.globalAlpha = alpha * (scanned ? 0.8 : 0.3);
    ctx.fill();

    if (scanned) {
      // Tiny check mark beside line
      const ckx = lx + lw + docW * 0.04;
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = COLOR_SCAN;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ckx - 2, ly);
      ctx.lineTo(ckx, ly + 2);
      ctx.lineTo(ckx + 3, ly - 2);
      ctx.stroke();
    }
  }

  // Scan line
  if (phase < 0.8) {
    const scanY = pad + docH * (phase / 0.8);
    ctx.beginPath();
    ctx.moveTo(pad, scanY);
    ctx.lineTo(pad + docW, scanY);
    ctx.strokeStyle = COLOR_SCAN;
    ctx.globalAlpha = alpha * 0.9;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Glow
    const scanGrad = ctx.createLinearGradient(pad, scanY - 6, pad, scanY + 6);
    scanGrad.addColorStop(0, "transparent");
    scanGrad.addColorStop(0.5, COLOR_SCAN);
    scanGrad.addColorStop(1, "transparent");
    ctx.fillStyle = scanGrad;
    ctx.globalAlpha = alpha * 0.2;
    ctx.fillRect(pad, scanY - 6, docW, 12);
  }

  // Big checkmark at end
  if (phase > 0.85) {
    const ckAlpha = Math.min(1, (phase - 0.85) / 0.1);
    const ckCx = pad + docW / 2;
    const ckCy = pad + docH * 0.6;
    const ckR = size * 0.12;

    ctx.beginPath();
    ctx.arc(ckCx, ckCy, ckR, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_SCAN;
    ctx.globalAlpha = alpha * ckAlpha * 0.15;
    ctx.fill();

    ctx.strokeStyle = COLOR_SCAN;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.globalAlpha = alpha * ckAlpha;
    ctx.beginPath();
    ctx.moveTo(ckCx - ckR * 0.5, ckCy);
    ctx.lineTo(ckCx - ckR * 0.1, ckCy + ckR * 0.45);
    ctx.lineTo(ckCx + ckR * 0.6, ckCy - ckR * 0.45);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

const DRAW_FN: Record<AgentKey, typeof drawRadar> = {
  researcher: drawRadar,
  strategist: drawNetwork,
  producer: drawForge,
  auditor: drawScanner,
};

export function AgentCanvas({ agent, size = 80, active = true }: AgentCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Reset producer particle state when agent changes
    if (agent === "producer") {
      producerState.particles = [];
      producerState.lastT = 0;
    }

    const targetAlpha = active ? 1 : 0.3;
    const draw = DRAW_FN[agent];

    function loop(ts: number) {
      if (!startRef.current) startRef.current = ts;
      const t = ts - startRef.current;
      draw(ctx!, t, size, targetAlpha);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      startRef.current = 0;
    };
  }, [agent, size, active]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: "block", opacity: active ? 1 : 0.35 }}
    />
  );
}
