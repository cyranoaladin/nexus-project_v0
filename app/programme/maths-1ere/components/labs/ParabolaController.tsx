'use client';

import { useState, useMemo } from 'react';
import { Mafs, Coordinates, Plot, Theme, Text as MafsText, Point } from 'mafs';
import 'mafs/core.css';

/**
 * CdC §4.1.2 — "Le Contrôleur de Parabole"
 * 3 sliders (a, b, c) with real-time parabola update.
 * Visual feedback on discriminant (color-coded), vertex, and roots.
 */

export default function ParabolaController() {
  const [a, setA] = useState(1);
  const [b, setB] = useState(0);
  const [c, setC] = useState(-1);
  const [expanded, setExpanded] = useState(false);

  const delta = useMemo(() => b * b - 4 * a * c, [a, b, c]);
  const alpha = useMemo(() => (a !== 0 ? -b / (2 * a) : 0), [a, b]);
  const beta = useMemo(() => (a !== 0 ? a * alpha * alpha + b * alpha + c : c), [a, b, c, alpha]);

  const roots = useMemo(() => {
    if (a === 0) return [];
    if (delta < 0) return [];
    if (delta === 0) return [alpha];
    const sqrtD = Math.sqrt(delta);
    return [(-b - sqrtD) / (2 * a), (-b + sqrtD) / (2 * a)];
  }, [a, b, delta, alpha]);

  const isDegenerate = Math.abs(a) < 0.001;
  const deltaColor = isDegenerate ? 'text-slate-400' : delta > 0 ? 'text-green-400' : delta === 0 ? 'text-amber-400' : 'text-red-400';
  const deltaBg = isDegenerate ? 'bg-slate-500/10 border-slate-500/30' : delta > 0 ? 'bg-green-500/10 border-green-500/30' : delta === 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30';

  const f = (x: number) => a * x * x + b * x + c;

  return (
    <div className="bg-slate-900/50 border border-cyan-500/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🎛️</span>
          <span className="font-bold text-cyan-300 text-sm">Le Contrôleur de Parabole</span>
          <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full">Lab Interactif</span>
        </div>
        <span className="text-slate-500 text-sm">{expanded ? '▲ Réduire' : '▼ Ouvrir'}</span>
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-4">
          {/* Sliders */}
          <div className="grid grid-cols-3 gap-4">
            <SliderControl label="a" value={a} onChange={setA} min={-5} max={5} step={0.1} color="text-cyan-400" />
            <SliderControl label="b" value={b} onChange={setB} min={-10} max={10} step={0.5} color="text-blue-400" />
            <SliderControl label="c" value={c} onChange={setC} min={-10} max={10} step={0.5} color="text-purple-400" />
          </div>

          {/* Degenerate case warning (a ≈ 0) */}
          {isDegenerate && (
            <div className="rounded-xl p-3 border bg-amber-500/10 border-amber-500/30">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-bold text-xs">⚠️ a ≈ 0 : ce n&apos;est plus une parabole !</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Quand a = 0, f(x) = bx + c est une <strong className="text-white">fonction affine</strong> (droite).
                Le discriminant, le sommet et la notion de concavité n&apos;ont plus de sens.
                {b !== 0 ? ` La droite coupe l'axe des x en x = ${(-c / b).toFixed(2)}.` : c === 0 ? ' La droite est confondue avec l\'axe des x.' : ' La droite est horizontale (y = ' + c.toFixed(1) + ').'}
              </p>
            </div>
          )}

          {/* Discriminant info (only for true parabola) */}
          {!isDegenerate && (
            <div className={`rounded-xl p-3 border ${deltaBg}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-400">Δ = b² − 4ac = </span>
                  <span className={`font-bold font-mono ${deltaColor}`}>{delta.toFixed(2)}</span>
                </div>
                <div className={`text-xs font-bold ${deltaColor}`}>
                  {delta > 0 ? '✓ 2 racines distinctes' : delta === 0 ? '• 1 racine double' : '✗ Pas de racine réelle'}
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Sommet S({alpha.toFixed(2)} ; {beta.toFixed(2)})
                {a > 0 ? ' — Parabole ouverte vers le haut (minimum)' : ' — Parabole ouverte vers le bas (maximum)'}
                {roots.length > 0 && (
                  <span className="ml-3">
                    Racines : {roots.map((r) => r.toFixed(2)).join(' ; ')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Graph */}
          <div className="rounded-xl overflow-hidden border border-slate-700/50 bg-white">
            <Mafs viewBox={{ x: [-6, 6], y: [-8, 8] }} preserveAspectRatio={false} height={320}>
              <Coordinates.Cartesian />
              {/* Parabola or line depending on a */}
              <Plot.OfX
                y={f}
                color={isDegenerate ? Theme.blue : delta > 0 ? Theme.green : delta === 0 ? Theme.yellow : Theme.red}
              />
              {/* Vertex (only for parabola) */}
              {!isDegenerate && <Point x={alpha} y={beta} color={Theme.blue} />}
              {/* Roots */}
              {roots.map((r, i) => (
                <Point key={i} x={r} y={0} color={Theme.green} />
              ))}
              {/* Line root when a=0 */}
              {isDegenerate && b !== 0 && <Point x={-c / b} y={0} color={Theme.green} />}
              {/* Vertex label */}
              {!isDegenerate && (
                <MafsText x={alpha + 0.5} y={beta + 0.5} size={12}>
                  S
                </MafsText>
              )}
            </Mafs>
          </div>

          {/* Equation display */}
          <div className="text-center text-sm font-mono text-slate-300">
            f(x) = {isDegenerate
              ? `${b !== 0 ? (b !== 1 && b !== -1 ? b : b === -1 ? '−' : '') + 'x' : ''}${c !== 0 ? ` ${c > 0 && b !== 0 ? '+' : c < 0 ? '−' : ''} ${c !== 0 ? Math.abs(c) : ''}` : b === 0 ? '0' : ''}`
              : `${a !== 1 && a !== -1 ? a : a === -1 ? '−' : ''}x²${b !== 0 ? ` ${b > 0 ? '+' : '−'} ${Math.abs(b) !== 1 ? Math.abs(b) : ''}x` : ''}${c !== 0 ? ` ${c > 0 ? '+' : '−'} ${Math.abs(c)}` : ''}`
            }
          </div>
        </div>
      )}
    </div>
  );
}

function SliderControl({ label, value, onChange, min, max, step, color }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; color: string;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className={`text-xs font-bold ${color}`}>{label}</span>
        <span className="text-xs font-mono text-slate-400">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-cyan-500"
      />
    </div>
  );
}
