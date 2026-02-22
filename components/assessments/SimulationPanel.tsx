/**
 * SimulationPanel — Front-end only simulation engine.
 *
 * Allows users to simulate domain score improvements and see
 * the projected impact on SSN, percentile, and classification.
 *
 * CONSTRAINT: Never modifies data in DB — pure client-side computation.
 */

'use client';

import { useState, useMemo } from 'react';
import { classifySSN, getSSNLabel, normalizeScore } from '@/lib/core/statistics/normalize';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DomainData {
  domain: string;
  score: number;
}

interface SimulationPanelProps {
  /** Current domain scores */
  domainScores: DomainData[];
  /** Current SSN (null if not computed) */
  currentSSN: number | null;
  /** Current raw global score */
  currentGlobalScore: number;
  /** Cohort mean (for normalization) */
  cohortMean: number;
  /** Cohort std (for normalization) */
  cohortStd: number;
  /** Current percentile */
  currentPercentile: number | null;
}

interface DomainDelta {
  domain: string;
  delta: number;
}

// ─── Domain Labels ──────────────────────────────────────────────────────────

const DOMAIN_LABELS: Record<string, string> = {
  analysis: 'Analyse',
  algebra: 'Algèbre',
  geometry: 'Géométrie',
  prob_stats: 'Probabilités',
  algorithmic: 'Algorithmique',
  complexes: 'Complexes',
  suites: 'Suites',
  methodologie: 'Méthodologie',
  rigueur: 'Rigueur',
  comprehension: 'Compréhension',
  application: 'Application',
};

function getDomainLabel(domain: string): string {
  return DOMAIN_LABELS[domain.toLowerCase()] || domain.replace(/_/g, ' ');
}

// ─── Simulation Logic (pure functions) ──────────────────────────────────────

function simulateImprovement(
  domainScores: DomainData[],
  deltas: DomainDelta[]
): DomainData[] {
  return domainScores.map((d) => {
    const delta = deltas.find((dd) => dd.domain === d.domain);
    return {
      ...d,
      score: Math.min(100, Math.max(0, d.score + (delta?.delta ?? 0))),
    };
  });
}

function computeSimulatedRawScore(simulatedDomains: DomainData[]): number {
  if (simulatedDomains.length === 0) return 0;
  const total = simulatedDomains.reduce((sum, d) => sum + d.score, 0);
  return Math.round((total / simulatedDomains.length) * 10) / 10;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SimulationPanel({
  domainScores,
  currentSSN,
  currentGlobalScore,
  cohortMean,
  cohortStd,
  currentPercentile,
}: SimulationPanelProps) {
  const [deltas, setDeltas] = useState<DomainDelta[]>(
    domainScores.map((d) => ({ domain: d.domain, delta: 0 }))
  );

  const [weeklyHours, setWeeklyHours] = useState(3);

  // Simulated values (recomputed on every slider change)
  const simulation = useMemo(() => {
    const simulated = simulateImprovement(domainScores, deltas);
    const simulatedRaw = computeSimulatedRawScore(simulated);
    const simulatedSSN = normalizeScore(simulatedRaw, cohortMean, cohortStd);
    const simulatedLevel = classifySSN(simulatedSSN);
    const simulatedLabel = getSSNLabel(simulatedSSN);

    const ssnDelta = currentSSN !== null ? Math.round((simulatedSSN - currentSSN) * 10) / 10 : null;

    return {
      domains: simulated,
      rawScore: simulatedRaw,
      ssn: simulatedSSN,
      level: simulatedLevel,
      label: simulatedLabel,
      ssnDelta,
    };
  }, [domainScores, deltas, cohortMean, cohortStd, currentSSN]);

  const handleDeltaChange = (domain: string, value: number) => {
    setDeltas((prev) =>
      prev.map((d) => (d.domain === domain ? { ...d, delta: value } : d))
    );
  };

  const resetAll = () => {
    setDeltas(domainScores.map((d) => ({ domain: d.domain, delta: 0 })));
    setWeeklyHours(3);
  };

  if (domainScores.length === 0) {
    return null;
  }

  return (
    <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Simulateur de Progression</h3>
          <p className="text-sm text-slate-300 mt-1">
            Ajustez les curseurs pour simuler l&apos;impact sur votre SSN
          </p>
        </div>
        <button
          onClick={resetAll}
          className="text-xs text-slate-300 hover:text-slate-100 px-3 py-1 rounded border border-slate-600 hover:border-slate-500 transition-colors"
        >
          Réinitialiser
        </button>
      </div>

      {/* ─── Domain Sliders ──────────────────────────────────────────── */}
      <div className="space-y-4">
        {domainScores.map((d) => {
          const delta = deltas.find((dd) => dd.domain === d.domain)?.delta ?? 0;
          const simulated = Math.min(100, Math.max(0, d.score + delta));

          return (
            <div key={d.domain} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{getDomainLabel(d.domain)}</span>
                <span className="font-mono">
                  <span className="text-slate-500">{Math.round(d.score)}</span>
                  {delta !== 0 && (
                    <span className={delta > 0 ? 'text-emerald-400' : 'text-slate-300'}>
                      {' → '}{Math.round(simulated)}
                      {' ('}
                      {delta > 0 ? '+' : ''}{delta}
                      {')'}
                    </span>
                  )}
                </span>
              </div>
              <input
                type="range"
                min={-20}
                max={30}
                step={5}
                value={delta}
                onChange={(e) => handleDeltaChange(d.domain, parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-slate-600">
                <span>-20</span>
                <span>0</span>
                <span>+30</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Weekly Hours Slider ─────────────────────────────────────── */}
      <div className="space-y-1 pt-2 border-t border-slate-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">Heures hebdomadaires</span>
          <span className="font-mono text-blue-400">{weeklyHours}h/sem</span>
        </div>
        <input
          type="range"
          min={0}
          max={15}
          step={1}
          value={weeklyHours}
          onChange={(e) => setWeeklyHours(parseInt(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {/* ─── Simulation Results ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
        {/* Current */}
        <div className="p-4 bg-slate-900/50 rounded-lg text-center">
          <div className="text-xs text-slate-500 mb-1">SSN Actuel</div>
          <div className="text-2xl font-bold text-slate-300">
            {currentSSN !== null ? Math.round(currentSSN) : '—'}
          </div>
          {currentPercentile !== null && (
            <div className="text-xs text-slate-500 mt-1">{currentPercentile}e percentile</div>
          )}
        </div>

        {/* Simulated */}
        <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20 text-center">
          <div className="text-xs text-blue-400 mb-1">SSN Simulé</div>
          <div className="text-2xl font-bold text-blue-400">
            {Math.round(simulation.ssn)}
          </div>
          <div className="text-xs mt-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              simulation.level === 'excellence' ? 'bg-emerald-500/20 text-emerald-300' :
              simulation.level === 'tres_solide' ? 'bg-blue-500/20 text-blue-300' :
              simulation.level === 'stable' ? 'bg-blue-400/20 text-blue-200' :
              simulation.level === 'fragile' ? 'bg-slate-500/20 text-slate-200' :
              'bg-slate-600/20 text-slate-100'
            }`}>
              {simulation.label}
            </span>
          </div>
          {simulation.ssnDelta !== null && simulation.ssnDelta !== 0 && (
            <div className={`text-xs mt-2 font-medium ${
              simulation.ssnDelta > 0 ? 'text-emerald-400' : 'text-slate-300'
            }`}>
              {simulation.ssnDelta > 0 ? '+' : ''}{simulation.ssnDelta} points
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Simulation locale uniquement — aucune donnée modifiée en base.
      </p>
    </div>
  );
}
