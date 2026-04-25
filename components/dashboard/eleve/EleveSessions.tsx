'use client';

import { Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { EleveDashboardData } from './types';

type EleveSessionsProps = {
  sessions: EleveDashboardData['recentSessions'];
  onBookSession?: () => void;
  readOnly?: boolean;
};

export function EleveSessions({ sessions, onBookSession, readOnly = false }: EleveSessionsProps) {
  return (
    <section id="sessions" aria-labelledby="eleve-sessions-title">
      <Card className="border-white/10 bg-surface-card">
        <CardHeader>
          <CardTitle id="eleve-sessions-title" className="flex items-center gap-2 text-white">
            <Calendar className="h-5 w-5 text-brand-accent" aria-hidden="true" />
            Mes sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-white">{session.title}</p>
                      <p className="text-sm text-neutral-400">{session.subject}</p>
                    </div>
                    <p className="text-sm text-brand-accent">
                      {new Date(session.scheduledAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm text-neutral-400">Aucune session récente.</p>
              {!readOnly && (
                <Button size="sm" onClick={onBookSession} className="btn-primary mt-3">
                  Réserver une séance
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
