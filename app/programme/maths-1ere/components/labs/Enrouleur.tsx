'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * CdC §4.2.3 — "L'Enrouleur"
 * Synchronized animation: unit circle on the left, sinusoid on the right.
 * A point moves around the circle; its y-coordinate traces sin(θ) and x-coordinate traces cos(θ).
 * Slider to control θ manually or auto-play animation.
 */

type DisplayMode = 'sin' | 'cos' | 'both';

export default function Enrouleur() {
  const [expanded, setExpanded] = useState(false);
  const [theta, setTheta] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<DisplayMode>('sin');
  const [speed, setSpeed] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const thetaRef = useRef(theta);

  // Keep ref in sync for animation loop
  thetaRef.current = theta;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const t = thetaRef.current;

    // Layout: circle on left (square area), graph on right
    const circleR = Math.min(H * 0.38, W * 0.2);
    const circleCx = W * 0.22;
    const circleCy = H * 0.5;

    // Graph area
    const graphLeft = W * 0.42;
    const graphRight = W - 20;
    const graphTop = 30;
    const graphBottom = H - 30;
    const graphCy = (graphTop + graphBottom) / 2;
    const graphAmp = (graphBottom - graphTop) * 0.4;
    const graphWidth = graphRight - graphLeft;

    // Clear
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // ─── UNIT CIRCLE ───────────────────────────────────────────────
    // Circle outline
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(circleCx, circleCy, circleR, 0, Math.PI * 2);
    ctx.stroke();

    // Axes through circle center
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(circleCx - circleR - 10, circleCy);
    ctx.lineTo(circleCx + circleR + 10, circleCy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(circleCx, circleCy - circleR - 10);
    ctx.lineTo(circleCx, circleCy + circleR + 10);
    ctx.stroke();

    // Arc swept (colored)
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.3)';
    ctx.lineWidth = circleR * 0.15;
    ctx.beginPath();
    ctx.arc(circleCx, circleCy, circleR * 0.85, -Math.PI / 2, t - Math.PI / 2, false);
    ctx.stroke();

    // Point on circle
    const px = circleCx + circleR * Math.cos(t);
    const py = circleCy - circleR * Math.sin(t); // canvas y is inverted

    // Radius line
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(circleCx, circleCy);
    ctx.lineTo(px, py);
    ctx.stroke();

    // Projection lines
    if (mode === 'sin' || mode === 'both') {
      // Horizontal dashed line from point to y-axis projection → to graph
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(graphLeft, py);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (mode === 'cos' || mode === 'both') {
      // Vertical dashed line from point to x-axis projection
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, circleCy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Point on circle (filled)
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();

    // sin projection on y-axis
    if (mode === 'sin' || mode === 'both') {
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(circleCx, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // cos projection on x-axis
    if (mode === 'cos' || mode === 'both') {
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(px, circleCy, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Circle labels
    ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.font = '10px monospace';
    ctx.fillText('1', circleCx + circleR + 4, circleCy + 12);
    ctx.fillText('−1', circleCx - circleR - 18, circleCy + 12);
    ctx.fillText('1', circleCx + 4, circleCy - circleR - 4);
    ctx.fillText('−1', circleCx + 4, circleCy + circleR + 14);

    // θ label
    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`θ = ${(t / Math.PI).toFixed(2)}π`, circleCx - circleR, circleCy + circleR + 30);

    // ─── GRAPH (sinusoid / cosinusoid) ─────────────────────────────
    // Graph axes
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    // Horizontal axis (y=0)
    ctx.beginPath();
    ctx.moveTo(graphLeft, graphCy);
    ctx.lineTo(graphRight, graphCy);
    ctx.stroke();
    // Vertical axis at left
    ctx.beginPath();
    ctx.moveTo(graphLeft, graphTop);
    ctx.lineTo(graphLeft, graphBottom);
    ctx.stroke();

    // Graph grid lines (π, 2π, etc.)
    ctx.fillStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.font = '9px monospace';
    const maxTheta = 4 * Math.PI;
    for (let k = 1; k <= 4; k++) {
      const gx = graphLeft + (k * Math.PI / maxTheta) * graphWidth;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.beginPath();
      ctx.moveTo(gx, graphTop);
      ctx.lineTo(gx, graphBottom);
      ctx.stroke();
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.fillText(`${k}π`, gx - 6, graphBottom + 14);
    }

    // +1 / -1 labels
    ctx.fillStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.fillText('+1', graphLeft - 18, graphCy - graphAmp + 4);
    ctx.fillText('−1', graphLeft - 18, graphCy + graphAmp + 4);

    // Draw sin curve (full)
    if (mode === 'sin' || mode === 'both') {
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= graphWidth; i++) {
        const angle = (i / graphWidth) * maxTheta;
        const gy = graphCy - Math.sin(angle) * graphAmp;
        if (i === 0) ctx.moveTo(graphLeft + i, gy);
        else ctx.lineTo(graphLeft + i, gy);
      }
      ctx.stroke();

      // Draw traced portion (up to current θ)
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const tClamp = Math.min(t, maxTheta);
      const tracePx = (tClamp / maxTheta) * graphWidth;
      for (let i = 0; i <= tracePx; i++) {
        const angle = (i / graphWidth) * maxTheta;
        const gy = graphCy - Math.sin(angle) * graphAmp;
        if (i === 0) ctx.moveTo(graphLeft + i, gy);
        else ctx.lineTo(graphLeft + i, gy);
      }
      ctx.stroke();

      // Current point on sin graph
      const sinGx = graphLeft + (tClamp / maxTheta) * graphWidth;
      const sinGy = graphCy - Math.sin(t) * graphAmp;
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(sinGx, sinGy, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw cos curve (full)
    if (mode === 'cos' || mode === 'both') {
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= graphWidth; i++) {
        const angle = (i / graphWidth) * maxTheta;
        const gy = graphCy - Math.cos(angle) * graphAmp;
        if (i === 0) ctx.moveTo(graphLeft + i, gy);
        else ctx.lineTo(graphLeft + i, gy);
      }
      ctx.stroke();

      // Draw traced portion
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const tClamp = Math.min(t, maxTheta);
      const tracePx = (tClamp / maxTheta) * graphWidth;
      for (let i = 0; i <= tracePx; i++) {
        const angle = (i / graphWidth) * maxTheta;
        const gy = graphCy - Math.cos(angle) * graphAmp;
        if (i === 0) ctx.moveTo(graphLeft + i, gy);
        else ctx.lineTo(graphLeft + i, gy);
      }
      ctx.stroke();

      // Current point on cos graph
      const cosGx = graphLeft + (tClamp / maxTheta) * graphWidth;
      const cosGy = graphCy - Math.cos(t) * graphAmp;
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(cosGx, cosGy, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Legend
    ctx.font = 'bold 11px monospace';
    if (mode === 'sin' || mode === 'both') {
      ctx.fillStyle = '#f97316';
      ctx.fillText(`sin(θ) = ${Math.sin(t).toFixed(3)}`, graphLeft + 4, graphTop + 14);
    }
    if (mode === 'cos' || mode === 'both') {
      ctx.fillStyle = '#a855f7';
      ctx.fillText(`cos(θ) = ${Math.cos(t).toFixed(3)}`, graphLeft + 4, graphTop + (mode === 'both' ? 28 : 14));
    }
  }, [mode]);

  // Animation loop
  useEffect(() => {
    if (!playing || !expanded) return;

    let lastTime = 0;
    const animate = (time: number) => {
      if (lastTime > 0) {
        const dt = (time - lastTime) / 1000;
        const newTheta = thetaRef.current + dt * speed * 1.2;
        if (newTheta > 4 * Math.PI) {
          setTheta(0);
          thetaRef.current = 0;
        } else {
          setTheta(newTheta);
          thetaRef.current = newTheta;
        }
      }
      lastTime = time;
      draw();
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, expanded, speed, draw]);

  // Redraw on manual theta change
  useEffect(() => {
    if (!playing && expanded) draw();
  }, [theta, expanded, playing, draw]);

  return (
    <div className="bg-slate-900/50 border border-purple-500/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🎡</span>
          <span className="font-bold text-purple-300 text-sm">L&apos;Enrouleur</span>
          <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full">Lab Interactif</span>
        </div>
        <span className="text-slate-500 text-sm">{expanded ? '▲ Réduire' : '▼ Ouvrir'}</span>
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-3">
          {/* Mode selector */}
          <div className="flex gap-2">
            {([
              { id: 'sin' as DisplayMode, label: '🟠 sin(θ)', color: 'orange' },
              { id: 'cos' as DisplayMode, label: '🟣 cos(θ)', color: 'purple' },
              { id: 'both' as DisplayMode, label: '🔵 sin + cos', color: 'blue' },
            ]).map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex-1 text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                  mode === m.id
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPlaying(!playing)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                playing
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-green-500/20 text-green-400 border border-green-500/30'
              }`}
            >
              {playing ? '⏸ Pause' : '▶ Animer'}
            </button>
            <button
              onClick={() => { setTheta(0); thetaRef.current = 0; }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all"
            >
              ↺ Reset
            </button>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-[10px] font-bold text-slate-500">Vitesse</span>
                <span className="text-[10px] font-mono text-slate-500">×{speed.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.1}
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          </div>

          {/* Manual θ slider (when paused) */}
          {!playing && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-cyan-400">θ</span>
                <span className="text-xs font-mono text-slate-400">{(theta / Math.PI).toFixed(2)}π rad = {(theta * 180 / Math.PI).toFixed(0)}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={4 * Math.PI}
                step={0.01}
                value={theta}
                onChange={(e) => { setTheta(parseFloat(e.target.value)); thetaRef.current = parseFloat(e.target.value); }}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          )}

          {/* Values display */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-slate-800 px-2 py-1 rounded text-cyan-300">
              θ = <span className="font-bold">{(theta / Math.PI).toFixed(2)}π</span>
            </span>
            <span className="bg-slate-800 px-2 py-1 rounded text-orange-300">
              sin(θ) = <span className="font-bold">{Math.sin(theta).toFixed(4)}</span>
            </span>
            <span className="bg-slate-800 px-2 py-1 rounded text-purple-300">
              cos(θ) = <span className="font-bold">{Math.cos(theta).toFixed(4)}</span>
            </span>
            <span className="bg-slate-800 px-2 py-1 rounded text-slate-400">
              sin² + cos² = <span className="font-bold text-green-400">{(Math.sin(theta) ** 2 + Math.cos(theta) ** 2).toFixed(4)}</span>
            </span>
          </div>

          {/* Canvas */}
          <div className="rounded-xl overflow-hidden border border-slate-700/50">
            <canvas
              ref={canvasRef}
              width={700}
              height={350}
              className="w-full"
              style={{ imageRendering: 'auto' }}
            />
          </div>

          <p className="text-[10px] text-slate-600 text-center">
            Le point se déplace sur le cercle trigonométrique. Sa projection verticale trace sin(θ),
            sa projection horizontale trace cos(θ). Remarquez que sin²(θ) + cos²(θ) = 1 toujours.
          </p>
        </div>
      )}
    </div>
  );
}
