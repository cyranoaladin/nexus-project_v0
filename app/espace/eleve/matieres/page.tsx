import Link from 'next/link';

import { requireActorForPage } from '@/lib/espace/page-guard';
import { getStudentDashboard } from '@/lib/espace/overview';

import { activityHref } from '@/components/espace/student/links';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mes matières' };

export default async function MesMatieres() {
  const actor = await requireActorForPage(['ELEVE'], '/espace/eleve/matieres');
  const { subjects } = await getStudentDashboard(actor);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-50">Mes matières</h1>
      {subjects.length === 0 ? (
        <p className="text-neutral-300">Tu n’es inscrit(e) à aucune matière pour l’instant.</p>
      ) : (
        subjects.map((s) => (
          <section key={s.subject} aria-labelledby={`m-${s.subject}`} className="rounded-xl border border-white/10 bg-surface-card p-5">
            <h2 id={`m-${s.subject}`} className="text-lg font-semibold text-neutral-50">
              {s.label}
            </h2>
            {s.activities.length === 0 ? (
              <p className="mt-2 text-neutral-300">Aucun contenu publié pour le moment.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {s.activities.map((a) => (
                  <li key={a.slug}>
                    <Link href={activityHref(a.slug)} className="text-brand-accent underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}
