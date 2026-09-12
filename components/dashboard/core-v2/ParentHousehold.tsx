'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type ApiFail, type HouseholdDetail, describeFailure, displayName, v2 } from './api';
import { ACCOUNT_LABEL, EnrollmentSection } from './EnrollmentSummary';
import { StatusMessage } from './StatusMessage';
import { UpcomingSessions } from './UpcomingSessions';

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

      <UpcomingSessions scope="parent" />

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
              <EnrollmentSection key={enrollment.id} enrollment={enrollment} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
