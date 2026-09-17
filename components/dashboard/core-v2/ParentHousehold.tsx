'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type ApiFail, type HouseholdDetail, describeFailure, displayName, v2 } from './api';
import { StatusMessage } from './StatusMessage';

const ENROLLMENT_LABEL: Record<HouseholdDetail['students'][number]['enrollments'][number]['status'], string> = {
  PENDING: 'En attente de validation',
  ACTIVE: 'Inscription active',
  COMPLETED: 'Année terminée',
  WITHDRAWN: 'Inscription retirée',
};
const ACCOUNT_LABEL: Record<HouseholdDetail['parents'][number]['accountStatus'], string> = {
  PENDING_ACTIVATION: 'à activer',
  ACTIVE: 'actif',
  SUSPENDED: 'suspendu',
  DISABLED: 'désactivé',
};
const WEEKDAY: Record<string, string> = { MO: 'lundi', TU: 'mardi', WE: 'mercredi', TH: 'jeudi', FR: 'vendredi', SA: 'samedi', SU: 'dimanche' };

function describeRule(rule: string): string {
  const day = /BYDAY=([A-Z]{2})/.exec(rule)?.[1];
  return day ? `chaque ${WEEKDAY[day] ?? day}` : 'chaque semaine';
}

/** Read-only view of the signed-in parent's own household (Core v2 authority). */
export function ParentHousehold() {
  const [household, setHousehold] = useState<HouseholdDetail | null>(null);
  const [failure, setFailure] = useState<ApiFail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void v2<HouseholdDetail>('/parent/household').then((result) => {
      if (cancelled) return;
      if (result.ok) setHousehold(result.data);
      else setFailure(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <p role="status" className="flex items-center gap-2 text-neutral-300">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Chargement de votre foyer…
      </p>
    );
  }
  if (!household) {
    if (failure?.status === 404) {
      return <StatusMessage kind="info">Aucun foyer n’est encore rattaché à votre compte. Contactez l’équipe Nexus Réussite.</StatusMessage>;
    }
    return <StatusMessage kind="error">{failure ? describeFailure(failure) : 'Erreur inattendue.'}</StatusMessage>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Mon foyer</h1>
        <p className="text-sm text-neutral-400">
          Parents : {household.parents.map((p) => `${displayName(p)} (${ACCOUNT_LABEL[p.accountStatus]})`).join(', ')}
        </p>
      </header>

      {household.students.length === 0 && <p role="status" className="text-neutral-400">Aucun enfant n’est encore enregistré dans votre foyer.</p>}

      {household.students.map((student) => (
        <Card key={student.id} className="border-white/10 bg-surface-card">
          <CardHeader>
            <CardTitle className="text-lg text-white">{displayName(student.user)}</CardTitle>
            <p className="text-xs text-neutral-400">Compte élève : {ACCOUNT_LABEL[student.user.accountStatus]}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {student.enrollments.length === 0 && <p role="status" className="text-sm text-neutral-400">Aucune inscription annuelle pour le moment.</p>}
            {student.enrollments.map((enrollment) => (
              <section key={enrollment.id} aria-label={`Année ${enrollment.academicYear.startYear}-${enrollment.academicYear.startYear + 1}`} className="rounded-md border border-white/10 p-3">
                <p className="font-medium text-neutral-100">
                  {enrollment.academicYear.startYear}-{enrollment.academicYear.startYear + 1} · {ENROLLMENT_LABEL[enrollment.status]}
                </p>
                <p className="text-sm text-neutral-400">
                  {enrollment.gradeLevel} · {enrollment.academicTrack}
                  {enrollment.stmgPathway && ` · ${enrollment.stmgPathway}`}
                </p>
                <div className="mt-2 text-sm text-neutral-200">
                  <span className="text-neutral-400">Cours : </span>
                  {enrollment.courses.length === 0 ? 'aucun cours explicite' : enrollment.courses.map((c) => c.courseKey).join(', ')}
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {enrollment.assignments.filter((a) => a.status === 'ACTIVE').length === 0 && (
                    <li className="text-neutral-400">Aucun coach affecté pour l’instant.</li>
                  )}
                  {enrollment.assignments
                    .filter((a) => a.status === 'ACTIVE')
                    .map((a) => (
                      <li key={a.id} className="text-neutral-100">
                        {a.courseKey} — {displayName(a.coach.user)}
                        {a.planningSeries
                          .filter((s) => s.status === 'ACTIVE')
                          .map((s) => (
                            <span key={s.id} className="block text-xs text-neutral-400">
                              {describeRule(s.recurrenceRule)} {s.localStartTime}–{s.localEndTime} ({s.timezone})
                            </span>
                          ))}
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
