'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { type ApiFail, type CoachSelf, describeFailure, displayName, v2 } from './api';
import { ActiveSeries, ENROLLMENT_LABEL, yearLabel } from './EnrollmentSummary';
import { StatusMessage } from './StatusMessage';
import { UpcomingSessions } from './UpcomingSessions';

/** Read-only view of the signed-in coach's own Core v2 assignments (§AJ). */
export function CoachAssignments() {
  const [coach, setCoach] = useState<CoachSelf | null>(null);
  const [failure, setFailure] = useState<ApiFail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void v2<CoachSelf>('/coach/me').then((result) => {
      if (cancelled) return;
      if (result.ok) setCoach(result.data);
      else setFailure(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="core-v2 space-y-4">
    <Card className="border-white/10 bg-surface-card" aria-labelledby="core-v2-coach-assignments">
      <CardHeader>
        <h2 id="core-v2-coach-assignments" className="text-lg font-semibold text-white">Mes affectations</h2>
        {coach && (
          <p className="text-xs text-neutral-400">{`Habilitations : ${coach.capabilities.length === 0 ? 'aucune' : coach.capabilities.join(', ')}`}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <p role="status" className="flex items-center gap-2 text-neutral-300">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Chargement de vos affectations…
          </p>
        )}
        {!loading && !coach && (
          failure?.status === 404
            ? <StatusMessage kind="info">Aucun profil coach n’est rattaché à votre compte.</StatusMessage>
            : <StatusMessage kind="error">{failure ? describeFailure(failure) : 'Erreur inattendue.'}</StatusMessage>
        )}
        {coach && coach.assignments.filter((a) => a.status === 'ACTIVE').length === 0 && (
          <p role="status" className="text-sm text-neutral-400">Aucune affectation active pour l’instant.</p>
        )}
        {coach && (
          <ul className="space-y-2">
            {coach.assignments
              .filter((a) => a.status === 'ACTIVE')
              .map((a) => (
                <li key={a.id} className="rounded-md border border-white/10 p-3 text-sm">
                  <p className="font-medium text-neutral-100">
                    {displayName(a.student.user)} — {a.courseKey}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {yearLabel(a.enrollment.academicYear)} · {a.enrollment.gradeLevel} · {ENROLLMENT_LABEL[a.enrollment.status]}
                  </p>
                  <ActiveSeries series={a.planningSeries} />
                </li>
              ))}
          </ul>
        )}
      </CardContent>
    </Card>
    <UpcomingSessions scope="coach" />
    </div>
  );
}
