'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useMathsLabStore } from '../../store';

export default function EulerExponentielle() {
  const [expanded, setExpanded] = useState(false);
  const [steps, setSteps] = useState(10);
  const [xMax, setXMax] = useState(3);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const store = useMathsLabStore();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const PAD = 40;
    const graphW = W - 2 * PAD;
    const graphH = H - 2 * PAD;

    const toX = (x: number) => PAD + (x / xMax) * graphW;
    const toY = (y: number) => H - PAD - (y / Math.exp(xMax)) * graphH;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(34,211,238,0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const x = (i / 200) * xMax;
      const y = Math.exp(x);
      const cx = toX(x);
      const cy = toY(y);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const h = xMax / steps;
    let x = 0;
    let y = 1;
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(1));
    for (let i = 0; i < steps; i++) {
      const yNext = y + h * y;
      x += h;
      y = yNext;
      ctx.lineTo(toX(x), toY(y));
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(toX(x), toY(y), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(34,211,238,0.7)';
    ctx.font = '12px monospace';
    ctx.fillText('y = eˣ (exact)', 8, 18);
    ctx.fillStyle = '#f97316';
    ctx.fillText(`Euler (${steps} pas) : erreur ≈ ${Math.abs(y - Math.exp(xMax)).toFixed(4)}`, 8, 36);

    ctx.strokeStyle = 'rgba(148,163,184,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, 0);
    ctx.lineTo(PAD, H);
    ctx.moveTo(0, H - PAD);
    ctx.lineTo(W, H - PAD);
    ctx.stroke();
  }, [steps, xMax]);

  useEffect(() => {
    if (expanded) draw();
  }, [expanded, draw]);

  useEffect(() => {
    store.markEulerSteps(steps);
    if (steps >= 50) store.earnBadge('euler-fan');
  }, [steps, store]);

  const eulerFinal = (() => {
    const h = xMax / steps;
    let y = 1;
    for (let i = 0; i < steps; i++) y += h * y;
    return y;
  })();

  return (
    <div className="bg-slate-900/50 border border-orange-500/20 rounded-2xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors" aria-label="Afficher le lab Euler exponentielle">
        <div className="flex items-center gap-2">
          <span className="text-lg">🌱</span>
          <span className="font-bold text-orange-300 text-sm">Construction de e^x par Euler</span>
          <span className="text-[10px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full">Lab Interactif</span>
        </div>
        <span className="text-slate-500 text-sm">{expanded ? '▲ Réduire' : '▼ Ouvrir'}</span>
      </button>
      {expanded && (
        <div className="p-4 pt-0 space-y-3">
          <p className="text-xs text-slate-400">La fonction exponentielle est l'unique solution de $f' = f$ avec $f(0)=1$.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between mb-1"><span className="text-xs text-slate-300 font-bold">Nombre de pas $n$</span><span className="text-xs font-mono text-orange-300">{steps}</span></div>
              <input type="range" min={2} max={50} value={steps} onChange={(e) => setSteps(+e.target.value)} className="w-full h-1.5 bg-slate-700 rounded accent-orange-500" />
            </div>
            <div>
              <div className="flex justify-between mb-1"><span className="text-xs text-slate-300 font-bold">{"$x_{\\max}$"}</span><span className="text-xs font-mono text-orange-300">{xMax}</span></div>
              <input type="range" min={1} max={5} step={0.5} value={xMax} onChange={(e) => setXMax(+e.target.value)} className="w-full h-1.5 bg-slate-700 rounded accent-orange-500" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-slate-800 px-2 py-1 rounded text-orange-300 font-mono">Euler($x={xMax}$) ≈ {eulerFinal.toFixed(6)}</span>
            <span className="bg-slate-800 px-2 py-1 rounded text-cyan-300 font-mono">{"$e^{x_{\\max}}$"} = {Math.exp(xMax).toFixed(6)}</span>
            <span className="bg-slate-800 px-2 py-1 rounded text-white font-mono">Erreur = {Math.abs(eulerFinal - Math.exp(xMax)).toFixed(6)}</span>
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-700/50">
            <canvas ref={canvasRef} width={600} height={350} className="w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
