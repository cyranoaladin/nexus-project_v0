'use client';

import { useState, useMemo } from 'react';
import {
    Mafs,
    Coordinates,
    Vector,
    useMovablePoint,
    Theme,
    Text as MafsText,
    Line,
    Circle,
} from 'mafs';
import 'mafs/core.css';

/**
 * CdC §4.2 — "VectorProjector"
 * Interactive dot product & orthogonal projection lab.
 * Two draggable vectors u and v. Displays:
 *   - Real-time dot product xx' + yy'
 *   - Orthogonal projection of v onto u
 *   - Snap visual + message when angle ≈ 90°
 *   - Angle arc between vectors
 */

export default function VectorProjector() {
    const [expanded, setExpanded] = useState(false);

    // Draggable vector endpoints
    const uPoint = useMovablePoint([3, 1], { color: Theme.blue });
    const vPoint = useMovablePoint([1, 3], { color: Theme.orange });

    const u: [number, number] = uPoint.point;
    const v: [number, number] = vPoint.point;

    // Dot product
    const dotProduct = u[0] * v[0] + u[1] * v[1];

    // Magnitudes
    const magU = Math.sqrt(u[0] * u[0] + u[1] * u[1]);
    const magV = Math.sqrt(v[0] * v[0] + v[1] * v[1]);

    // Angle between vectors (radians)
    const cosAngle = magU > 0.01 && magV > 0.01 ? dotProduct / (magU * magV) : 0;
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    const angleDeg = (angle * 180) / Math.PI;

    // Orthogonal projection of v onto u
    const projScalar = magU > 0.01 ? dotProduct / (magU * magU) : 0;
    const proj: [number, number] = [projScalar * u[0], projScalar * u[1]];

    // Is orthogonal? (snap detection)
    const isOrthogonal = Math.abs(dotProduct) < 0.15 && magU > 0.3 && magV > 0.3;

    // Angle arc: compute start & end angles for the arc indicator
    const angleU = Math.atan2(u[1], u[0]);
    const angleV = Math.atan2(v[1], v[0]);

    // Determine sweep for arc indicator
    const arcRadius = 0.6;
    const arcPoints = useMemo(() => {
        const pts: [number, number][] = [];
        const steps = 30;
        const start = angleU;
        const end = angleV;
        // Always go the shorter way
        let diff = end - start;
        if (diff > Math.PI) diff -= 2 * Math.PI;
        if (diff < -Math.PI) diff += 2 * Math.PI;
        for (let i = 0; i <= steps; i++) {
            const t = start + (diff * i) / steps;
            pts.push([arcRadius * Math.cos(t), arcRadius * Math.sin(t)]);
        }
        return pts;
    }, [angleU, angleV]);

    return (
        <div className={`bg-slate-900/50 border ${isOrthogonal ? 'border-green-500/40 shadow-lg shadow-green-500/10' : 'border-blue-500/20'} rounded-2xl overflow-hidden transition-all duration-300`}>
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-lg">🧲</span>
                    <span className="font-bold text-blue-200 text-sm">Projecteur Vectoriel</span>
                    <span className="text-[10px] bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full">Lab Interactif</span>
                </div>
                <span className="text-slate-500 text-sm">{expanded ? '▲ Réduire' : '▼ Ouvrir'}</span>
            </button>

            {expanded && (
                <div className="p-4 pt-0 space-y-3">
                    {/* Info panel */}
                    <div className="flex flex-wrap gap-2 text-xs">
                        <span className="bg-slate-800 px-2 py-1 rounded text-blue-300">
                            <span className="font-bold">u⃗</span> = ({u[0].toFixed(1)} ; {u[1].toFixed(1)})
                        </span>
                        <span className="bg-slate-800 px-2 py-1 rounded text-slate-200">
                            <span className="font-bold">v⃗</span> = ({v[0].toFixed(1)} ; {v[1].toFixed(1)})
                        </span>
                        <span className={`px-2 py-1 rounded font-bold ${isOrthogonal ? 'bg-green-500/20 text-green-400 animate-pulse' : 'bg-slate-800 text-white'}`}>
                            u⃗ · v⃗ = {dotProduct.toFixed(2)}
                        </span>
                        <span className="bg-slate-800 px-2 py-1 rounded text-slate-300">
                            ∠ = {angleDeg.toFixed(1)}°
                        </span>
                    </div>

                    {/* Orthogonality snap message */}
                    {isOrthogonal && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center animate-pulse">
                            <span className="text-green-400 font-bold text-sm">⊥ Orthogonalité détectée !</span>
                            <p className="text-[10px] text-green-300/70 mt-1">
                                u⃗ · v⃗ ≈ 0 → les vecteurs sont perpendiculaires
                            </p>
                        </div>
                    )}

                    {/* Mafs Graph */}
                    <div className="rounded-xl overflow-hidden border border-slate-700/50 bg-white">
                        <Mafs
                            viewBox={{ x: [-5, 5], y: [-5, 5] }}
                            preserveAspectRatio={false}
                            height={350}
                        >
                            <Coordinates.Cartesian />

                            {/* Vector u (blue) */}
                            <Vector tip={u} color={Theme.blue} />
                            <MafsText x={u[0] + 0.2} y={u[1] + 0.3} size={14} color={Theme.blue}>
                                u⃗
                            </MafsText>

                            {/* Vector v (orange) */}
                            <Vector tip={v} color={Theme.orange} />
                            <MafsText x={v[0] + 0.2} y={v[1] + 0.3} size={14} color={Theme.orange}>
                                v⃗
                            </MafsText>

                            {/* Projection of v onto u */}
                            {magU > 0.01 && (
                                <>
                                    {/* Projection vector (green) */}
                                    <Vector tip={proj} color={Theme.green} opacity={0.6} />
                                    <MafsText x={proj[0] + 0.15} y={proj[1] - 0.35} size={11} color={Theme.green}>
                                        proj
                                    </MafsText>

                                    {/* Dashed line from v tip to projection point */}
                                    <Line.Segment
                                        point1={v}
                                        point2={proj}
                                        color={Theme.green}
                                        opacity={0.3}
                                        style="dashed"
                                    />
                                </>
                            )}

                            {/* Angle arc */}
                            {arcPoints.length > 1 && magU > 0.3 && magV > 0.3 && (
                                <>
                                    {arcPoints.slice(0, -1).map((pt, i) => (
                                        <Line.Segment
                                            key={i}
                                            point1={pt}
                                            point2={arcPoints[i + 1]}
                                            color={isOrthogonal ? Theme.green : Theme.foreground}
                                            opacity={0.4}
                                        />
                                    ))}
                                </>
                            )}

                            {/* Right angle indicator when orthogonal */}
                            {isOrthogonal && magU > 0.3 && magV > 0.3 && (
                                <Circle
                                    center={[0, 0]}
                                    radius={0.15}
                                    color={Theme.green}
                                    fillOpacity={0.3}
                                    strokeOpacity={0.6}
                                />
                            )}

                            {/* Draggable points */}
                            {uPoint.element}
                            {vPoint.element}
                        </Mafs>
                    </div>

                    {/* Formula reminder */}
                    <div className="bg-slate-800/50 rounded-xl p-3 text-center space-y-1">
                        <p className="text-xs text-slate-300">
                            <span className="text-blue-400 font-mono">u⃗({u[0].toFixed(1)};{u[1].toFixed(1)})</span>
                            {' · '}
                            <span className="text-slate-300 font-mono">v⃗({v[0].toFixed(1)};{v[1].toFixed(1)})</span>
                            {' = '}
                            <span className="text-white font-bold font-mono">
                                {u[0].toFixed(1)}×{v[0].toFixed(1)} + {u[1].toFixed(1)}×{v[1].toFixed(1)} = {dotProduct.toFixed(2)}
                            </span>
                        </p>
                        <p className="text-[10px] text-slate-600">
                            Déplacez les points pour explorer le produit scalaire. Quand u⃗ ⊥ v⃗, le produit scalaire vaut 0.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
