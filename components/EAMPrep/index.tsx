"use client";

import { useMemo, useState } from "react";
import { BookOpenCheck, CalendarDays, ClipboardCheck, FileText, Flag, ListChecks, PlayCircle, Target, Timer, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useEAMProgress } from "@/hooks/useEAMProgress";
import { EXAM_DATE, MODULES } from "./data";
import { Countdown } from "./Countdown";
import { ModuleDetail } from "./ModuleDetail";
import { ModuleGrid } from "./ModuleGrid";
import { MockExam } from "./MockExam";
import { PlanTimeline } from "./PlanTimeline";
import { RefsSheet } from "./RefsSheet";

type EAMTab = "accueil" | "diagnostic" | "plan" | "modules" | "refs" | "sujet";

function shouldHideAfterExam() {
  const now = new Date();
  const thirtyDaysAfter = EXAM_DATE.getTime() + 30 * 24 * 60 * 60 * 1000;
  return now.getTime() > thirtyDaysAfter;
}

function formatSyncDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "En attente";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export default function EAMPrep() {
  const [tab, setTab] = useState<EAMTab>("accueil");
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const progress = useEAMProgress();
  const selectedModule = useMemo(() => MODULES.find((module) => module.id === selectedModuleId) ?? null, [selectedModuleId]);
  const firstModuleToReview = useMemo(
    () => MODULES.find((module) => progress.getModuleProgress(module.id).pct < 100) ?? MODULES[0],
    [progress]
  );

  if (shouldHideAfterExam() && progress.totalChecked === 0) return null;

  const tabs: Array<{ id: EAMTab; label: string; icon: React.ElementType }> = [
    { id: "accueil", label: "Accueil", icon: Target },
    { id: "diagnostic", label: "Faire le point", icon: ClipboardCheck },
    { id: "plan", label: "Plan J-11", icon: CalendarDays },
    { id: "modules", label: "Modules", icon: BookOpenCheck },
    { id: "refs", label: "Fiches express", icon: FileText },
    { id: "sujet", label: "Sujet blanc", icon: Timer },
  ];

  return (
    <section id="eam-prep" className="eam-shell w-full max-w-full space-y-5 overflow-x-hidden">
      <Card className="max-w-full overflow-hidden border-brand-accent/20 bg-gradient-to-br from-brand-accent/10 via-surface-card to-surface-card">
        <CardContent className="p-5 md:p-6">
          <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="break-words text-xs font-black uppercase tracking-[0.18em] text-brand-accent">Première générale — spécialité mathématiques</p>
              <h2 className="mt-2 break-words text-2xl font-black tracking-tight text-white md:text-3xl">Commando J-11 — Épreuve Anticipée de Mathématiques</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-300">
                Préparation structurée pour sécuriser les automatismes, réviser les méthodes clés et s'entraîner en conditions d'épreuve.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["8 juin 2026 — 08h00, heure de Paris", "Sans calculatrice", "QCM + exercices"].map((item) => (
                  <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-neutral-200">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <Countdown />
          </div>

          <div className="mt-5 grid min-w-0 gap-3 md:grid-cols-4">
            <div className="min-w-0 rounded-xl border border-white/10 bg-surface-darker/60 p-4 md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-white">Progression globale</span>
                <span className="text-brand-accent">{progress.totalChecked}/{progress.totalItems} objectifs — {progress.pct}%</span>
              </div>
              <Progress value={progress.pct} className="mt-3" />
            </div>
            <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-neutral-400">Quiz terminés</p>
              <p className="mt-1 text-2xl font-black text-white">{progress.quizDone}/{MODULES.length}</p>
            </div>
            <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-neutral-400">Dernière synchronisation</p>
              <p className="mt-1 text-sm font-semibold text-white">{formatSyncDate(progress.lastUpdated)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="-mx-3 max-w-[calc(100%+1.5rem)] overflow-x-auto px-3 sm:mx-0 sm:max-w-full sm:px-0">
        <div className="flex w-max max-w-none gap-1 rounded-xl border border-white/10 bg-white/5 p-1 sm:w-full sm:flex-wrap">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  if (item.id !== "modules") setSelectedModuleId(null);
                }}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition sm:flex-1 sm:justify-center ${tab === item.id ? "bg-brand-accent text-surface-darker" : "text-neutral-400 hover:bg-white/5 hover:text-white"}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "accueil" && (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <Card className="min-w-0 overflow-hidden border-white/10 bg-surface-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <PlayCircle className="h-5 w-5 text-brand-accent" />
                Objectif du module
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-neutral-300">
                En moins de deux semaines, l'objectif est de repérer les points faibles, consolider les formules utiles et automatiser les gestes qui rapportent vite des points.
              </p>
              <div className="grid min-w-0 gap-3 sm:grid-cols-3">
                {[
                  ["1", "Commencer par le diagnostic"],
                  ["2", "Réviser les modules prioritaires"],
                  ["3", "Valider quiz et checklist"],
                ].map(([step, label]) => (
                  <div key={step} className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-2xl font-black text-white">{step}</p>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-400">{label}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="bg-brand-accent text-surface-darker hover:bg-brand-accent/90" onClick={() => setTab("diagnostic")}>
                  Commencer le diagnostic
                </Button>
                <Button variant="outline" className="border-white/15 text-white hover:bg-white/10" onClick={() => setTab("plan")}>
                  Voir le plan J-11
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden border-amber-400/20 bg-amber-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-100">
                <Trophy className="h-5 w-5" />
                Stratégie d'épreuve
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-amber-50/90">
              <p>QCM en 15 minutes, puis exercices. On ne bloque pas : on sécurise d'abord les questions directes.</p>
              <p className="rounded-lg bg-surface-darker/60 p-3">
                Réflexe Nexus : si un calcul devient massif, chercher la factorisation ou le nombre qui tombe juste.
              </p>
              <Button variant="outline" className="border-amber-200/30 text-amber-100 hover:bg-amber-100/10" onClick={() => setTab("refs")}>
                Ouvrir les fiches express
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "diagnostic" && (
        <div className="space-y-4">
          <Card className="border-white/10 bg-surface-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Flag className="h-5 w-5 text-brand-accent" />
                Où reprendre maintenant ?
              </CardTitle>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {MODULES.map((module) => {
                const moduleProgress = progress.getModuleProgress(module.id);
                const quizResult = progress.state.quiz[module.id];
                return (
                  <button
                    key={module.id}
                    type="button"
                    className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/20 hover:bg-white/10"
                    onClick={() => {
                      setSelectedModuleId(module.id);
                      setTab("modules");
                    }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: module.color }}>{module.tag}</p>
                    <h3 className="mt-1 font-bold text-white">{module.title}</h3>
                    <p className="mt-2 text-xs text-neutral-400">{moduleProgress.checked}/{moduleProgress.total} objectifs validés</p>
                    <Progress value={moduleProgress.pct} className="mt-2" />
                    <p className="mt-3 text-xs text-neutral-300">
                      Quiz : {quizResult?.done ? `${quizResult.score}/${quizResult.total}` : "à faire"}
                    </p>
                  </button>
                );
              })}
            </CardContent>
          </Card>
          {firstModuleToReview && (
            <Button
              className="bg-brand-accent text-surface-darker hover:bg-brand-accent/90"
              onClick={() => {
                setSelectedModuleId(firstModuleToReview.id);
                setTab("modules");
              }}
            >
              Reprendre : {firstModuleToReview.title}
            </Button>
          )}
        </div>
      )}

      {tab === "plan" && <PlanTimeline />}

      {tab === "modules" && (
        selectedModule ? (
          <Card className="min-w-0 overflow-hidden border-white/10 bg-surface-card">
            <CardContent className="min-w-0 p-4 sm:p-5">
              <ModuleDetail
                module={selectedModule}
                checks={progress.state.checks}
                quiz={progress.state.quiz[selectedModule.id]}
                onBack={() => setSelectedModuleId(null)}
                onToggleCheck={progress.toggleCheck}
                onSaveQuiz={(score, total) => progress.saveQuizResult(selectedModule.id, score, total)}
              />
            </CardContent>
          </Card>
        ) : (
          <ModuleGrid
            modules={MODULES}
            getModuleProgress={progress.getModuleProgress}
            quiz={progress.state.quiz}
            onOpen={setSelectedModuleId}
            onReset={progress.resetModule}
          />
        )
      )}

      {tab === "refs" && <RefsSheet />}

      {tab === "sujet" && (
        <div className="space-y-4">
          <Card className="eam-no-print min-w-0 overflow-hidden border-white/10 bg-surface-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Timer className="h-5 w-5 text-brand-accent" />
                Sujet blanc
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed text-neutral-300">
              <p>À faire en conditions réelles : 2 heures, sans calculatrice.</p>
              <div className="grid min-w-0 gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">0-15 min : QCM, réponses rapides et sans retour excessif.</div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">15-90 min : exercices longs, rédaction claire et calculs posés.</div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">90-120 min : vérification, unités, cohérence et questions laissées.</div>
              </div>
            </CardContent>
          </Card>
          <MockExam />
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-neutral-400">
        <ListChecks className="mr-2 inline h-4 w-4 text-brand-accent" />
        Sauvegarde hybride active : localStorage immédiat, synchronisation API silencieuse côté serveur avec debounce.
      </div>
    </section>
  );
}
