'use client';

import { AlertTriangle, CheckCircle2, CloudOff, Loader2, Lock, RefreshCw } from 'lucide-react';

import { formatClock } from '@/lib/espace/format';
import type { SaveState } from '@/lib/espace/client/sync-engine';

import { useEspaceTimezone } from './EspaceProvider';

interface Props {
  state: SaveState;
  lastSavedAt: Date | null;
}

/**
 * Dit toujours la vérité sur l'enregistrement : « enregistré » uniquement
 * après accusé du serveur. Texte + icône (jamais la couleur seule).
 */
export function SaveIndicator({ state, lastSavedAt }: Props) {
  const timezone = useEspaceTimezone();
  const view = (() => {
    switch (state) {
      case 'saving':
        return { icon: <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />, text: 'Enregistrement…', tone: 'text-neutral-300' };
      case 'syncing':
        return { icon: <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />, text: 'Synchronisation…', tone: 'text-neutral-300' };
      case 'offline':
        return { icon: <CloudOff className="h-4 w-4" aria-hidden="true" />, text: 'Hors connexion — gardez cette page ouverte jusqu’à la synchronisation.', tone: 'text-amber-300' };
      case 'error':
        return { icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />, text: 'La sauvegarde serveur a échoué. Gardez cette page ouverte et vérifiez votre connexion ou votre accès.', tone: 'text-amber-300' };
      case 'conflict':
        return { icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />, text: 'Ce travail a été modifié ailleurs : choisissez quelle version garder.', tone: 'text-amber-300' };
      case 'locked':
        return { icon: <Lock className="h-4 w-4" aria-hidden="true" />, text: 'Travail remis : lecture seule.', tone: 'text-neutral-300' };
      default:
        return {
          icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
          text: lastSavedAt ? `✓ Enregistré à ${formatClock(lastSavedAt, timezone)}` : '✓ Tout est enregistré',
          tone: 'text-emerald-300',
        };
    }
  })();

  return (
    <p role="status" aria-live="polite" data-testid="save-indicator" data-state={state} className={`inline-flex items-center gap-2 text-sm ${view.tone}`}>
      {view.icon}
      <span>{view.text}</span>
    </p>
  );
}
