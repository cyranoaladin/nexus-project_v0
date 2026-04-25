'use client';

import { Calendar, ClipboardCheck, Gauge, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { EleveDashboardData } from './types';

type EleveCockpitProps = {
  data: EleveDashboardData;
  onBookSession?: () => void;
  onOpenAria?: () => void;
  readOnly?: boolean;
};

export function EleveCockpit({ data, onBookSession, onOpenAria, readOnly = false }: EleveCockpitProps) {
  const nextSession = data.nextSession;

  return (
    <section id="cockpit" aria-labelledby="eleve-cockpit-title" className="space-y-4">
      <div>
        <h2 id="eleve-cockpit-title" className="text-xl font-semibold text-neutral-100">
          Cockpit du jour
        </h2>
        <p className="text-sm text-neutral-400">
          {data.student.gradeLevel ?? data.student.grade} · {data.student.academicTrack ?? 'EDS_GENERALE'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-white/10 bg-surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-neutral-200">
              <Calendar className="h-4 w-4 text-brand-accent" aria-hidden="true" />
              Prochaine séance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {nextSession ? (
              <>
                <p className="font-medium text-white">{nextSession.title}</p>
                <p className="text-sm text-neutral-400">
                  {new Date(nextSession.scheduledAt).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-neutral-400">Aucune séance programmée.</p>
                {!readOnly && (
                  <Button size="sm" onClick={onBookSession} className="btn-primary">
                    Réserver
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-neutral-200">
              <Gauge className="h-4 w-4 text-brand-accent" aria-hidden="true" />
              Activité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-white">{data.sessionsCount ?? data.recentSessions.length}</p>
            <p className="text-sm text-neutral-400">sessions suivies ou programmées</p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-neutral-200">
              <MessageSquare className="h-4 w-4 text-brand-accent" aria-hidden="true" />
              ARIA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-semibold text-white">{data.ariaStats.totalConversations}</p>
            <p className="text-sm text-neutral-400">conversations pédagogiques</p>
            {!readOnly && (
              <Button size="sm" variant="outline" onClick={onOpenAria} className="border-brand-accent/30 text-brand-accent">
                Ouvrir ARIA
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-surface-card">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-neutral-300">
          <ClipboardCheck className="h-4 w-4 text-brand-accent" aria-hidden="true" />
          <span>La feuille de route et les alertes viennent du payload dashboard et seront enrichies par les APIs dédiées.</span>
        </CardContent>
      </Card>
    </section>
  );
}
