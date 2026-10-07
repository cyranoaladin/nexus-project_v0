import { LessonPage } from '@/components/espace/student/LessonPage';
import { RECURSIVITE_ACTIVITY_SLUG } from '@/lib/espace/lesson-routes';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'NSI — Récursivité et programmation récursive' };

export default async function RecursivitePage({ searchParams }: { searchParams: Promise<{ seance?: string }> }) {
  const { seance } = await searchParams;
  return <LessonPage slug={RECURSIVITE_ACTIVITY_SLUG} seance={seance} subjectLabel="NSI" />;
}
