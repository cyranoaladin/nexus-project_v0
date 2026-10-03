import { LessonPage } from '@/components/espace/student/LessonPage';
import { MATHS_LIMITES_ACTIVITY_SLUG } from '@/lib/espace/lesson-routes';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mathématiques — Fonctions, limites et lecture graphique' };

export default async function LimitesPage({ searchParams }: { searchParams: Promise<{ seance?: string }> }) {
  const { seance } = await searchParams;
  return <LessonPage slug={MATHS_LIMITES_ACTIVITY_SLUG} seance={seance} subjectLabel="Mathématiques" />;
}
