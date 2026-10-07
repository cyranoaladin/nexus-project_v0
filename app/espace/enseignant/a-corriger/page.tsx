import type { Metadata } from 'next';
import Link from 'next/link';

import { formatDateTime } from '@/lib/espace/format';
import { listWorksToCorrect } from '@/lib/espace/overview';
import { requireActorForPage } from '@/lib/espace/page-guard';
import { getOrganizationTimezone } from '@/lib/timezone';

export const metadata: Metadata = { title: 'À corriger' };
export const dynamic = 'force-dynamic';

export default async function ToCorrectPage() {
  const actor = await requireActorForPage(['COACH', 'ADMIN'], '/espace/enseignant/a-corriger');
  const items = await listWorksToCorrect(actor);
  const tz = getOrganizationTimezone();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-50">À corriger</h1>
      {items.length === 0 ? (
        <p className="rounded-lg border border-white/10 p-4 text-neutral-300">Rien à corriger pour le moment.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">Travaux remis en attente de correction, du plus ancien au plus récent</caption>
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-neutral-300">
              <tr>
                <th scope="col" className="px-3 py-2">Élève</th>
                <th scope="col" className="px-3 py-2">Activité</th>
                <th scope="col" className="px-3 py-2">Remis</th>
                <th scope="col" className="px-3 py-2">Progression</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {items.map((i) => (
                <tr key={i.workId} data-testid="correct-row">
                  <th scope="row" className="px-3 py-2 font-medium">
                    <Link href={`/espace/enseignant/corriger/${i.workId}`} className="text-neutral-50 underline decoration-white/30 underline-offset-2 hover:decoration-brand-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
                      {i.studentName}
                    </Link>
                  </th>
                  <td className="px-3 py-2 text-neutral-300">{i.subjectLabel} · {i.activityTitle}</td>
                  <td className="px-3 py-2 text-neutral-300">{i.submittedAt ? formatDateTime(i.submittedAt, tz) : '—'}</td>
                  <td className="px-3 py-2 tabular-nums text-neutral-200">{i.stepsTotal > 0 ? `${i.progressSteps}/${i.stepsTotal}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
