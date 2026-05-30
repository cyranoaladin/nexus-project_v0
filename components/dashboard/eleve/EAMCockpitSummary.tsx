"use client";

import Link from "next/link";
import { ArrowRight, Clock3, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useEAMProgress } from "@/hooks/useEAMProgress";
import { MODULES } from "@/components/EAMPrep/data";

const EXAM_DATE = new Date("2026-06-08T08:00:00+02:00");
const EXAM_GRACE_DAYS = 30;
const TOTAL_MODULES = 7;
const MOCK_EXAM_KEY = "mock_exam_1";

function getDaysRemaining() {
  return Math.ceil((EXAM_DATE.getTime() - Date.now()) / 86_400_000);
}

function getDayPriority(pct: number, daysLeft: number) {
  if (daysLeft <= 0) return null;
  if (pct === 0) return "Découvrir l’EAM";
  if (pct < 30) return "Continuer la préparation";
  if (pct < 80) return "Continuer";
  return "Réviser avant l’épreuve";
}

function getUrgencyClasses(daysLeft: number) {
  if (daysLeft <= 1) {
    return {
      border: "border-rose-400/40",
      left: "border-l-rose-400",
      text: "text-rose-200",
      bg: "bg-rose-400/10",
      bar: "from-rose-400 to-rose-300",
    };
  }

  if (daysLeft <= 3) {
    return {
      border: "border-orange-400/40",
      left: "border-l-orange-400",
      text: "text-orange-200",
      bg: "bg-orange-400/10",
      bar: "from-orange-400 to-amber-300",
    };
  }

  if (daysLeft <= 7) {
    return {
      border: "border-amber-400/40",
      left: "border-l-amber-400",
      text: "text-amber-200",
      bg: "bg-amber-400/10",
      bar: "from-amber-400 to-yellow-300",
    };
  }

  return {
    border: "border-brand-accent/30",
    left: "border-l-brand-accent",
    text: "text-brand-accent",
    bg: "bg-brand-accent/10",
    bar: "from-brand-accent to-cyan-300",
  };
}

export function EAMCockpitSummary() {
  const { state, totalChecked, totalItems, pct } = useEAMProgress();
  const [mounted, setMounted] = useState(false);
  const [daysLeft, setDaysLeft] = useState(getDaysRemaining);

  useEffect(() => {
    setMounted(true);
    const intervalId = window.setInterval(() => setDaysLeft(getDaysRemaining()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const quizDone = useMemo(
    () => MODULES.filter((module) => state.quiz[module.id]?.done).length,
    [state.quiz],
  );
  const mockExam = state.quiz[MOCK_EXAM_KEY];
  const mockExamDone = Boolean(mockExam?.done);

  if (daysLeft < -EXAM_GRACE_DAYS) return null;

  if (!mounted) {
    return (
      <div
        aria-busy="true"
        aria-label="Chargement de la progression EAM"
        className="h-[92px] animate-pulse rounded-xl border border-white/10 bg-surface-card/70"
      />
    );
  }

  const priority = getDayPriority(pct, daysLeft);
  if (!priority) return null;

  const urgency = getUrgencyClasses(daysLeft);
  const safeTotalItems = totalItems > 0 ? totalItems : 59;
  const moduleCountLabel = Math.min(quizDone, TOTAL_MODULES);

  return (
    <section
      role="region"
      aria-label="Préparation Épreuve Anticipée de Mathématiques"
      className={`overflow-hidden rounded-xl border border-l-4 ${urgency.border} ${urgency.left} bg-surface-card/85 shadow-premium`}
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div
            aria-live="polite"
            aria-label={`${daysLeft} jours avant l'Épreuve Anticipée de Mathématiques`}
            className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl ${urgency.bg} ${urgency.text}`}
          >
            {daysLeft > 0 ? (
              <>
                <span className="text-2xl font-black leading-none">{daysLeft}</span>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em]">jours</span>
              </>
            ) : (
              <span className="px-2 text-center text-xs font-black leading-tight">Aujourd’hui</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className={`flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] ${urgency.text}`}>
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Épreuve anticipée · 8 juin 2026</span>
            </div>
            <h3 className="mt-1 text-base font-bold text-white sm:text-lg">
              Priorité du jour : {priority}
            </h3>
            <p className="mt-1 text-sm text-neutral-300">
              Préparation Première spécialité mathématiques, progression sauvegardée automatiquement.
            </p>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${urgency.bar} transition-[width] duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-neutral-400">
                <Target className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {pct}% · {totalChecked}/{safeTotalItems} objectifs · {moduleCountLabel}/{TOTAL_MODULES} modules
                </span>
              </div>
            </div>
            {mockExamDone && (
              <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-300">
                <span aria-hidden="true">✓</span>
                <span>
                  {mockExam.score === 1 && mockExam.total === 1
                    ? "Sujet blanc complété"
                    : `Sujet blanc complété — ${mockExam.score}/${mockExam.total}`}
                </span>
              </div>
            )}
          </div>
        </div>

        <Link
          href="/dashboard/eleve/eam-premiere"
          className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border px-4 text-sm font-bold no-underline transition-colors ${urgency.border} ${urgency.bg} ${urgency.text} hover:bg-white/10`}
        >
          {pct === 0 ? "Commencer" : "Continuer"}
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
