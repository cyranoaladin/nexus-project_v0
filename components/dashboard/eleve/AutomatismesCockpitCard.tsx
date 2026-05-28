"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

const ASSESSMENT_PREFIX = "automatismes_premiere_eds_v1_";
const SUCCESS_THRESHOLD = 70;

type SeriesItem = {
  id: string;
  title: string;
  questionCount?: number;
};

type AttemptItem = {
  assessmentVersion?: string | null;
  globalScore?: number | null;
};

type AutomatismesProgress = {
  completed: number;
  total: number;
  hasStarted: boolean;
};

function getSeriesIdFromAttempt(attempt: AttemptItem) {
  const version = attempt.assessmentVersion ?? "";
  if (!version.startsWith(ASSESSMENT_PREFIX)) return null;
  return version.slice(ASSESSMENT_PREFIX.length);
}

function deriveProgress(series: SeriesItem[], attempts: AttemptItem[]): AutomatismesProgress {
  const knownSeriesIds = new Set(series.map((item) => item.id));
  const bestScoreBySeries = new Map<string, number>();

  for (const attempt of attempts) {
    const seriesId = getSeriesIdFromAttempt(attempt);
    if (!seriesId || !knownSeriesIds.has(seriesId)) continue;
    const score = typeof attempt.globalScore === "number" ? attempt.globalScore : 0;
    bestScoreBySeries.set(seriesId, Math.max(bestScoreBySeries.get(seriesId) ?? 0, score));
  }

  return {
    completed: Array.from(bestScoreBySeries.values()).filter((score) => score >= SUCCESS_THRESHOLD).length,
    total: series.length,
    hasStarted: bestScoreBySeries.size > 0,
  };
}

export function AutomatismesCockpitCard() {
  const [progress, setProgress] = useState<AutomatismesProgress | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/student/automatismes/series").then((response) => (response.ok ? response.json() : [])),
      fetch("/api/student/automatismes/attempts").then((response) => (response.ok ? response.json() : [])),
    ])
      .then(([seriesData, attemptsData]: [unknown, unknown]) => {
        if (cancelled) return;
        const series = Array.isArray(seriesData) ? (seriesData as SeriesItem[]) : [];
        const attempts = Array.isArray(attemptsData) ? (attemptsData as AttemptItem[]) : [];
        setProgress(series.length > 0 ? deriveProgress(series, attempts) : null);
      })
      .catch(() => {
        if (!cancelled) setProgress(null);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return null;
  if (!progress || !progress.hasStarted || progress.total === 0) return null;

  const pct = Math.round((progress.completed / progress.total) * 100);
  const label =
    pct === 0
      ? "Commencer les automatismes"
      : pct < 50
        ? "Continuer les automatismes"
        : pct < 100
          ? "Finaliser les automatismes"
          : "Automatismes complétés ✓";

  return (
    <section
      role="region"
      aria-label="Automatismes mathématiques"
      className="overflow-hidden rounded-xl border border-l-4 border-violet-400/20 border-l-violet-400 bg-surface-card/85 shadow-sm"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-300">
            Automatismes · Partie 1 QCM (6 pts)
          </div>
          <h3 className="mt-1 text-base font-bold text-white">{label}</h3>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-300 transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 text-xs text-neutral-400">
              {progress.completed}/{progress.total} séries
            </span>
          </div>
        </div>

        <Link
          href="/dashboard/eleve/automatismes"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-400/10 px-4 text-sm font-bold text-violet-300 no-underline transition-colors hover:bg-white/10"
        >
          {pct === 100 ? "Revoir" : "Pratiquer"}
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
