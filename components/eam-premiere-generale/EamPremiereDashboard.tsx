import Link from "next/link";
import { ArrowRight, BookOpenCheck, CalendarDays, CheckCircle2, ClipboardCheck, FileText, Flag, Target, TimerReset } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EAM_PREMIERE_FINAL_WEEKEND,
  eamPremiereBetweenSessions,
  eamPremiereBlankExamStrategy,
  eamPremiereCompetencies,
  eamPremiereExamMethods,
  eamPremiereMistakesBank,
  eamPremierePremiumFeedback,
  eamPremiereQcmAutomatismes,
  eamPremiereSprintMissions,
} from "@/content/eam-premiere-generale";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-neutral-200">
      {children}
    </span>
  );
}

export function EamPremiereDashboard() {
  const todaysMission = eamPremiereSprintMissions[0];
  const totalHours = eamPremiereSprintMissions.reduce((sum, mission) => sum + mission.durationHours, 0);

  return (
    <section className="space-y-6">
      <Card className="overflow-hidden border-brand-accent/25 bg-gradient-to-br from-slate-950 via-surface-card to-slate-900 shadow-premium">
        <CardContent className="p-5 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-accent">Session du 30 mai au 8 juin 2026</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-4xl">
                Sprint EAM Maths — Première générale
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-300 sm:text-base">
                Objectif : prêt pour le 8 juin. Un cockpit de 10h pour sécuriser les automatismes, clarifier la méthode d'examen et transformer les erreurs récentes en points récupérables.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill>{totalHours}h d'accompagnement</Pill>
                <Pill>5 séances de 2h</Pill>
                <Pill>Travail maison 25 à 40 min</Pill>
                <Pill>Livret imprimable</Pill>
              </div>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-3 sm:min-w-[300px]">
              <div className="rounded-xl border border-brand-accent/20 bg-brand-accent/10 p-4">
                <p className="text-xs text-brand-accent">Épreuve</p>
                <p className="mt-1 text-xl font-black text-white">8 juin</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-neutral-400">Progression</p>
                <p className="mt-1 text-xl font-black text-white">0 → prêt</p>
              </div>
              <Link
                href="/dashboard/eleve/eam-premiere/mission-du-jour"
                className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-accent px-4 text-sm font-bold text-surface-darker transition hover:bg-brand-accent/90"
              >
                Ouvrir la mission du jour
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className="border-white/10 bg-surface-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <CalendarDays className="h-5 w-5 text-brand-accent" />
              Plan de mission 10h
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {eamPremiereSprintMissions.map((mission) => (
              <article
                key={mission.id}
                data-testid="eam-premiere-session-card"
                className="rounded-xl border border-white/10 bg-white/[0.035] p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-accent">
                      Séance {mission.sessionNumber} · {mission.dateLabel} · {mission.durationHours}h
                    </p>
                    <h2 className="mt-1 text-base font-bold text-white">{mission.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-300">{mission.objective}</p>
                  </div>
                  <span className="w-fit rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-100">
                    {mission.priority}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {mission.competencies.map((competency) => (
                    <span key={competency} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-neutral-300">
                      {competency}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="border-brand-accent/20 bg-brand-accent/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Flag className="h-5 w-5 text-brand-accent" />
                Mission du jour
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-neutral-200">
              <h2 className="text-lg font-bold text-white">{todaysMission.title}</h2>
              <p className="leading-relaxed text-neutral-300">{todaysMission.objective}</p>
              <div className="rounded-xl border border-white/10 bg-surface-darker/60 p-3">
                <p className="font-semibold text-white">Livrable</p>
                <p className="mt-1 text-neutral-300">{todaysMission.deliverable}</p>
              </div>
              <Link href="/dashboard/eleve/eam-premiere/livret" className="inline-flex items-center text-sm font-bold text-brand-accent hover:text-white">
                Voir le livret
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-surface-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Target className="h-5 w-5 text-brand-accent" />
                Baromètre de compétences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {eamPremiereCompetencies.map((competency) => (
                <div key={competency.id} className="space-y-1">
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="font-semibold text-white">{competency.label}</span>
                    <span className="text-brand-accent">{competency.level}% cible</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-brand-accent" style={{ width: `${competency.level}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="border-white/10 bg-surface-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <ClipboardCheck className="h-5 w-5 text-brand-accent" />
              Banque anti-erreurs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {eamPremiereMistakesBank.slice(0, 4).map((mistake) => (
              <div key={mistake.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-semibold text-white">{mistake.trap}</p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-400">{mistake.repair}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-surface-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <TimerReset className="h-5 w-5 text-brand-accent" />
              Méthode d'épreuve
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-neutral-300">
            {eamPremiereExamMethods.map((method) => (
              <div key={method.id} className="rounded-lg bg-white/5 p-3">
                <p className="font-semibold text-white">{method.title}</p>
                <p className="mt-1 text-xs leading-relaxed">{method.rule}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-surface-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <BookOpenCheck className="h-5 w-5 text-brand-accent" />
              Week-end final
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {EAM_PREMIERE_FINAL_WEEKEND.map((day) => (
              <div key={day.date} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="font-semibold text-white">{day.label}</p>
                <p className="mt-1 text-xs text-neutral-400">{day.intent}</p>
                <ul className="mt-2 space-y-1 text-xs text-neutral-300">
                  {day.actions.slice(0, 2).map((action) => (
                    <li key={action} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" aria-hidden="true" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="border-white/10 bg-surface-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <FileText className="h-5 w-5 text-brand-accent" />
              Travail entre deux séances
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {eamPremiereBetweenSessions.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-bold text-brand-accent">{item.durationMinutes} min</p>
                <h3 className="mt-1 font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-neutral-400">{item.rule}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-emerald-300/20 bg-emerald-300/10">
          <CardHeader>
            <CardTitle className="text-white">Espace premium Nexus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {eamPremierePremiumFeedback.map((item) => (
              <div key={item.id}>
                <p className="text-sm font-semibold text-emerald-100">{item.title}</p>
                <p className="text-xs leading-relaxed text-emerald-50/80">{item.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-surface-card">
        <CardHeader>
          <CardTitle className="text-white">Sujet blanc et automatismes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-2">
          <div>
            <p className="text-sm leading-relaxed text-neutral-300">{eamPremiereBlankExamStrategy.scoringMindset[0]}</p>
            <ol className="mt-3 space-y-2 text-sm text-neutral-300">
              {eamPremiereBlankExamStrategy.order.map((item) => (
                <li key={item} className="rounded-lg bg-white/5 p-3">{item}</li>
              ))}
            </ol>
          </div>
          <div className="space-y-2">
            {eamPremiereQcmAutomatismes.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-semibold text-white">{item.prompt}</p>
                <p className="mt-1 text-xs text-neutral-400">{item.correction}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
