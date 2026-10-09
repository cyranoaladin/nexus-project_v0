import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CorrectionWorkspace, type AnnotationView } from '@/components/espace/teacher/CorrectionWorkspace';
import type { ViewerStepContent, ViewerStepDef } from '@/components/espace/teacher/WorkViewer';
import { loadWorkForActor } from '@/lib/espace/access';
import { listAnnotations } from '@/lib/espace/annotations';
import { getLesson, getLessonSteps } from '@/lib/espace/catalog';
import { bilanData, getBilanLevel } from '@/lib/espace/bilan-data';
import { bilanCorrections } from '@/lib/espace/bilan-corrections';
import { bilanViewerSteps } from '@/lib/espace/bilan-display';
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
    const bilanLevel = getBilanLevel(work.activity.slug);
    const steps: ViewerStepDef[] = bilanLevel ? bilanViewerSteps(bilanLevel) : getLessonSteps(work.activity.slug).map((s) => ({
      id: s.id,
      title: s.title,
      short: s.short,
      starter: s.starter,
      questions: s.questions.map((q) => ({ id: q.id, text: q.text, choices: q.choices, correct: q.correct })),
      fields: s.fields.map((f) => ({ id: f.id, label: f.label })),
    }));

    return (
      <>
      {bilanLevel && <details className="mb-6 rounded-xl border border-brand-accent/30 bg-surface-card p-4"><summary className="cursor-pointer font-medium text-neutral-100">Repères pédagogiques réservés à l’enseignant</summary><p className="mt-3 text-sm text-neutral-300">Ne retenir que les contenus réellement travaillés. Une réussite aidée et une réussite autonome restent distinctes. Sans deux traces comparables datées, présenter un état des lieux, pas une progression mesurée.</p><div className="mt-4 space-y-5">{bilanData.tasks.filter(t => bilanData.modules[bilanLevel].some(m => m.id === t.module)).map(t => <section key={t.id}><h2 className="font-medium text-neutral-100">{t.title}</h2><p className="mt-1 text-sm text-neutral-200">{bilanCorrections[t.id]?.expected}</p><p className="mt-1 text-sm text-neutral-300">À observer : {bilanCorrections[t.id]?.focus}</p><p className="mt-1 text-xs text-neutral-400">{bilanData.sources[t.source]} · p. {t.pages}</p></section>)}</div></details>}
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
        bilan={!!bilanLevel}
        skills={getLesson(work.activity.slug)?.content.skills?.map((s) => ({ id: s.id, label: s.label }))}
      />
      </>
    );
  } catch (e) {
    if (e instanceof EspaceError && (e.code === 'NOT_FOUND' || e.code === 'FORBIDDEN')) notFound();
    throw e;
  }
}
