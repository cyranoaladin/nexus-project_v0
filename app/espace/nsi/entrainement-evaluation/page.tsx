import { SuitesWorkspace } from '@/components/espace/student/SuitesWorkspace';
import { listAnnotations } from '@/lib/espace/annotations';
import { NSI_ENTRAINEMENT_ACTIVITY_SLUG, getActivityDef } from '@/lib/espace/catalog';
import { EspaceError } from '@/lib/espace/errors';
import { listAttachments } from '@/lib/espace/files';
import { requireActorForPage } from '@/lib/espace/page-guard';
import { openWork } from '@/lib/espace/works';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'NSI — Préparation de l’évaluation' };

export default async function EntrainementEvaluationPage() {
  const actor = await requireActorForPage(['ELEVE'], '/espace/nsi/entrainement-evaluation');
  const def = getActivityDef(NSI_ENTRAINEMENT_ACTIVITY_SLUG)!;

  let work;
  try {
    work = await openWork(actor, { activitySlug: NSI_ENTRAINEMENT_ACTIVITY_SLUG });
  } catch (e) {
    if (e instanceof EspaceError && (e.code === 'NOT_ENROLLED' || e.code === 'NOT_FOUND')) {
      return (
        <div className="mx-auto max-w-lg space-y-4 pt-10 text-center">
          <h1 className="text-2xl font-semibold text-neutral-50">Ce module n’est pas dans tes matières</h1>
          <p className="text-neutral-300">Tu n’es pas inscrit(e) en NSI. Si tu penses que c’est une erreur, préviens ton enseignant.</p>
          <Link href="/espace/eleve" className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-5 font-medium text-neutral-950">
            Retour à l’accueil
          </Link>
        </div>
      );
    }
    throw e;
  }

  const [attachments, annotations] = await Promise.all([listAttachments(actor, work.id), listAnnotations(actor, work.id)]);

  return (
    <SuitesWorkspace
      workId={work.id}
      activitySlug={def.slug}
      title={`${def.moduleTitle} — ${def.title}`}
      status={work.status}
      // Choix pédagogique assumé (2026-10-09) : sujets, corrigés détaillés et fiche sont
      // tous d'audience STUDENT pour permettre l'auto-correction en autonomie.
      resources={def.resources.filter((r) => r.audience === 'STUDENT').map((r) => ({ key: r.key, label: r.label }))}
      attachments={attachments}
      annotations={annotations}
    />
  );
}
