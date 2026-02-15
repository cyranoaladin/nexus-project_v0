'use client';

import { useState, useMemo } from 'react';
import { Mafs, Coordinates, Plot, Theme, Point, Line, Text as MafsText } from 'mafs';
import 'mafs/core.css';

/**
 * CdC §4.2.1 — "La Tangente Glissante"
 * Synchronized dual graph: f(x) on top, f'(x) on bottom.
 * Slider to move the tangent point along the curve.
 * Shows tangent line, derivative value, croissance/décroissance zones,
 * and a synchronized vertical cursor on both graphs.
 */

interface TangenteGlissanteProps {
  /** Function expression (default: x^3 - 3x) */
  fnExpr?: string;
  /** Title */
  title?: string;
}

export default function TangenteGlissante({
  fnExpr = 'x^3 - 3*x',
  title = 'La Tangente Glissante',
}: TangenteGlissanteProps) {
  const [a, setA] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // f(x) = x³ - 3x, f'(x) = 3x² - 3
  const f = useMemo(() => {
    if (fnExpr === 'x^3 - 3*x') return (x: number) => x * x * x - 3 * x;
    if (fnExpr === 'x^2') return (x: number) => x * x;
    if (fnExpr === 'sin(x)') return (x: number) => Math.sin(x);
    return (x: number) => x * x * x - 3 * x;
  }, [fnExpr]);

  const fPrime = useMemo(() => {
    if (fnExpr === 'x^3 - 3*x') return (x: number) => 3 * x * x - 3;
    if (fnExpr === 'x^2') return (x: number) => 2 * x;
    if (fnExpr === 'sin(x)') return (x: number) => Math.cos(x);
    return (x: number) => 3 * x * x - 3;
  }, [fnExpr]);

  // Positive part of f' (for green shading)
  const fPrimePos = useMemo(() => (x: number) => Math.max(0, fPrime(x)), [fPrime]);
  // Negative part of f' (for red shading)
  const fPrimeNeg = useMemo(() => (x: number) => Math.min(0, fPrime(x)), [fPrime]);

  const fa = f(a);
  const fpa = fPrime(a);

  // Tangent line: y = f'(a)(x - a) + f(a)
  const tangent = (x: number) => fpa * (x - a) + fa;

  const variation = fpa > 0.01 ? '↗ Croissante' : fpa < -0.01 ? '↘ Décroissante' : '→ Extremum';
  const variationColor = fpa > 0.01 ? 'text-green-400' : fpa < -0.01 ? 'text-red-400' : 'text-amber-400';
  const variationBg = fpa > 0.01 ? 'bg-green-500/10 border-green-500/20' : fpa < -0.01 ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20';

  return (
    <div className="bg-slate-900/50 border border-blue-500/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📐</span>
          <span className="font-bold text-blue-300 text-sm">{title}</span>
          <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">Lab Interactif</span>
        </div>
        <span className="text-slate-500 text-sm">{expanded ? '▲ Réduire' : '▼ Ouvrir'}</span>
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-3">
          {/* Slider for point a */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-blue-400 w-8">a =</span>
            <input
              type="range"
              min={-3}
              max={3}
              step={0.05}
              value={a}
              onChange={(e) => setA(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-xs font-mono text-slate-400 w-12 text-right">{a.toFixed(2)}</span>
          </div>

          {/* Info bar */}
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="bg-slate-800 px-2 py-1 rounded text-slate-300">
              f({a.toFixed(1)}) = <span className="text-white font-bold">{fa.toFixed(2)}</span>
            </span>
            <span className="bg-slate-800 px-2 py-1 rounded text-slate-300">
              f&apos;({a.toFixed(1)}) = <span className="text-white font-bold">{fpa.toFixed(2)}</span>
            </span>
            <span className={`px-2 py-1 rounded font-bold border ${variationBg} ${variationColor}`}>
              {variation}
            </span>
          </div>

          {/* Top graph: f(x) with tangent + synced cursor */}
          <div>
            <div className="text-xs text-slate-500 mb-1 font-bold">f(x) et tangente</div>
            <div className="rounded-xl overflow-hidden border border-slate-700/50 bg-white">
              <Mafs viewBox={{ x: [-4, 4], y: [-6, 6] }} preserveAspectRatio={false} height={220}>
                <Coordinates.Cartesian />
                <Plot.OfX y={f} color={Theme.blue} />
                <Plot.OfX y={tangent} color={Theme.orange} opacity={0.7} />
                <Point x={a} y={fa} color={Theme.orange} />
                {/* Synchronized vertical cursor */}
                <Line.Segment point1={[a, -6]} point2={[a, 6]} color={Theme.orange} opacity={0.15} />
                <MafsText x={a + 0.3} y={fa + 0.5} size={11}>
                  ({a.toFixed(1)}, {fa.toFixed(1)})
                </MafsText>
              </Mafs>
            </div>
          </div>

          {/* Bottom graph: f'(x) synchronized with colored zones */}
          <div>
            <div className="text-xs text-slate-500 mb-1 font-bold">f&apos;(x) — signe et variations</div>
            <div className="rounded-xl overflow-hidden border border-slate-700/50 bg-white">
              <Mafs viewBox={{ x: [-4, 4], y: [-5, 5] }} preserveAspectRatio={false} height={180}>
                <Coordinates.Cartesian />
                {/* Colored zones: green where f'(x) > 0, red where f'(x) < 0 */}
                <Plot.OfX y={fPrimePos} color="#22c55e" opacity={0.15} />
                <Plot.OfX y={fPrimeNeg} color="#ef4444" opacity={0.15} />
                {/* f'(x) curve */}
                <Plot.OfX y={fPrime} color={Theme.red} />
                {/* Horizontal line at y=0 */}
                <Line.Segment point1={[-4, 0]} point2={[4, 0]} color={Theme.foreground} opacity={0.3} />
                {/* Synchronized vertical cursor */}
                <Line.Segment point1={[a, -5]} point2={[a, 5]} color={Theme.orange} opacity={0.15} />
                {/* Current point on f' */}
                <Point x={a} y={fpa} color={Theme.orange} />
                {/* Vertical line from point to x-axis */}
                <Line.Segment point1={[a, 0]} point2={[a, fpa]} color={Theme.orange} opacity={0.4} />
                <MafsText x={a + 0.3} y={fpa + 0.4} size={11}>
                  f&apos;={fpa.toFixed(1)}
                </MafsText>
              </Mafs>
            </div>
          </div>

          {/* Dynamic pedagogical explanation */}
          <div className={`rounded-xl border p-3 text-center transition-all ${variationBg}`}>
            <p className={`text-xs font-bold ${variationColor}`}>
              {fpa > 0.01
                ? `f'(${a.toFixed(1)}) = ${fpa.toFixed(2)} > 0 → f est CROISSANTE en a = ${a.toFixed(1)}`
                : fpa < -0.01
                  ? `f'(${a.toFixed(1)}) = ${fpa.toFixed(2)} < 0 → f est DÉCROISSANTE en a = ${a.toFixed(1)}`
                  : `f'(${a.toFixed(1)}) ≈ 0 → EXTREMUM local possible en a = ${a.toFixed(1)}`
              }
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              {fpa > 0.01
                ? 'La pente de la tangente est positive (tangente inclinée ↗). La courbe monte.'
                : fpa < -0.01
                  ? 'La pente de la tangente est négative (tangente inclinée ↘). La courbe descend.'
                  : 'La tangente est quasi horizontale. Cherchez un maximum ou un minimum local.'
              }
            </p>
          </div>

          <p className="text-[10px] text-slate-600 text-center">
            Déplacez le curseur pour voir la tangente glisser le long de la courbe.
            Les zones <span className="text-green-400">vertes</span> sur f&apos;(x) indiquent f croissante,
            les zones <span className="text-red-400">rouges</span> f décroissante.
          </p>
        </div>
      )}
    </div>
  );
}

