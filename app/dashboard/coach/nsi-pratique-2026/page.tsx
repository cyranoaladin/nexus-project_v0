'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Users, Loader2, BookOpen, CheckCircle2, AlertCircle } from 'lucide-react';

type StudentSummary = {
  studentId: string;
  userId: string;
  firstName: string;
  lastName: string;
  hasProgress: boolean;
  lastUpdated: string | null;
  summary: {
    subjectsMastered: number;
    subjectsTotal: number;
  };
};

function getReadinessLevel(student: StudentSummary): { label: string; color: string } {
  if (!student.hasProgress || student.summary.subjectsTotal === 0) {
    return { label: 'À consolider', color: 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30' };
  }
  const ratio = student.summary.subjectsMastered / student.summary.subjectsTotal;
  if (ratio >= 0.8) return { label: 'Prêt', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
  if (ratio >= 0.5) return { label: 'Presque prêt', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
  return { label: 'À consolider', color: 'bg-red-500/20 text-red-300 border-red-500/30' };
}

export default function CoachNsiPratique2026Page() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === 'unauthenticated' || (authStatus === 'authenticated' && role !== 'COACH')) {
      router.push('/auth/signin');
    }
  }, [authStatus, role, router]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || role !== 'COACH') return;

    setLoading(true);
    fetch('/api/coach/nsi-pratique-2026/students')
      .then((res) => {
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setStudents(data.students);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [authStatus, role]);

  if (authStatus === 'loading' || (authStatus === 'authenticated' && role === 'COACH' && loading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!session || role !== 'COACH') {
    return null;
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-brand-primary/10">
          <BookOpen className="h-5 w-5 text-brand-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-neutral-100">NSI Pratique 2026 — Suivi Élèves</h1>
          <p className="text-sm text-neutral-400">Progression de vos élèves NSI</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!error && students.length === 0 && (
        <div className="rounded-xl border border-neutral-700 bg-surface-secondary p-8 text-center">
          <Users className="h-8 w-8 text-neutral-500 mx-auto mb-3" />
          <p className="text-neutral-300 font-medium">Aucun élève NSI assigné</p>
          <p className="text-sm text-neutral-500 mt-1">
            Vos élèves avec le sujet NSI apparaîtront ici une fois assignés.
          </p>
        </div>
      )}

      {/* Student cards */}
      {students.length > 0 && (
        <div className="space-y-4">
          <div className="grid gap-4">
            {students.map((student) => {
              const level = getReadinessLevel(student);
              return (
                <div
                  key={student.studentId}
                  className="rounded-xl border border-neutral-700 bg-surface-secondary p-4 hover:border-brand-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-brand-primary/20 flex items-center justify-center text-sm font-medium text-brand-primary">
                        {student.firstName?.[0]}{student.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-neutral-100">
                          {student.firstName} {student.lastName}
                        </p>
                        {student.lastUpdated && (
                          <p className="text-xs text-neutral-500">
                            Dernière activité : {new Date(student.lastUpdated).toLocaleDateString('fr-FR', {
                              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {student.hasProgress ? (
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${level.color}`}>
                            {level.label}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <span className="text-sm text-neutral-300">
                              {student.summary.subjectsMastered}/{student.summary.subjectsTotal} sujets
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-500 italic">Pas encore commencé</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-neutral-500 italic">
            Les données affichées proviennent de la progression synchronisée des élèves.
            Si une élève travaille hors ligne ou sur un autre navigateur non synchronisé,
            la progression peut être temporairement incomplète.
          </p>
        </div>
      )}
    </div>
  );
}
