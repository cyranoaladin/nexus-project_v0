"use client";

import { CalendarDays, CheckCircle2, Clock3, Flag, ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MODULES, STAGE_SESSIONS, WEEKEND_PROTOCOL, getPlanDayMeta } from "./data";

interface StagePanelProps {
  checks: Record<string, boolean>;
  onToggleCheck: (key: string) => void;
  onOpenModule: (moduleId: string) => void;
}

function getModuleTitle(moduleId: string) {
  return MODULES.find((module) => module.id === moduleId)?.title ?? moduleId;
}

function getSessionState(date: string) {
  const today = new Date();
  const sessionDate = new Date(`${date}T08:00:00+02:00`);
  const todayKey = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(today);

  if (date === todayKey) return "en cours aujourd'hui";
  return sessionDate.getTime() < today.getTime() ? "passée" : "à venir";
}

export function StagePanel({ checks, onToggleCheck, onOpenModule }: StagePanelProps) {
  const sessionsDone = STAGE_SESSIONS.filter((session) => checks[`stage_${session.id}_done`]).length;
  const nextSession =
    STAGE_SESSIONS.find((session) => getSessionState(session.date) !== "passée") ?? STAGE_SESSIONS[STAGE_SESSIONS.length - 1];
  const stagePct = Math.round((sessionsDone / STAGE_SESSIONS.length) * 100);

  return (
    <div className="space-y-5">
      <Card className="border-brand-accent/20 bg-brand-accent/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Flag className="h-5 w-5 text-brand-accent" />
            Stage Commando 10h
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="rounded-xl border border-white/10 bg-surface-darker/50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-accent">Mission du jour</p>
              <h3 className="mt-2 text-lg font-bold text-white">{nextSession.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">{nextSession.objectifs[0]}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-white">Progression stage</span>
                <span className="text-brand-accent">{sessionsDone}/5</span>
              </div>
              <Progress value={stagePct} className="mt-3" />
              <p className="mt-2 text-xs text-neutral-400">Séances validées dans la progression EAM existante.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {STAGE_SESSIONS.map((session) => {
          const meta = getPlanDayMeta({ date: session.date, focus: session.title, tip: "", color: "#00e5ff" });
          const doneKey = `stage_${session.id}_done`;
          const interKey = `stage_${session.id}_inter`;

          return (
            <Card
              key={session.id}
              data-testid="eam-stage-session-card"
              className="overflow-hidden border-white/10 bg-surface-card"
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-brand-accent">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{meta.displayDate}</span>
                      <span>{meta.jLabel}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-neutral-300">
                        {getSessionState(session.date)}
                      </span>
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-white">{session.title}</h3>
                    <p className="mt-1 flex items-center gap-2 text-sm text-neutral-400">
                      <Clock3 className="h-4 w-4" aria-hidden="true" />
                      {session.durationMin} minutes
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                    <label className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-semibold text-neutral-200">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand-accent"
                        checked={Boolean(checks[doneKey])}
                        onChange={() => onToggleCheck(doneKey)}
                        aria-label={`Séance ${session.id} faite`}
                      />
                      Séance faite
                    </label>
                    <label className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-semibold text-neutral-200">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand-accent"
                        checked={Boolean(checks[interKey])}
                        onChange={() => onToggleCheck(interKey)}
                        aria-label={`Inter-séance ${session.id} fait`}
                      />
                      Inter-séance fait
                    </label>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                      <ListChecks className="h-4 w-4 text-brand-accent" aria-hidden="true" />
                      Objectifs
                    </h4>
                    <ul className="mt-3 space-y-2 text-sm text-neutral-300">
                      {session.objectifs.map((objectif) => (
                        <li key={objectif} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                          <span>{objectif}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                    <h4 className="text-sm font-bold text-white">Travail inter-séances</h4>
                    <ul className="mt-3 space-y-2 text-sm text-neutral-300">
                      {session.interSeance.map((item) => (
                        <li key={item} className="border-l border-brand-accent/40 pl-3">{item}</li>
                      ))}
                    </ul>
                  </section>
                </div>

                <section className="mt-4 rounded-xl border border-white/10 bg-surface-darker/40 p-4">
                  <h4 className="text-sm font-bold text-white">Déroulé minuté</h4>
                  <div className="mt-3 grid gap-2">
                    {session.deroule.map((block) => (
                      <div key={`${session.id}-${block.tranche}`} className="rounded-lg bg-white/5 p-3 text-sm">
                        <p className="font-semibold text-brand-accent">{block.tranche} min</p>
                        <p className="mt-1 text-neutral-300">{block.activite}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="mt-4 flex flex-wrap gap-2">
                  {session.moduleIds.map((moduleId) => (
                    <button
                      key={`${session.id}-${moduleId}`}
                      type="button"
                      onClick={() => onOpenModule(moduleId)}
                      className="min-h-11 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-semibold text-neutral-200 transition hover:border-brand-accent/40 hover:text-white"
                    >
                      {getModuleTitle(moduleId)}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-amber-300/20 bg-amber-300/10">
        <CardHeader>
          <CardTitle className="text-white">Protocole week-end (J-2 → J-0)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {WEEKEND_PROTOCOL.map((day) => (
            <article key={day.id} className="rounded-xl border border-white/10 bg-surface-darker/50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-200">{day.id}</p>
              <h3 className="mt-1 font-bold text-white">{day.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">{day.intention}</p>
              <ul className="mt-3 space-y-2 text-xs text-neutral-300">
                {day.actions.map((action) => (
                  <li key={action} className="border-l border-amber-200/40 pl-3">{action}</li>
                ))}
              </ul>
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
