'use client';

/**
 * Panneau « Aujourd'hui ».
 *
 * P0 : PROJECTION de la feuille de route et de la séance du jour déjà calculées
 * par le dashboard. Aucune recommandation générée par IA.
 */

import { CalendarClock, CheckCircle2, Circle, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AriaCockpitDTO } from '@/lib/aria/contracts';
import { EmptyState } from './EmptyState';

const ORIGIN_LABELS: Record<string, string> = {
  FEUILLE_DE_ROUTE: 'Feuille de route',
  NEXT_STEP: 'Prochaine étape',
  NEXT_SESSION: 'Séance',
};

export function AriaTodayPanel({ cockpit }: { cockpit: AriaCockpitDTO }) {
  const { today, nextSession } = cockpit;
  const pending = today.items.filter((item) => !item.done);

  return (
    <section id="aria-today" aria-labelledby="aria-today-title" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-white/10 bg-surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-neutral-200">
              <Target className="h-4 w-4 text-brand-accent" aria-hidden="true" />
              Objectif hebdomadaire
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-neutral-100">
              {today.weeklyGoalMinutes} <span className="text-sm font-normal text-neutral-400">min / semaine</span>
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {today.plannedMinutes !== null
                ? `${today.plannedMinutes} min planifiées dans ta feuille de route`
                : 'Rien de planifié pour le moment'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-surface-card md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-neutral-200">
              <CalendarClock className="h-4 w-4 text-brand-accent" aria-hidden="true" />
              Prochaine séance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextSession ? (
              <div>
                <p className="font-medium text-neutral-100">{nextSession.title}</p>
                <p className="mt-1 text-sm text-neutral-400">
                  {new Date(nextSession.scheduledAt).toLocaleString('fr-FR', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                  })}
                  {nextSession.coachName ? ` · ${nextSession.coachName}` : ''}
                </p>
              </div>
            ) : (
              <p className="text-sm text-neutral-400">Aucune séance programmée.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-surface-card">
        <CardHeader>
          <CardTitle id="aria-today-title" className="text-white">
            Ce que tu as à faire
          </CardTitle>
        </CardHeader>
        <CardContent>
          {today.items.length === 0 ? (
            <EmptyState
              title="Rien de planifié pour l’instant"
              body="Ta feuille de route se remplit au fil de tes séances et de tes bilans."
            />
          ) : (
            <ul className="space-y-2">
              {today.items.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.href ?? '#'}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                      item.done
                        ? 'border-white/5 bg-white/5 opacity-60'
                        : 'border-white/10 bg-white/5 hover:border-brand-accent/40 hover:bg-brand-accent/5'
                    }`}
                  >
                    {item.done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-neutral-600" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-neutral-100">{item.title}</span>
                      <span className="block text-xs text-neutral-500">
                        {ORIGIN_LABELS[item.origin] ?? item.origin}
                        {item.estimatedMinutes ? ` · ${item.estimatedMinutes} min` : ''}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {pending.length === 0 && today.items.length > 0 && (
            <p className="mt-3 text-xs text-emerald-300">Tout est fait pour aujourd’hui.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
