'use client';

import { useState, useCallback } from 'react';
import { BarChart3, CheckCircle2, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

/**
 * CdC §4.4.2 — Simulation de Monte-Carlo
 * Simulate coin flips / dice rolls to see frequency converge to probability.
 * Also includes π estimation via random points in a unit square.
 */

type SimMode = 'coin' | 'dice' | 'pi';

export default function MonteCarloSim() {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<SimMode>('coin');
  const [results, setResults] = useState<number[]>([]);
  const [running, setRunning] = useState(false);

  const totalTrials = results.length;

  // Coin: count heads (1)
  const coinHeads = mode === 'coin' ? results.filter((r) => r === 1).length : 0;
  const coinFreq = totalTrials > 0 ? coinHeads / totalTrials : 0;

  // Dice: count each face
  const diceCounts = mode === 'dice'
    ? Array.from({ length: 6 }, (_, i) => results.filter((r) => r === i + 1).length)
    : [];

  // Pi: count points inside circle
  const piInside = mode === 'pi' ? results.filter((r) => r === 1).length : 0;
  const piEstimate = totalTrials > 0 ? (4 * piInside) / totalTrials : 0;

  const reset = useCallback(() => {
    setResults([]);
  }, []);

  const simulate = useCallback((n: number) => {
    setRunning(true);
    const newResults: number[] = [];

    for (let i = 0; i < n; i++) {
      if (mode === 'coin') {
        newResults.push(Math.random() < 0.5 ? 1 : 0);
      } else if (mode === 'dice') {
        newResults.push(Math.floor(Math.random() * 6) + 1);
      } else {
        // Pi estimation: random point in [0,1]², check if inside quarter circle
        const x = Math.random();
        const y = Math.random();
        newResults.push(x * x + y * y <= 1 ? 1 : 0);
      }
    }

    setResults((prev) => [...prev, ...newResults]);
    setRunning(false);
  }, [mode]);

  return (
    <div className="bg-slate-900/50 border border-blue-500/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-200" aria-hidden="true" />
          <span className="font-bold text-blue-200 text-sm">Simulation de Monte-Carlo</span>
          <span className="text-[10px] bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full">Lab Interactif</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-500" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />}
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-4">
          {/* Mode selector */}
          <div className="flex gap-2">
            {([
              { id: 'coin' as SimMode, label: 'Pile ou face', desc: 'P = 0.5' },
              { id: 'dice' as SimMode, label: 'Lancer de dé', desc: 'P = 1/6' },
              { id: 'pi' as SimMode, label: 'Estimation de π', desc: 'Monte-Carlo' },
            ]).map((m) => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); reset(); }}
                className={`flex-1 text-xs px-3 py-2 rounded-lg font-bold transition-all ${
                  mode === m.id
                    ? 'bg-blue-500/20 text-blue-200 border border-blue-500/30'
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-transparent'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => simulate(1)} disabled={running} className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all">+1</button>
            <button onClick={() => simulate(10)} disabled={running} className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all">+10</button>
            <button onClick={() => simulate(100)} disabled={running} className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all">+100</button>
            <button onClick={() => simulate(1000)} disabled={running} className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all">+1000</button>
            <button onClick={reset} className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 font-bold hover:bg-slate-600 transition-all ml-auto inline-flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Reset</button>
          </div>

          {/* Results */}
          <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Essais : <span className="text-white font-bold">{totalTrials}</span></span>
              {mode === 'coin' && (
                <span>Fréquence Pile : <span className={`font-bold ${Math.abs(coinFreq - 0.5) < 0.02 ? 'text-green-400' : 'text-blue-300'}`}>{(coinFreq * 100).toFixed(1)}%</span> (théorique : 50%)</span>
              )}
              {mode === 'pi' && (
                <span>π ≈ <span className={`font-bold ${Math.abs(piEstimate - Math.PI) < 0.1 ? 'text-green-400' : 'text-blue-300'}`}>{piEstimate.toFixed(4)}</span> (réel : {Math.PI.toFixed(4)})</span>
              )}
            </div>

            {/* Coin visualization */}
            {mode === 'coin' && totalTrials > 0 && (
              <div>
                <div className="flex gap-1 h-8">
                  <div
                    className="bg-blue-500/40 rounded-l-lg flex items-center justify-center text-[10px] font-bold text-blue-200 transition-all"
                    style={{ width: `${coinFreq * 100}%` }}
                  >
                    {coinFreq > 0.1 ? `Pile ${(coinFreq * 100).toFixed(0)}%` : ''}
                  </div>
                  <div
                    className="bg-blue-500/40 rounded-r-lg flex items-center justify-center text-[10px] font-bold text-blue-300 transition-all"
                    style={{ width: `${(1 - coinFreq) * 100}%` }}
                  >
                    {(1 - coinFreq) > 0.1 ? `Face ${((1 - coinFreq) * 100).toFixed(0)}%` : ''}
                  </div>
                </div>
                {/* Convergence indicator */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">Écart à P=0.5 :</span>
                  <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${Math.abs(coinFreq - 0.5) < 0.02 ? 'bg-green-500' : Math.abs(coinFreq - 0.5) < 0.05 ? 'bg-blue-500' : 'bg-slate-500'}`}
                      style={{ width: `${Math.max(2, Math.min(100, (1 - Math.abs(coinFreq - 0.5) * 10) * 100))}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-mono font-bold ${Math.abs(coinFreq - 0.5) < 0.02 ? 'text-green-400' : Math.abs(coinFreq - 0.5) < 0.05 ? 'text-blue-300' : 'text-slate-200'}`}>
                    {Math.abs(coinFreq - 0.5) < 0.02 ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Convergence</span> : `±${(Math.abs(coinFreq - 0.5) * 100).toFixed(1)}%`}
                  </span>
                </div>
                <div className="text-center text-[10px] text-slate-600 mt-1">
                  Loi des grands nombres : la fréquence fₙ → P = 0.5 quand n → ∞. Vitesse : ± 1/√n ≈ ±{(1 / Math.sqrt(totalTrials) * 100).toFixed(1)}%
                </div>
              </div>
            )}

            {/* Dice visualization */}
            {mode === 'dice' && totalTrials > 0 && (
              <div>
                <div className="relative">
                  {/* Theoretical reference line at 1/6 */}
                  <div className="absolute left-0 right-0" style={{ bottom: `${(1/6) * 300 + 24}px` }}>
                    <div className="border-t border-dashed border-green-500/40 w-full" />
                    <span className="text-[8px] text-green-500/60 absolute right-0 -top-3">1/6</span>
                  </div>
                  <div className="flex gap-1 h-20 items-end">
                    {diceCounts.map((count, i) => {
                      const freq = count / totalTrials;
                      const deviation = Math.abs(freq - 1/6);
                      const barColor = deviation < 0.02 ? 'bg-green-500/50' : deviation < 0.05 ? 'bg-blue-500/40' : 'bg-slate-500/40';
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className={`w-full ${barColor} rounded-t-lg transition-all`}
                            style={{ height: `${Math.max(2, freq * 300)}px` }}
                          />
                          <span className="text-[10px] text-slate-300">{i + 1}</span>
                          <span className="text-[9px] text-slate-600">{(freq * 100).toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Max deviation */}
                {(() => {
                  const maxDev = Math.max(...diceCounts.map((c) => Math.abs(c / totalTrials - 1/6)));
                  return (
                    <div className="text-center text-[10px] text-slate-600 mt-2">
                      Théorique : 1/6 ≈ 16.7% par face.
                      <span className={`ml-1 font-bold ${maxDev < 0.02 ? 'text-green-400' : maxDev < 0.05 ? 'text-blue-300' : 'text-slate-200'}`}>
                        Écart max : {(maxDev * 100).toFixed(1)}%
                        {maxDev < 0.02 ? ' Convergence' : ''}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Pi visualization */}
            {mode === 'pi' && totalTrials > 0 && (
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-300 font-mono">
                  π ≈ {piEstimate.toFixed(6)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Erreur : {Math.abs(piEstimate - Math.PI).toFixed(6)} ({piInside} points dans le cercle / {totalTrials} total)
                </div>
                <div className="w-full h-2 bg-slate-700 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (1 - Math.abs(piEstimate - Math.PI) / Math.PI) * 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-600 mt-1">
                  On lance des points aléatoires dans un carré [0,1]². Le ratio dans le quart de cercle × 4 ≈ π.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
