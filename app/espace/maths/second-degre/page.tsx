import { LessonPage } from '@/components/espace/student/LessonPage';
import { MATHS_SECOND_DEGRE_ACTIVITY_SLUG } from '@/lib/espace/lesson-routes';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mathématiques — Le second degré' };

export default async function SecondDegrePage({ searchParams }: { searchParams: Promise<{ seance?: string }> }) {
  const { seance } = await searchParams;
  return <LessonPage slug={MATHS_SECOND_DEGRE_ACTIVITY_SLUG} seance={seance} subjectLabel="Mathématiques" />;
}
