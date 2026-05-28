"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useNsiProgress } from "@/hooks/useNsiProgress";

export function NsiCockpitCard() {
  const { progress, stats } = useNsiProgress();

  if (!progress || !stats) return null;

  const hasStarted =
    stats.subjectsSeen > 0 ||
    stats.patternsMastered > 0 ||
    stats.mockExamsCount > 0 ||
    stats.planCompleted > 0 ||
    stats.assessmentTotal > 0;

  if (!hasStarted) return null;

  const pct = stats.totalSubjects > 0
    ? Math.round((stats.subjectsMastered / stats.totalSubjects) * 100)
    : 0;

  const label =
    pct === 0
      ? "Commencer NSI Pratique"
      : pct < 30
        ? "Continuer NSI Pratique"
        : pct < 70
          ? "Consolider NSI Pratique"
          : pct < 100
            ? "Finaliser NSI"
            : "NSI Pratique complété ✓";

  return (
    <section
      role="region"
      aria-label="NSI Pratique — spécialité"
      className="overflow-hidden rounded-xl border border-l-4 border-blue-400/20 border-l-blue-400 bg-surface-card/85 shadow-sm"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-300">
            NSI Pratique · Spécialité
          </div>
          <h3 className="mt-1 text-base font-bold text-white">{label}</h3>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-400 to-cyan-300 transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 text-xs text-neutral-400">
              {stats.subjectsMastered}/{stats.totalSubjects} sujets · {pct}%
            </span>
          </div>
        </div>

        <Link
          href="/dashboard/eleve/nsi-pratique-2026"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-blue-400/30 bg-blue-400/10 px-4 text-sm font-bold text-blue-300 no-underline transition-colors hover:bg-white/10"
        >
          {pct === 100 ? "Revoir" : "Continuer"}
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
