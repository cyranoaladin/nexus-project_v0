import { notFound } from 'next/navigation';

import { BilanWorkbench } from '@/components/espace/student/BilanWorkbench';
import { listAnnotations } from '@/lib/espace/annotations';
import { EspaceError } from '@/lib/espace/errors';
import { BILAN_2NDE_ACTIVITY_SLUG, BILAN_3E_ACTIVITY_SLUG, lessonHref } from '@/lib/espace/lesson-routes';
import { fullName } from '@/lib/espace/overview';
import { requireActorForPage } from '@/lib/espace/page-guard';
import { openWork } from '@/lib/espace/works';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mon bilan de septembre — Nexus Réussite' };

export default async function BilanPage({ params, searchParams }: { params: Promise<{ level: string }>; searchParams: Promise<{ seance?: string }> }) {
  const { level } = await params;
  if (level !== '3e' && level !== '2nde') notFound();
  const { seance } = await searchParams;
  const slug = level === '3e' ? BILAN_3E_ACTIVITY_SLUG : BILAN_2NDE_ACTIVITY_SLUG;
  const actor = await requireActorForPage(['ELEVE'], lessonHref(slug, seance)!);
  try {
    const work = await openWork(actor, { activitySlug: slug, sessionId: seance ?? null });
    const annotations = await listAnnotations(actor, work.id);
    return <BilanWorkbench userId={actor.id} studentName={fullName(actor)} level={level}
      work={{ id: work.id, status: work.status, revision: work.revision, currentStep: work.currentStep, lastSavedAt: work.lastSavedAt, steps: work.content.steps }}
      annotations={annotations} />;
  } catch (error) {
    if (error instanceof EspaceError && ['NOT_FOUND', 'NOT_ENROLLED', 'FORBIDDEN'].includes(error.code)) notFound();
    throw error;
  }
}
