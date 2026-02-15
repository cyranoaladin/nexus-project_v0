'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

/**
 * CdC §4.1.1 — "La Toile d'Araignée"
 * Cobweb diagram: visualize convergence/divergence of a recursive sequence u_{n+1} = f(u_n).
 * Draws y = f(x), y = x, and the cobweb path from u_0.
 */

interface Preset {
  label: string;
  fn: (x: number) => number;
  fnLabel: string;
  u0: number;
  xMin: number;
  xMax: number;
}

const PRESETS: Preset[] = [
  {
    label: 'Convergente (√)',
    fn: (x: number) => Math.sqrt(x + 2),
    fnLabel: 'f(x) = √(x + 2)',
    u0: 0.5,
    xMin: -0.5,
    xMax: 4,
  },
  {
    label: 'Convergente (cos)',
    fn: (x: number) => Math.cos(x),
    fnLabel: 'f(x) = cos(x)',
    u0: 0.2,
    xMin: -0.5,
    xMax: 2,
  },
  {
    label: 'Divergente (2x−1)',
    fn: (x: number) => 2 * x - 1,
    fnLabel: 'f(x) = 2x − 1',
    u0: 1.1,
    xMin: -1,
    xMax: 4,
  },
  {
    label: 'Cycle (1−x²)',
    fn: (x: number) => 1 - x * x,
    fnLabel: 'f(x) = 1 − x²',
    u0: 0.3,
    xMin: -1.5,
    xMax: 1.5,
  },
  {
    label: 'Logistique (3.2x(1−x))',
    fn: (x: number) => 3.2 * x * (1 - x),
    fnLabel: 'f(x) = 3.2·x·(1−x)',
    u0: 0.1,
    xMin: -0.1,
    xMax: 1.1,
  },
];

export default function ToileAraignee() {
  const [expanded, setExpanded] = useState(false);
  const [presetIdx, setPresetIdx] = useState(0);
  const [steps, setSteps] = useState(8);
  const [u0, setU0] = useState(PRESETS[0].u0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const preset = PRESETS[presetIdx];

  /** Compute cobweb path: [(u0, 0), (u0, f(u0)), (f(u0), f(u0)), (f(u0), f(f(u0))), ...] */
  const cobwebPath = useMemo(() => {
    const path: [number, number][] = [];
    let x = u0;
    path.push([x, 0]);
    for (let i = 0; i < steps; i++) {
      const y = preset.fn(x);
      if (!isFinite(y) || Math.abs(y) > 1e6) break;
      path.push([x, y]);   // vertical to f(x)
      path.push([y, y]);   // horizontal to y=x
      x = y;
    }
    return path;
  }, [u0, steps, preset]);

  /** Draw on canvas */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const { xMin, xMax, fn } = preset;

    // Compute yMin/yMax from function range
    let yMin = xMin;
    let yMax = xMax;
    for (let px = 0; px < W; px++) {
      const x = xMin + (px / W) * (xMax - xMin);
      const y = fn(x);
      if (isFinite(y)) {
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
    // Add padding
    const yPad = (yMax - yMin) * 0.1;
    yMin -= yPad;
    yMax += yPad;

    const toCanvasX = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
    const toCanvasY = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H;

    // Clear
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    for (let i = Math.ceil(xMin); i <= Math.floor(xMax); i++) {
      const cx = toCanvasX(i);
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
    }
    for (let i = Math.ceil(yMin); i <= Math.floor(yMax); i++) {
      const cy = toCanvasY(i);
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 1;
    const ox = toCanvasX(0);
    const oy = toCanvasY(0);
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.stroke();

    // y = x (bisector)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(toCanvasX(xMin), toCanvasY(xMin));
    ctx.lineTo(toCanvasX(xMax), toCanvasY(xMax));
    ctx.stroke();
    ctx.setLineDash([]);

    // y = f(x) curve
    ctx.strokeStyle = '#22d3ee'; // cyan-400
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let started = false;
    for (let px = 0; px < W; px++) {
      const x = xMin + (px / W) * (xMax - xMin);
      const y = fn(x);
      if (!isFinite(y) || Math.abs(y) > 1e6) { started = false; continue; }
      const cy = toCanvasY(y);
      if (!started) { ctx.moveTo(px, cy); started = true; }
      else ctx.lineTo(px, cy);
    }
    ctx.stroke();

    // Cobweb path
    if (cobwebPath.length > 1) {
      ctx.strokeStyle = '#f97316'; // orange-500
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(toCanvasX(cobwebPath[0][0]), toCanvasY(cobwebPath[0][1]));
      for (let i = 1; i < cobwebPath.length; i++) {
        ctx.lineTo(toCanvasX(cobwebPath[i][0]), toCanvasY(cobwebPath[i][1]));
      }
      ctx.stroke();

      // Draw u_0 point
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(toCanvasX(u0), toCanvasY(0), 5, 0, Math.PI * 2);
      ctx.fill();

      // Draw final point
      const last = cobwebPath[cobwebPath.length - 1];
      ctx.fillStyle = '#22c55e'; // green-500
      ctx.beginPath();
      ctx.arc(toCanvasX(last[0]), toCanvasY(last[1]), 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Labels
    ctx.fillStyle = '#22d3ee';
    ctx.font = '12px monospace';
    ctx.fillText('y = f(x)', 8, 16);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.fillText('y = x', 8, 30);
    ctx.fillStyle = '#f97316';
    ctx.fillText(`u₀ = ${u0.toFixed(2)}`, 8, 44);

    // Tick labels on axes
    ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.font = '10px monospace';
    for (let i = Math.ceil(xMin); i <= Math.floor(xMax); i++) {
      if (i === 0) continue;
      ctx.fillText(String(i), toCanvasX(i) + 2, oy + 12);
    }
  }, [preset, cobwebPath, u0]);

  useEffect(() => {
    if (expanded) draw();
  }, [expanded, draw]);

  // Reset u0 when preset changes
  useEffect(() => {
    setU0(PRESETS[presetIdx].u0);
  }, [presetIdx]);

  // Detect convergence
  const lastU = cobwebPath.length > 2 ? cobwebPath[cobwebPath.length - 1][0] : u0;
  const prevU = cobwebPath.length > 4 ? cobwebPath[cobwebPath.length - 3][0] : u0;
  const isConverging = Math.abs(lastU - prevU) < 0.01;
  const fixedPoint = isConverging ? lastU : null;

  return (
    <div className="bg-slate-900/50 border border-cyan-500/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🕸️</span>
          <span className="font-bold text-cyan-300 text-sm">La Toile d&apos;Araignée</span>
          <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full">Lab Interactif</span>
        </div>
        <span className="text-slate-500 text-sm">{expanded ? '▲ Réduire' : '▼ Ouvrir'}</span>
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-3">
          {/* Preset selector */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                onClick={() => setPresetIdx(i)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  presetIdx === i
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-orange-400">u₀</span>
                <span className="text-xs font-mono text-slate-400">{u0.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={preset.xMin}
                max={preset.xMax}
                step={0.01}
                value={u0}
                onChange={(e) => setU0(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-orange-500"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-blue-400">Itérations</span>
                <span className="text-xs font-mono text-slate-400">{steps}</span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={steps}
                onChange={(e) => setSteps(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>

          {/* Info bar */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-slate-800 px-2 py-1 rounded text-cyan-300 font-mono">{preset.fnLabel}</span>
            <span className="bg-slate-800 px-2 py-1 rounded text-orange-300">
              u₀ = {u0.toFixed(2)}
            </span>
            <span className="bg-slate-800 px-2 py-1 rounded text-slate-300">
              u_{steps} ≈ <span className="text-white font-bold">{lastU.toFixed(4)}</span>
            </span>
            {fixedPoint !== null && (
              <span className="bg-green-500/10 border border-green-500/20 px-2 py-1 rounded text-green-400 font-bold">
                ✓ Converge vers ℓ ≈ {fixedPoint.toFixed(4)}
              </span>
            )}
            {!isConverging && steps > 5 && (
              <span className="bg-red-500/10 border border-red-500/20 px-2 py-1 rounded text-red-400 font-bold">
                ✗ Diverge / Cycle
              </span>
            )}
          </div>

          {/* Canvas */}
          <div className="rounded-xl overflow-hidden border border-slate-700/50">
            <canvas
              ref={canvasRef}
              width={600}
              height={400}
              className="w-full"
              style={{ imageRendering: 'auto' }}
            />
          </div>

          <p className="text-[10px] text-slate-600 text-center">
            La toile d&apos;araignée montre comment u_{'{n+1}'} = f(u_n) converge (spirale/escalier vers le point fixe)
            ou diverge (s&apos;éloigne). Le point fixe ℓ vérifie f(ℓ) = ℓ.
          </p>
        </div>
      )}
    </div>
  );
}
