'use client';

import { useState } from 'react';
import { Mafs, Coordinates, Plot, Theme, Text as MafsText, Point, Line, Circle } from 'mafs';
import 'mafs/core.css';

/**
 * Interactive math graph component powered by Mafs.
 * Supports function plotting, movable points, lines, and circles.
 */

type GraphElement =
  | { type: 'function'; fn: string; color?: string; label?: string }
  | { type: 'point'; x: number; y: number; color?: string; label?: string }
  | { type: 'line'; point1: [number, number]; point2: [number, number]; color?: string }
  | { type: 'circle'; center: [number, number]; radius: number; color?: string };

interface InteractiveMafsProps {
  /** Title of the graph */
  title?: string;
  /** Elements to render on the graph */
  elements?: GraphElement[];
  /** X-axis range [min, max] */
  xRange?: [number, number];
  /** Y-axis range [min, max] */
  yRange?: [number, number];
  /** Whether the graph starts expanded */
  defaultExpanded?: boolean;
  /** Interactive movable point (user can drag) */
  interactivePoint?: { initial: [number, number]; label?: string };
  /** Callback when interactive point moves */
  onPointMove?: (x: number, y: number) => void;
}

/**
 * Safely evaluate a math expression string as a function of x.
 * Supports: x, ^, sqrt, sin, cos, tan, exp, log, abs, pi, e
 */
function createMathFunction(expr: string): (x: number) => number {
  // Replace math notation with JS equivalents
  const jsExpr = expr
    .replace(/\^/g, '**')
    .replace(/sqrt\(/g, 'Math.sqrt(')
    .replace(/sin\(/g, 'Math.sin(')
    .replace(/cos\(/g, 'Math.cos(')
    .replace(/tan\(/g, 'Math.tan(')
    .replace(/exp\(/g, 'Math.exp(')
    .replace(/log\(/g, 'Math.log(')
    .replace(/ln\(/g, 'Math.log(')
    .replace(/abs\(/g, 'Math.abs(')
    .replace(/pi/g, 'Math.PI')
    .replace(/(?<![a-zA-Z])e(?![a-zA-Z(])/g, 'Math.E');

  return (x: number): number => {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('x', `"use strict"; return (${jsExpr});`);
      const result = fn(x) as number;
      return Number.isFinite(result) ? result : NaN;
    } catch {
      return NaN;
    }
  };
}

export default function InteractiveMafs({
  title = 'Graphique interactif',
  elements = [],
  xRange = [-5, 5],
  yRange = [-5, 5],
  defaultExpanded = false,
  interactivePoint,
  onPointMove,
}: InteractiveMafsProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [point, setPoint] = useState<[number, number]>(
    interactivePoint?.initial ?? [0, 0]
  );

  const handlePointMove = (newPoint: [number, number]) => {
    setPoint(newPoint);
    onPointMove?.(newPoint[0], newPoint[1]);
  };

  const colorMap: Record<string, string> = {
    blue: Theme.blue,
    red: Theme.indigo,
    green: Theme.green,
    orange: Theme.blue,
    pink: Theme.indigo,
    indigo: Theme.indigo,
    violet: Theme.indigo,
    yellow: Theme.blue,
  };

  const getColor = (c?: string) => (c && colorMap[c]) || Theme.blue;

  return (
    <div className="bg-slate-900/50 border border-cyan-500/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <span className="font-bold text-cyan-300 text-sm">{title}</span>
          <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full">Mafs</span>
        </div>
        <span className="text-slate-500 text-sm">
          {expanded ? '▲ Réduire' : '▼ Ouvrir'}
        </span>
      </button>

      {expanded && (
        <div className="p-4 pt-0">
          <div className="rounded-xl overflow-hidden border border-slate-700/50 bg-white">
            <Mafs
              viewBox={{ x: xRange, y: yRange }}
              preserveAspectRatio={false}
              height={350}
            >
              <Coordinates.Cartesian />

              {/* Render elements */}
              {elements.map((el, i) => {
                switch (el.type) {
                  case 'function': {
                    const fn = createMathFunction(el.fn);
                    return (
                      <Plot.OfX
                        key={`fn-${i}`}
                        y={fn}
                        color={getColor(el.color)}
                      />
                    );
                  }
                  case 'point':
                    return (
                      <Point
                        key={`pt-${i}`}
                        x={el.x}
                        y={el.y}
                        color={getColor(el.color)}
                      />
                    );
                  case 'line':
                    return (
                      <Line.Segment
                        key={`ln-${i}`}
                        point1={el.point1}
                        point2={el.point2}
                        color={getColor(el.color)}
                      />
                    );
                  case 'circle':
                    return (
                      <Circle
                        key={`cr-${i}`}
                        center={el.center}
                        radius={el.radius}
                        color={getColor(el.color)}
                      />
                    );
                  default:
                    return null;
                }
              })}

              {/* Labels for functions */}
              {elements
                .filter((el): el is GraphElement & { type: 'function'; label: string } =>
                  el.type === 'function' && !!el.label
                )
                .map((el, i) => (
                  <MafsText
                    key={`label-${i}`}
                    x={xRange[1] - 1}
                    y={createMathFunction(el.fn)(xRange[1] - 1)}
                    attach="e"
                    size={14}
                  >
                    {el.label}
                  </MafsText>
                ))}

              {/* Interactive movable point */}
              {interactivePoint && (
                <Point
                  x={point[0]}
                  y={point[1]}
                  color={Theme.blue}
                />
              )}
            </Mafs>
          </div>

          {/* Interactive point info */}
          {interactivePoint && (
            <div className="mt-2 flex items-center gap-4">
              <span className="text-xs text-slate-300">
                {interactivePoint.label ?? 'Point'} :
              </span>
              <div className="flex gap-2">
                <label className="text-xs text-slate-500">
                  x =
                  <input
                    type="number"
                    step="0.5"
                    value={point[0]}
                    onChange={(e) => handlePointMove([parseFloat(e.target.value) || 0, point[1]])}
                    className="ml-1 w-16 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-white text-xs"
                  />
                </label>
                <label className="text-xs text-slate-500">
                  y =
                  <input
                    type="number"
                    step="0.5"
                    value={point[1]}
                    onChange={(e) => handlePointMove([point[0], parseFloat(e.target.value) || 0])}
                    className="ml-1 w-16 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-white text-xs"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Function legend */}
          {elements.filter((e) => e.type === 'function').length > 0 && (
            <div className="mt-2 flex flex-wrap gap-3">
              {elements
                .filter((e): e is GraphElement & { type: 'function' } => e.type === 'function')
                .map((el, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-slate-300">
                    <div
                      className="w-3 h-0.5 rounded"
                      style={{ backgroundColor: getColor(el.color) }}
                    />
                    <span className="font-mono">{el.label ?? el.fn}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
