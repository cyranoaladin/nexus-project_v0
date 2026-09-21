'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type ApiFail, type CoachSummary, type Page, describeFailure, displayName, v2 } from './api';
import { useAction } from './actions';
import { StatusMessage } from './StatusMessage';

/**
 * Jalon B configuration loop: what a coach may teach (`CoachCourseCapability`)
 * — a necessary condition for `assignCoach`, never a claim about account
 * activity or planning availability. Reuses the existing
 * `/api/v2/staff/coaches` read and `/api/v2/staff/coaches/{id}/capabilities`
 * write (no new frontend capability registry): the server is the only
 * authority for both the admitted and the refused case.
 */
export function CoachCapabilitiesPanel({ can }: { can: (capability: string) => boolean }) {
  const [coaches, setCoaches] = useState<CoachSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<ApiFail | null>(null);

  const refresh = useCallback(async () => {
    const result = await v2<Page<CoachSummary>>('/staff/coaches?limit=100');
    if (result.ok) {
      setCoaches(result.data.items);
      setFailure(null);
    } else {
      setFailure(result);
    }
  }, []);

  useEffect(() => {
    void refresh().then(() => setLoading(false));
  }, [refresh]);

  const canManage = can('COACH_CAPABILITY_MANAGE');

  return (
    <Card className="border-white/10 bg-surface-dark" aria-labelledby="core-v2-coach-capabilities">
      <CardHeader>
        <h2 id="core-v2-coach-capabilities" className="text-base font-semibold text-white">
          Habilitations des coachs
        </h2>
        <p className="text-xs text-neutral-400">
          Ce qu’un coach est habilité à enseigner — condition nécessaire à une affectation, distincte de la disponibilité de planning ou de
          l’activité du compte.{!canManage && ' Lecture seule : vous n’avez pas le droit de modifier ces habilitations.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {failure && <StatusMessage kind="error">{describeFailure(failure)}</StatusMessage>}
        {loading ? (
          <p role="status" className="flex items-center gap-2 text-neutral-300">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Chargement des coachs…
          </p>
        ) : coaches.length === 0 && !failure ? (
          <p role="status" className="text-neutral-400">Aucun coach enregistré pour l’instant.</p>
        ) : (
          <ul className="space-y-3">
            {coaches.map((coach) => (
              <CoachCapabilityRow key={coach.id} coach={coach} canManage={canManage} refresh={refresh} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CoachCapabilityRow({
  coach,
  canManage,
  refresh,
}: {
  coach: CoachSummary;
  canManage: boolean;
  refresh: () => Promise<void>;
}) {
  const action = useAction(refresh, refresh);
  const [newKey, setNewKey] = useState('');

  return (
    <li id={`core-v2-coach-${coach.id}`} className="scroll-mt-24 rounded-md border border-white/10 p-3">
      <p className="font-medium text-neutral-100">{displayName(coach.user)}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {coach.capabilities.length === 0 && <span className="text-sm text-neutral-400">Aucune habilitation.</span>}
        {coach.capabilities.map((courseKey) => (
          <span key={courseKey} className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-100">
            {courseKey}
            {canManage && (
              <button
                type="button"
                className="ml-1 text-neutral-400 hover:text-white disabled:opacity-50"
                aria-label={`Retirer l’habilitation ${courseKey} à ${displayName(coach.user)}`}
                disabled={action.pending !== null}
                onClick={() =>
                  void action.run(
                    `revoke:${courseKey}`,
                    () => v2(`/staff/coaches/${coach.id}/capabilities`, { method: 'PUT', json: { courseKey, granted: false } }),
                    `Habilitation « ${courseKey} » retirée.`,
                  )
                }
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {canManage && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const key = newKey.trim().toLowerCase();
            if (!key || coach.capabilities.includes(key)) return;
            void action
              .run(
                'grant',
                () => v2(`/staff/coaches/${coach.id}/capabilities`, { method: 'PUT', json: { courseKey: key, granted: true } }),
                `Habilitation « ${key} » accordée.`,
              )
              .then((result) => {
                if (result?.ok) setNewKey('');
              });
          }}
        >
          <div>
            <Label htmlFor={`coach-cap-${coach.id}`}>Ajouter une habilitation</Label>
            <Input id={`coach-cap-${coach.id}`} value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="maths-premiere" />
          </div>
          <Button type="submit" size="sm" disabled={!newKey.trim() || action.pending !== null}>
            {action.pending === 'grant' ? 'Enregistrement…' : 'Ajouter'}
          </Button>
        </form>
      )}
      {action.failure && (
        <div className="mt-2">
          <StatusMessage kind="error">{describeFailure(action.failure)}</StatusMessage>
        </div>
      )}
      {action.success && (
        <div className="mt-2">
          <StatusMessage kind="success">{action.success}</StatusMessage>
        </div>
      )}
    </li>
  );
}
