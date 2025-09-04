import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { Suspense } from 'react';
import Questionnaire from './questionnaire';

export const dynamic = 'force-dynamic';

async function fetchQuestionnaire(subject: string, grade: string, studentId?: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || '';
  const url = `${base}/api/bilan/questionnaire?subject=${encodeURIComponent(subject)}&grade=${encodeURIComponent(grade)}${studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load questionnaire');
  return res.json();
}

export default async function InitierBilanPage({ searchParams }: { searchParams?: { subject?: string; grade?: string; studentId?: string; }; }) {
  const session = await getServerSession(authOptions as any).catch(() => null);
  const studentId = String(searchParams?.studentId || (session && (session as any).user && (session as any).user.studentId) || '');
  const subject = String(searchParams?.subject || 'MATHEMATIQUES').toUpperCase();
  const grade = String(searchParams?.grade || 'premiere').toLowerCase();
  const data = await fetchQuestionnaire(subject, grade, studentId).catch(() => ({ qcm: null, pedago: null, hasPedago: false }));

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Démarrer le Bilan</h1>
      <Suspense fallback={<p>Chargement du questionnaire…</p>}>
        <Questionnaire data={data} studentId={studentId} subject={subject} grade={grade} />
      </Suspense>
    </div>
  );
}
// Ancien contenu de sélection parent/élève supprimé pour éviter les doublons d'export; à réintroduire dans une route dédiée si nécessaire.
