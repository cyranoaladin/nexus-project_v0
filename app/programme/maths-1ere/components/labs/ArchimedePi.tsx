'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useMathsLabStore } from '../../store';

export default function ArchimedePi() {
  const [expanded, setExpanded] = useState(false);
  const [n, setN] = useState(6);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const store = useMathsLabStore();

  const piLow = n * Math.sin(Math.PI / n);
  const piHigh = n * Math.tan(Math.PI / n);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.38;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(34,211,238,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(34,211,238,0.05)';
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      const px = cx + R * Math.cos(angle);
      const py = cy + R * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.fill();
    ctx.stroke();

    const rout = R / Math.cos(Math.PI / n);
    ctx.strokeStyle = 'rgba(249,115,22,0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2 + Math.PI / n;
      const px = cx + rout * Math.cos(angle);
      const py = cy + rout * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`Inscrit (${n} côtés) : π ≥ ${piLow.toFixed(8)}`, 8, 20);
    ctx.fillStyle = '#f97316';
    ctx.fillText(`Circonscrit : π ≤ ${piHigh.toFixed(8)}`, 8, 38);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px monospace';
    ctx.fillText(`π réel = ${Math.PI.toFixed(8)}`, 8, 56);
  }, [n, piLow, piHigh]);

  useEffect(() => {
    if (expanded) draw();
  }, [expanded, draw]);

  return (
    <div className="bg-slate-900/50 border border-cyan-500/20 rounded-2xl overflow-hidden">
      <button onClick={() => {
        const next = !expanded;
        setExpanded(next);
        if (next) {
          store.markLabArchimedeOpened();
          store.earnBadge('archimede');
        }
      }} className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors" aria-label="Afficher le lab Archimède">
        <div className="flex items-center gap-2">
          <span className="text-lg">π</span>
          <span className="font-bold text-cyan-300 text-sm">Méthode d'Archimède — Approximation de π</span>
          <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full">Lab Interactif</span>
        </div>
        <span className="text-slate-500 text-sm">{expanded ? '▲ Réduire' : '▼ Ouvrir'}</span>
      </button>
      {expanded && (
        <div className="p-4 pt-0 space-y-3">
          <p className="text-xs text-slate-400">Archimède encadre π entre polygones inscrits et circonscrits.</p>
          <div>
            <div className="flex justify-between mb-1"><span className="text-xs font-bold text-slate-300">Nombre de côtés $n$</span><span className="text-xs font-mono text-cyan-300">{n}</span></div>
            <input type="range" min={3} max={100} value={n} onChange={(e) => setN(+e.target.value)} className="w-full h-1.5 bg-slate-700 rounded accent-cyan-500" />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded text-cyan-300 font-mono">{piLow.toFixed(8)} ≤ π</span>
            <span className="bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded text-orange-300 font-mono">π ≤ {piHigh.toFixed(8)}</span>
            <span className="bg-green-500/10 border border-green-500/20 px-2 py-1 rounded text-green-300 font-mono">Largeur : {(piHigh - piLow).toExponential(2)}</span>
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-700/50">
            <canvas ref={canvasRef} width={500} height={350} className="w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
