import { readFileSync } from 'node:fs';
import path from 'node:path';

import Link from 'next/link';

import { listAnnotations } from '@/lib/espace/annotations';
import { getLesson } from '@/lib/espace/catalog';
import { EspaceError } from '@/lib/espace/errors';
import { lessonHref } from '@/lib/espace/lesson-routes';
import { requireActorForPage } from '@/lib/espace/page-guard';
import { openWork } from '@/lib/espace/works';

import { LessonWorkbench } from './LessonWorkbench';

/** Page serveur commune des leçons guidées : ouvre (ou reprend) le travail de l'élève connecté, jamais celui d'un autre. */
export async function LessonPage({ slug, seance, subjectLabel }: { slug: string; seance?: string; subjectLabel: string }) {
  const lesson = getLesson(slug);
  if (!lesson) throw new Error(`Leçon inconnue : ${slug}`);
  const actor = await requireActorForPage(['ELEVE'], lessonHref(slug) ?? '/espace');

  let work;
  try {
    work = await openWork(actor, { activitySlug: slug, sessionId: seance ?? null });
  } catch (e) {
    if (e instanceof EspaceError && (e.code === 'NOT_ENROLLED' || e.code === 'NOT_FOUND')) {
      return (
        <div className="mx-auto max-w-lg space-y-4 pt-10 text-center">
          <h1 className="text-2xl font-semibold text-neutral-50">Ce parcours n’est pas dans tes matières</h1>
          <p className="text-neutral-300">
            Tu n’es pas inscrit(e) en {subjectLabel}, ou cette séance ne t’est pas destinée. Si tu penses que c’est une erreur, préviens ton enseignant.
          </p>
          <Link href="/espace/eleve" className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-5 font-medium text-neutral-950">
            Retour à l’accueil
          </Link>
        </div>
      );
    }
    throw e;
  }

  const annotations = await listAnnotations(actor, work.id);
  const runnerSource = lesson.runnerPath ? readFileSync(path.join(process.cwd(), lesson.runnerPath), 'utf8') : null;

  return (
    <LessonWorkbench
      userId={actor.id}
      work={{ id: work.id, status: work.status, revision: work.revision, currentStep: work.currentStep, lastSavedAt: work.lastSavedAt, steps: work.content.steps }}
      content={lesson.content}
      runnerSource={runnerSource}
      annotations={annotations}
    />
  );
}
