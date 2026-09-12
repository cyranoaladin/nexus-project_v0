'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type ApiFail, type StudentSelf, describeFailure, displayName, v2 } from './api';
import { EnrollmentSection } from './EnrollmentSummary';
import { StatusMessage } from './StatusMessage';
import { UpcomingSessions } from './UpcomingSessions';

/** Read-only view of the signed-in student's own enrollments (Core v2 authority, §AI). */
export function StudentEnrollments() {
  const [student, setStudent] = useState<StudentSelf | null>(null);
  const [failure, setFailure] = useState<ApiFail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void v2<StudentSelf>('/student/me').then((result) => {
      if (cancelled) return;
      if (result.ok) setStudent(result.data);
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
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Chargement de votre parcours…
      </p>
    );
  }
  if (!student) {
    if (failure?.status === 404) {
      return <StatusMessage kind="info">Aucune fiche élève n’est encore rattachée à votre compte. Contactez l’équipe Nexus Réussite.</StatusMessage>;
    }
    return <StatusMessage kind="error">{failure ? describeFailure(failure) : 'Erreur inattendue.'}</StatusMessage>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Mon parcours</h1>
        <p className="text-sm text-neutral-400">
          {displayName(student.user)}
          {student.parents.length > 0 && ` · Parents : ${student.parents.map((p) => displayName(p)).join(', ')}`}
        </p>
      </header>
      <UpcomingSessions scope="student" />
      {student.enrollments.length === 0 && <p role="status" className="text-neutral-400">Aucune inscription annuelle pour le moment.</p>}
      {student.enrollments.map((enrollment) => (
        <EnrollmentSection key={enrollment.id} enrollment={enrollment} />
      ))}
    </div>
  );
}
