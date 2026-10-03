import Link from 'next/link';

import { StatusBadge } from '@/components/espace/shared/StatusBadge';
import { formatClock } from '@/lib/espace/format';
import { getStudentDashboard } from '@/lib/espace/overview';
import { requireActorForPage } from '@/lib/espace/page-guard';
import { activityHref } from '@/components/espace/student/links';
import { getOrganizationTimezone } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export default async function EleveAccueil() {
  const actor = await requireActorForPage(['ELEVE'], '/espace/eleve');
  const dashboard = await getStudentDashboard(actor);
  const timezone = getOrganizationTimezone();
  const { next } = dashboard;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-50" data-testid="bonjour">
        Bonjour {dashboard.firstName || 'à toi'}
      </h1>

      <section aria-labelledby="a-faire" className="rounded-xl border border-white/10 bg-surface-card p-5">
        <h2 id="a-faire" className="text-sm font-medium uppercase tracking-wide text-neutral-300">
          À faire maintenant
        </h2>
        {next ? (
          <div className="mt-3 space-y-3" data-testid="a-faire-maintenant">
            <p className="text-neutral-300">{next.subjectLabel}</p>
            <p className="text-xl font-semibold text-neutral-50">{next.activityTitle}</p>
            {next.stepsTotal > 0 && (
              <p className="text-neutral-200">
                Étape {Math.min((next.currentStep ?? 0) + 1, next.stepsTotal)} sur {next.stepsTotal}
              </p>
            )}
            {next.lastSavedAt && <p className="text-sm text-neutral-300">Dernière sauvegarde : {formatClock(next.lastSavedAt, timezone)}</p>}
            <Link
              href={activityHref(next.activitySlug, next.sessionId)}
              className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-5 font-medium text-neutral-950 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {next.workId && next.status !== 'DRAFT' ? 'Continuer mon TP' : 'Commencer'}
            </Link>
          </div>
        ) : (
          <p className="mt-3 text-neutral-300">Rien à faire pour le moment. Ton enseignant publiera la prochaine séance ici.</p>
        )}
      </section>

      <section aria-labelledby="mes-matieres">
        <h2 id="mes-matieres" className="mb-3 text-lg font-semibold text-neutral-50">
          Mes matières
        </h2>
        {dashboard.subjects.length === 0 ? (
          <p className="text-neutral-300">Tu n’es inscrit(e) à aucune matière pour l’instant.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dashboard.subjects.map((s) => (
              <li key={s.subject} className="rounded-xl border border-white/10 bg-surface-card p-4" data-testid="matiere">
                <p className="font-medium text-neutral-50">{s.label}</p>
                <ul className="mt-2 space-y-1">
                  {s.activities.map((a) => (
                    <li key={a.slug}>
                      <Link href={activityHref(a.slug)} className="text-sm text-brand-accent underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
                        {a.title}
                      </Link>
                    </li>
                  ))}
                  {s.activities.length === 0 && <li className="text-sm text-neutral-300">Aucune activité pour le moment.</li>}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="mes-travaux">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="mes-travaux" className="text-lg font-semibold text-neutral-50">
            Mes travaux
          </h2>
          <Link href="/espace/eleve/travaux" className="text-sm text-brand-accent underline underline-offset-2">
            Tout voir
          </Link>
        </div>
        {dashboard.works.length === 0 ? (
          <p className="text-neutral-300">Aucun travail commencé.</p>
        ) : (
          <ul className="divide-y divide-white/10 rounded-xl border border-white/10 bg-surface-card">
            {dashboard.works.slice(0, 5).map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <Link href={activityHref(w.activitySlug)} className="text-neutral-100 underline-offset-2 hover:underline">
                  {w.activityTitle}
                </Link>
                <StatusBadge status={w.status} audience="student" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
