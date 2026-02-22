'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useMathsLabStore } from '../../store';

const PRESETS = [
  { label: 'x²−2 (√2)', fn: (x: number) => x * x - 2, dfn: (x: number) => 2 * x, x0: 2, label2: 'f(x)=x²−2' },
  { label: 'x³−x−1', fn: (x: number) => x * x * x - x - 1, dfn: (x: number) => 3 * x * x - 1, x0: 1.5, label2: 'f(x)=x³−x−1' },
  { label: 'cos(x)−x', fn: (x: number) => Math.cos(x) - x, dfn: (x: number) => -Math.sin(x) - 1, x0: 1, label2: 'f(x)=cos(x)−x' },
];

export default function NewtonSolver() {
  const [expanded, setExpanded] = useState(false);
  const [presetIdx, setPresetIdx] = useState(0);
  const [iteration, setIteration] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const store = useMathsLabStore();
  const preset = PRESETS[presetIdx];

  const iterations: number[] = [preset.x0];
  for (let i = 0; i < 8; i++) {
    const xn = iterations[iterations.length - 1];
    const fxn = preset.fn(xn);
    const dfxn = preset.dfn(xn);
    if (Math.abs(dfxn) < 1e-10) break;
    iterations.push(xn - fxn / dfxn);
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const PAD = 40;
    const xMin = -0.5;
    const xMax = preset.x0 + 0.5;
    const yVals = Array.from({ length: 100 }, (_, i) => preset.fn(xMin + (i * (xMax - xMin)) / 99));
    const yMin = Math.min(-0.5, ...yVals);
    const yMax = Math.max(0.5, ...yVals);

    const toSX = (x: number) => PAD + ((x - xMin) / (xMax - xMin)) * (W - 2 * PAD);
    const toSY = (y: number) => H - PAD - ((y - yMin) / (yMax - yMin)) * (H - 2 * PAD);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(148,163,184,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, toSY(0));
    ctx.lineTo(W - PAD, toSY(0));
    ctx.moveTo(toSX(0), PAD);
    ctx.lineTo(toSX(0), H - PAD);
    ctx.stroke();

    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const x = xMin + (i / 200) * (xMax - xMin);
      const y = preset.fn(x);
      if (!isFinite(y)) continue;
      if (i === 0) ctx.moveTo(toSX(x), toSY(y));
      else ctx.lineTo(toSX(x), toSY(y));
    }
    ctx.stroke();

    for (let i = 0; i < Math.min(iteration, iterations.length - 1); i++) {
      const xn = iterations[i];
      const fxn = preset.fn(xn);
      const dfxn = preset.dfn(xn);
      const alpha = i / Math.max(1, iterations.length - 1);
      const color = `rgba(249,115,22,${0.4 + 0.6 * (1 - alpha)})`;

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(toSX(xn), toSY(0));
      ctx.lineTo(toSX(xn), toSY(fxn));
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(toSX(xMin), toSY(fxn + dfxn * (xMin - xn)));
      ctx.lineTo(toSX(xMax), toSY(fxn + dfxn * (xMax - xn)));
      ctx.stroke();

      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(toSX(xn), toSY(fxn), 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (iteration > 0 && iterations[iteration]) {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(toSX(iterations[iteration]), toSY(0), 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#22d3ee';
    ctx.font = '11px monospace';
    ctx.fillText(preset.label2, 8, 18);
  }, [preset, iteration, iterations]);

  useEffect(() => {
    if (expanded) draw();
  }, [expanded, draw]);

  useEffect(() => {
    setIteration(1);
  }, [presetIdx]);

  const xn = iterations[Math.min(iteration, iterations.length - 1)];
  const err = Math.abs(preset.fn(xn));

  useEffect(() => {
    if (err < 1e-6) {
      store.markNewtonConvergence(iteration);
      if (iteration <= 5) store.earnBadge('newton-rapide');
    }
  }, [err, iteration, store]);

  return (
    <div className="bg-slate-900/50 border border-green-500/20 rounded-2xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors" aria-label="Afficher le lab méthode de Newton">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <span className="font-bold text-green-300 text-sm">Méthode de Newton — Visualisation</span>
          <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">Lab Interactif</span>
        </div>
        <span className="text-slate-500 text-sm">{expanded ? '▲ Réduire' : '▼ Ouvrir'}</span>
      </button>
      {expanded && (
        <div className="p-4 pt-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p, i) => (
              <button key={p.label} onClick={() => setPresetIdx(i)} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${presetIdx === i ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-slate-800 text-slate-300 border border-transparent'}`}>{p.label}</button>
            ))}
          </div>
          <div>
            <div className="flex justify-between mb-1"><span className="text-xs font-bold text-slate-300">Itération $n$</span><span className="text-xs font-mono text-green-300">{iteration}</span></div>
            <input type="range" min={1} max={Math.max(1, iterations.length - 1)} value={iteration} onChange={(e) => setIteration(+e.target.value)} className="w-full h-1.5 bg-slate-700 rounded accent-green-500" />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {iterations.slice(0, iteration + 1).map((x, i) => (
              <span key={i} className="bg-slate-800 px-2 py-1 rounded text-slate-200 font-mono">$x_{i}$ = {x.toFixed(8)}</span>
            ))}
          </div>
          {err < 1e-10 && <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-2 text-center text-green-400 text-xs font-bold">✓ Convergé ! $|f(x_n)| &lt; 10^-10$</div>}
          <div className="rounded-xl overflow-hidden border border-slate-700/50"><canvas ref={canvasRef} width={560} height={320} className="w-full" /></div>
        </div>
      )}
    </div>
  );
}
