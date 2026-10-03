import { LessonPage } from '@/components/espace/student/LessonPage';
import { POO2_ACTIVITY_SLUG } from '@/lib/espace/lesson-routes';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'NSI — TP POO 2 : listes, piles et files' };

export default async function Poo2Page({ searchParams }: { searchParams: Promise<{ seance?: string }> }) {
  const { seance } = await searchParams;
  return <LessonPage slug={POO2_ACTIVITY_SLUG} seance={seance} subjectLabel="NSI" />;
}
