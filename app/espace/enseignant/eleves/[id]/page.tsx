import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StatusBadge } from '@/components/espace/shared/StatusBadge';
import { EspaceError } from '@/lib/espace/errors';
import { formatDateTime } from '@/lib/espace/format';
import { getStudentFile, type StudentFile } from '@/lib/espace/overview';
import { requireActorForPage } from '@/lib/espace/page-guard';
import { getOrganizationTimezone } from '@/lib/timezone';

export const metadata: Metadata = { title: 'Fiche élève' };
export const dynamic = 'force-dynamic';

type Work = StudentFile['works'][number];

function WorkTable({ works, tz, caption }: { works: Work[]; tz: string; caption: string }) {
  if (works.length === 0) return <p className="text-sm text-neutral-400">Rien à afficher.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full min-w-[30rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-white/5 text-xs uppercase tracking-wide text-neutral-300">
          <tr>
            <th scope="col" className="px-3 py-2">Activité</th>
            <th scope="col" className="px-3 py-2">Progression</th>
            <th scope="col" className="px-3 py-2">Dernière sauvegarde</th>
            <th scope="col" className="px-3 py-2">Statut</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {works.map((w) => (
            <tr key={w.id}>
              <th scope="row" className="px-3 py-2 font-medium">
                <Link href={`/espace/enseignant/corriger/${w.id}`} className="text-neutral-50 underline decoration-white/30 underline-offset-2 hover:decoration-brand-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
                  {w.activityTitle}
                </Link>
                <span className="block text-xs font-normal text-neutral-400">{w.subjectLabel}</span>
              </th>
              <td className="px-3 py-2 tabular-nums text-neutral-200">{w.stepsTotal > 0 ? `${w.progressSteps}/${w.stepsTotal}` : '—'}</td>
              <td className="px-3 py-2 text-neutral-300">{formatDateTime(w.lastSavedAt, tz)}</td>
              <td className="px-3 py-2"><StatusBadge status={w.status} audience="teacher" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function StudentFilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActorForPage(['COACH', 'ADMIN'], `/espace/enseignant/eleves/${id}`);

  let file: StudentFile;
  try {
    file = await getStudentFile(actor, id);
  } catch (e) {
    if (e instanceof EspaceError && (e.code === 'NOT_FOUND' || e.code === 'FORBIDDEN')) notFound();
    throw e;
  }

  const tz = getOrganizationTimezone();
  const corrected = file.works.filter((w) => w.correctedAt);
  const sections = [
    { id: 'general', label: 'Vue générale' },
    ...file.subjects.map((s) => ({ id: `matiere-${s.subject}`, label: s.label })),
    { id: 'corrections', label: 'Corrections' },
    { id: 'historique', label: 'Historique' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm"><Link href="/espace/enseignant/eleves" className="text-brand-accent underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">← Élèves</Link></p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-50">{file.student.name}</h1>
          <p className="text-sm text-neutral-300">{file.subjects.map((s) => s.label).join(' · ')}</p>
        </div>
        <a href={`/api/espace/teacher/export?studentId=${file.student.id}`} className="rounded-md border border-white/15 px-3 py-2 text-sm text-neutral-100 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
          Exporter (JSON)
        </a>
      </div>

      <nav aria-label="Sections de la fiche" className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-neutral-200 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">{s.label}</a>
        ))}
      </nav>

      <section id="general" aria-labelledby="h-general" className="scroll-mt-4">
        <h2 id="h-general" className="mb-3 text-lg font-semibold text-neutral-50">Vue générale</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Travaux', file.works.length],
            ['À corriger', file.works.filter((w) => w.status === 'SUBMITTED').length],
            ['À reprendre', file.works.filter((w) => w.status === 'REOPENED').length],
            ['Corrigés', file.works.filter((w) => w.status === 'CORRECTED' || w.status === 'DONE').length],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-white/10 bg-surface-card p-3">
              <dt className="text-xs text-neutral-400">{label}</dt>
              <dd className="mt-1 text-2xl font-semibold text-neutral-50">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {file.subjects.map((s) => (
        <section key={s.subject} id={`matiere-${s.subject}`} aria-labelledby={`h-${s.subject}`} className="scroll-mt-4">
          <h2 id={`h-${s.subject}`} className="mb-3 text-lg font-semibold text-neutral-50">{s.label}</h2>
          <WorkTable works={file.works.filter((w) => w.subjectLabel === s.label)} tz={tz} caption={`Travaux de ${file.student.name} en ${s.label}`} />
        </section>
      ))}

      <section id="corrections" aria-labelledby="h-corrections" className="scroll-mt-4">
        <h2 id="h-corrections" className="mb-3 text-lg font-semibold text-neutral-50">Corrections</h2>
        <WorkTable works={corrected} tz={tz} caption="Travaux déjà relus" />
      </section>

      <section id="historique" aria-labelledby="h-historique" className="scroll-mt-4">
        <h2 id="h-historique" className="mb-3 text-lg font-semibold text-neutral-50">Historique</h2>
        {file.works.length === 0 ? (
          <p className="text-sm text-neutral-400">Aucune activité pour l’instant.</p>
        ) : (
          <ol className="space-y-2 text-sm text-neutral-200">
            {file.works.flatMap((w) => [
              { at: w.lastSavedAt, text: `Dernière sauvegarde — ${w.activityTitle}` },
              ...(w.submittedAt ? [{ at: w.submittedAt, text: `Remis — ${w.activityTitle}` }] : []),
              ...(w.correctedAt ? [{ at: w.correctedAt, text: `Corrigé — ${w.activityTitle}` }] : []),
            ])
              .sort((a, b) => b.at.localeCompare(a.at))
              .map((e, i) => (
                <li key={i}><span className="text-neutral-400">{formatDateTime(e.at, tz)}</span> · {e.text}</li>
              ))}
          </ol>
        )}
      </section>
    </div>
  );
}
