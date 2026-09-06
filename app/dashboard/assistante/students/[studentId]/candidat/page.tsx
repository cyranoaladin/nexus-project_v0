import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getCandidateProfileWorkflowStatus } from '@/lib/quotes/candidate-profile-flag';
import { getSupportedSessions } from '@/lib/exams/catalog';
import { CandidateProfileForm } from '@/components/dashboard/assistante/CandidateProfileForm';

export const dynamic = 'force-dynamic';
export default async function StudentCandidatePage({ params }: { params: Promise<{ studentId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/auth/signin');
  if (!['ADMIN', 'ASSISTANTE'].includes(session.user.role)) notFound();
  const { studentId } = await params;
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, user: { select: { firstName: true, lastName: true } } } });
  if (!student) notFound();
  const active = await getCandidateProfileWorkflowStatus() === 'ACTIVE_INTERNAL';
  const profile = active ? await prisma.profilCandidat.findFirst({ where: { studentId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: {
    id: true, level: true, examSession: true, modalite: true, specialite1: true, specialite2: true,
    estRedoublant: true, estTitulaireBacDejaObtenu: true, changementSpecialite: true, intentionCycleComplet: true,
  } }) : null;
  return <main className="mx-auto max-w-3xl space-y-6 p-4 text-white sm:p-8">
    <h1 className="text-2xl font-semibold">Dossier candidat — {student.user.firstName} {student.user.lastName}</h1>
    {active ? <CandidateProfileForm studentId={student.id} sessions={getSupportedSessions()} initialProfile={profile ?? undefined} /> : <p>La saisie des profils candidats n’est pas encore disponible. Le dossier familial reste enregistré ; contactez la direction pour la suite.</p>}
  </main>;
}
