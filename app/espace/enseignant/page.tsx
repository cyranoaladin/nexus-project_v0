import type { Metadata } from 'next';
import Link from 'next/link';

import { isBilanActivitySlug } from '@/lib/espace/lesson-routes';
import { LiveRoster } from '@/components/espace/teacher/LiveRoster';
import { getTeacherOverview, latestActiveActivitySlug } from '@/lib/espace/overview';
import { requireActorForPage } from '@/lib/espace/page-guard';

import { getTeacherScope, pickActivity } from './_server';

export const metadata: Metadata = { title: 'Accueil enseignant' };
export const dynamic = 'force-dynamic';

export default async function TeacherHome({ searchParams }: { searchParams: Promise<{ activite?: string }> }) {
  const actor = await requireActorForPage(['COACH', 'ADMIN'], '/espace/enseignant');
  const { activite } = await searchParams;
  const scope = await getTeacherScope(actor);
  const activity = pickActivity(scope, activite ?? (await latestActiveActivitySlug(actor)) ?? undefined);

  if (!activity) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-neutral-50">Accueil</h1>
        <p className="mt-4 rounded-lg border border-white/10 p-4 text-neutral-300">
          Aucun groupe ne vous est affecté pour le moment. L’affectation se fait par le provisioning de l’espace.
        </p>
      </div>
    );
  }

  const overview = await getTeacherOverview(actor, activity.slug);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-300">{overview.activity.subjectLabel}</p>
          <h1 className="text-2xl font-semibold text-neutral-50">{activity.moduleTitle} — {activity.title}</h1>
        </div>
        {scope.activities.length > 1 && (
          <nav aria-label="Choisir l’activité" className="flex flex-wrap gap-2">
            {scope.activities.map((a) => (
              <Link
                key={a.slug}
                href={`/espace/enseignant?activite=${a.slug}`}
                aria-current={a.slug === activity.slug ? 'page' : undefined}
                className={`rounded-md border px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent ${a.slug === activity.slug ? 'border-brand-accent bg-white/10 text-neutral-50' : 'border-white/15 text-neutral-300 hover:bg-white/5'}`}
              >
                {isBilanActivitySlug(a.slug) ? a.title : a.title.split(' — ')[0]}
              </Link>
            ))}
          </nav>
        )}
      </div>
      <LiveRoster initial={overview} />
    </div>
  );
}
