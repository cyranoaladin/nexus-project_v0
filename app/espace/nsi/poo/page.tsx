import { readFileSync } from 'node:fs';
import path from 'node:path';

import Link from 'next/link';

import { PooWorkbench } from '@/components/espace/student/PooWorkbench';
import { listAnnotations } from '@/lib/espace/annotations';
import { POO_ACTIVITY_SLUG, getPooContent } from '@/lib/espace/catalog';
import { EspaceError } from '@/lib/espace/errors';
import { requireActorForPage } from '@/lib/espace/page-guard';
import { openWork } from '@/lib/espace/works';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'NSI — Programmation orientée objet' };

// Harnais de contrôles du TP historique, repris tel quel (cf. test d'empreinte).
const RUNNER_PATH = 'content/espace/nsi-poo/runner.py';

export default async function PooPage({ searchParams }: { searchParams: Promise<{ seance?: string }> }) {
  const { seance } = await searchParams;
  const actor = await requireActorForPage(['ELEVE'], '/espace/nsi/poo');

  let work;
  try {
    work = await openWork(actor, { activitySlug: POO_ACTIVITY_SLUG, sessionId: seance ?? null });
  } catch (e) {
    if (e instanceof EspaceError && (e.code === 'NOT_ENROLLED' || e.code === 'NOT_FOUND')) {
      return (
        <div className="mx-auto max-w-lg space-y-4 pt-10 text-center">
          <h1 className="text-2xl font-semibold text-neutral-50">Ce TP n’est pas dans tes matières</h1>
          <p className="text-neutral-300">
            Tu n’es pas inscrit(e) en NSI, ou cette séance ne t’est pas destinée. Si tu penses que c’est une erreur, préviens ton enseignant.
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
  const runnerSource = readFileSync(path.join(process.cwd(), RUNNER_PATH), 'utf8');

  return (
    <PooWorkbench
      userId={actor.id}
      work={{
        id: work.id,
        status: work.status,
        revision: work.revision,
        currentStep: work.currentStep,
        lastSavedAt: work.lastSavedAt,
        steps: work.content.steps,
      }}
      content={getPooContent()}
      runnerSource={runnerSource}
      annotations={annotations}
    />
  );
}
