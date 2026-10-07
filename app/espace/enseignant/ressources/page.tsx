import type { Metadata } from 'next';

import { getPooRequiredSteps, POO_ACTIVITY_SLUG } from '@/lib/espace/catalog';
import { requireActorForPage } from '@/lib/espace/page-guard';
import { SUBJECT_LABELS } from '@/lib/espace/overview';

import { getTeacherScope } from '../_server';

export const metadata: Metadata = { title: 'Ressources' };
export const dynamic = 'force-dynamic';

export default async function ResourcesPage() {
  const actor = await requireActorForPage(['COACH', 'ADMIN'], '/espace/enseignant/ressources');
  const scope = await getTeacherScope(actor);
  const teachesPoo = scope.activities.some((a) => a.slug === POO_ACTIVITY_SLUG);
  const withResources = scope.activities.filter((a) => a.resources.length > 0);
  const steps = getPooRequiredSteps();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-50">Ressources</h1>

      {scope.activities.length === 0 && <p className="rounded-lg border border-white/10 p-4 text-neutral-300">Aucune ressource : aucune matière ne vous est affectée.</p>}

      {withResources.map((a) => (
        <section key={a.slug} aria-labelledby={`r-${a.slug}`}>
          <h2 id={`r-${a.slug}`} className="text-lg font-semibold text-neutral-50">{SUBJECT_LABELS[a.subject]} — {a.moduleTitle}</h2>
          <ul className="mt-3 divide-y divide-white/10 rounded-lg border border-white/10">
            {a.resources.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="text-neutral-100">{r.label}</span>
                <span className="flex items-center gap-3">
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${r.audience === 'TEACHER' ? 'border-amber-400/40 text-amber-200' : 'border-sky-400/40 text-sky-200'}`}>
                    {r.audience === 'TEACHER' ? 'Enseignant uniquement' : 'Visible des élèves'}
                  </span>
                  <a href={`/api/espace/resources/${a.slug}/${r.key}`} className="text-brand-accent underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">Télécharger (PDF)</a>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {teachesPoo && (
        <section aria-labelledby="r-poo">
          <h2 id="r-poo" className="text-lg font-semibold text-neutral-50">NSI — TP « Des objets qui agissent »</h2>
          <p className="mt-1 text-sm text-neutral-300">{steps.length} étapes obligatoires, {steps.reduce((n, s) => n + s.minutes, 0)} minutes, plus un bonus facultatif.</p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <caption className="sr-only">Étapes du TP</caption>
              <thead className="bg-white/5 text-xs uppercase tracking-wide text-neutral-300">
                <tr>
                  <th scope="col" className="px-3 py-2">Étape</th>
                  <th scope="col" className="px-3 py-2">Durée</th>
                  <th scope="col" className="px-3 py-2">Niveau</th>
                  <th scope="col" className="px-3 py-2">Notions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {steps.map((s, i) => (
                  <tr key={s.id}>
                    <th scope="row" className="px-3 py-2 font-medium text-neutral-50">{i + 1}. {s.title}</th>
                    <td className="px-3 py-2 tabular-nums text-neutral-300">{s.minutes} min</td>
                    <td className="px-3 py-2 text-neutral-300">{s.level}</td>
                    <td className="px-3 py-2 text-neutral-300">{s.concepts.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
