import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import QuestionnaireClient from './questionnaireClient';

export const dynamic = 'force-dynamic';

async function fetchStructure(studentId: string, subject: string, grade: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || '';
  const url = `${base}/api/bilan/questionnaire-structure?studentId=${encodeURIComponent(studentId)}&subject=${encodeURIComponent(subject)}&grade=${encodeURIComponent(grade)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load questionnaire structure');
  return res.json();
}

export default async function Page({ params, searchParams }: { params: { bilanId: string; }; searchParams?: { subject?: string; grade?: string; studentId?: string; }; }) {
  const session: any = await getServerSession(authOptions as any).catch(() => null);
  const studentId = String(searchParams?.studentId || session?.user?.studentId || '');
  const subject = String(searchParams?.subject || 'MATHEMATIQUES').toUpperCase();
  const grade = String(searchParams?.grade || 'premiere').toLowerCase();
  const data = await fetchStructure(studentId, subject, grade).catch(() => ({ volet1: null, volet2: null, requiresVolet2: false }));
  return <QuestionnaireClient bilanId={params.bilanId} studentId={studentId} subject={subject} grade={grade} data={data} />;
}
