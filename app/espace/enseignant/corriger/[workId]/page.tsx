import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CorrectionWorkspace, type AnnotationView } from '@/components/espace/teacher/CorrectionWorkspace';
import type { ViewerStepContent, ViewerStepDef } from '@/components/espace/teacher/WorkViewer';
import { loadWorkForActor } from '@/lib/espace/access';
import { listAnnotations } from '@/lib/espace/annotations';
import { POO_ACTIVITY_SLUG, getPooContent } from '@/lib/espace/catalog';
import { EspaceError } from '@/lib/espace/errors';
import { listAttachments } from '@/lib/espace/files';
import { fullName, getTeacherOverview } from '@/lib/espace/overview';
import { requireActorForPage } from '@/lib/espace/page-guard';
import { toWorkDto } from '@/lib/espace/works';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = { title: 'Correction' };
export const dynamic = 'force-dynamic';

export default async function CorrectPage({ params }: { params: Promise<{ workId: string }> }) {
  const { workId } = await params;
  const actor = await requireActorForPage(['COACH', 'ADMIN'], `/espace/enseignant/corriger/${workId}`);

  try {
    const { work } = await loadWorkForActor(actor, workId, 'teacher');
    const dto = toWorkDto(work);
    const [annotations, attachments, overview, student] = await Promise.all([
      listAnnotations(actor, workId),
      listAttachments(actor, workId),
      getTeacherOverview(actor, work.activity.slug),
      prisma.user.findUniqueOrThrow({ where: { id: work.studentId }, select: { firstName: true, lastName: true } }),
    ]);

    // Seules les métadonnées utiles à l'affichage partent au navigateur (pas le HTML des leçons).
    const steps: ViewerStepDef[] =
      work.activity.slug === POO_ACTIVITY_SLUG
        ? getPooContent().steps.map((s) => ({
            id: s.id,
            title: s.title,
            short: s.short,
            starter: s.starter,
            questions: s.questions.map((q) => ({ id: q.id, text: q.text, choices: q.choices, correct: q.correct })),
            fields: s.fields.map((f) => ({ id: f.id, label: f.label })),
          }))
        : [];

    return (
      <CorrectionWorkspace
        work={{
          id: dto.id,
          status: dto.status,
          revision: dto.revision,
          activityTitle: dto.activityTitle,
          content: { steps: dto.content.steps as Record<string, ViewerStepContent> },
        }}
        studentName={fullName(student)}
        steps={steps}
        attachments={attachments.map((a) => ({ id: a.id, originalName: a.originalName, mimeType: a.mimeType, sizeBytes: a.sizeBytes }))}
        annotations={annotations as AnnotationView[]}
        queue={overview.rows.map((r) => ({
          studentId: r.studentId,
          workId: r.workId,
          name: r.name,
          status: r.status,
          progress: overview.activity.stepsTotal > 0 ? `${r.progressSteps}/${overview.activity.stepsTotal}` : '—',
        }))}
        isAdmin={actor.role === 'ADMIN'}
      />
    );
  } catch (e) {
    if (e instanceof EspaceError && (e.code === 'NOT_FOUND' || e.code === 'FORBIDDEN')) notFound();
    throw e;
  }
}
