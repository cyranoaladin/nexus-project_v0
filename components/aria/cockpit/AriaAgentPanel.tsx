'use client';

/**
 * Panneau ARIA.
 *
 * P0 : point d'entrée vers le chat ARIA EXISTANT, avec la matière présélectionnée.
 * Le pipeline de chat n'est pas refondu ici. Aucune réponse n'est simulée et
 * aucune source documentaire n'est affichée tant que les citations ne sont pas
 * réellement enregistrées.
 */

import { MessageSquare, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AriaCockpitDTO } from '@/lib/aria/contracts';
import { EmptyState } from './EmptyState';

interface AriaAgentPanelProps {
  cockpit: AriaCockpitDTO;
  onOpenChat: (courseKey: string) => void;
}

export function AriaAgentPanel({ cockpit, onOpenChat }: AriaAgentPanelProps) {
  const chattable = cockpit.curriculum.courses.filter(
    (view) => view.course.chatSubject !== null && view.access.commerciallyEntitled,
  );

  return (
    <section id="aria-agent" aria-labelledby="aria-agent-title" className="space-y-4">
      <h2 id="aria-agent-title" className="text-lg font-semibold text-neutral-100">
        ARIA
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-white/10 bg-surface-card">
          <CardContent className="py-4">
            <p className="text-xs text-neutral-400">Conversations</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-100">
              {cockpit.aria.totalConversations}
            </p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-surface-card">
          <CardContent className="py-4">
            <p className="text-xs text-neutral-400">Messages aujourd’hui</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-100">
              {cockpit.aria.messagesToday}
            </p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-surface-card">
          <CardContent className="py-4">
            <p className="text-xs text-neutral-400">Matières ouvertes</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-100">{chattable.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-surface-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm text-neutral-200">
            <MessageSquare className="h-4 w-4 text-brand-accent" aria-hidden="true" />
            Démarrer une conversation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chattable.length === 0 ? (
            <EmptyState
              title="Aucune matière ouverte pour ARIA"
              body="Ton abonnement ne donne pas encore accès au chat ARIA pour les matières de ta carte."
            />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {chattable.map((view) => (
                <Button
                  key={view.course.key}
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChat(view.course.key)}
                  className="justify-start border-white/10 text-neutral-200 hover:border-brand-accent/40 hover:text-brand-accent"
                >
                  <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  {view.course.shortLabel}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-neutral-500">
        ARIA travaille aujourd’hui à partir de la matière sélectionnée. Le contexte
        détaillé de ton cours et les sources citées arriveront dans une prochaine étape.
      </p>
    </section>
  );
}
