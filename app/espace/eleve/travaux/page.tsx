import Link from 'next/link';

import { StatusBadge } from '@/components/espace/shared/StatusBadge';
import { formatDateTime } from '@/lib/espace/format';
import { getStudentDashboard } from '@/lib/espace/overview';
import { requireActorForPage } from '@/lib/espace/page-guard';
import { getOrganizationTimezone } from '@/lib/timezone';

import { activityHref } from '@/components/espace/student/links';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mes travaux' };

export default async function MesTravaux() {
  const actor = await requireActorForPage(['ELEVE'], '/espace/eleve/travaux');
  const { works } = await getStudentDashboard(actor);
  const timezone = getOrganizationTimezone();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-50">Mes travaux</h1>
      {works.length === 0 ? (
        <p className="text-neutral-300">Tu n’as encore commencé aucun travail.</p>
      ) : (
        <ul className="space-y-3">
          {works.map((w) => (
            <li key={w.id} className="rounded-xl border border-white/10 bg-surface-card p-4" data-testid="travail">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link href={activityHref(w.activitySlug)} className="font-medium text-neutral-50 underline-offset-2 hover:underline">
                    {w.activityTitle}
                  </Link>
                  <p className="text-sm text-neutral-300">{w.subjectLabel}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {w.hasFeedback && (
                    <span className="rounded-full border border-brand-accent/50 px-2.5 py-0.5 text-xs text-brand-accent">Retour de l’enseignant</span>
                  )}
                  <StatusBadge status={w.status} audience="student" />
                </div>
              </div>
              <p className="mt-2 text-sm text-neutral-300">
                {w.stepsTotal > 0 && <>Progression : {w.progressSteps} sur {w.stepsTotal} · </>}
                Dernier enregistrement : {formatDateTime(w.lastSavedAt, timezone)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
