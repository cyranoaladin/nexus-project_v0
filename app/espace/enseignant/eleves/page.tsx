import type { Metadata } from 'next';
import Link from 'next/link';

import { listTeacherStudents } from '@/lib/espace/overview';
import { requireActorForPage } from '@/lib/espace/page-guard';

export const metadata: Metadata = { title: 'Élèves' };
export const dynamic = 'force-dynamic';

export default async function StudentsPage() {
  const actor = await requireActorForPage(['COACH', 'ADMIN'], '/espace/enseignant/eleves');
  const students = await listTeacherStudents(actor);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-50">Élèves</h1>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <caption className="sr-only">Vos élèves, leurs groupes et matières</caption>
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-neutral-300">
            <tr>
              <th scope="col" className="px-3 py-2">Élève</th>
              <th scope="col" className="px-3 py-2">Groupe</th>
              <th scope="col" className="px-3 py-2">Matières</th>
              <th scope="col" className="px-3 py-2">À corriger</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {students.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-neutral-400">Aucun élève rattaché à vos groupes.</td></tr>
            )}
            {students.map((s) => (
              <tr key={s.id} data-testid="student-row">
                <th scope="row" className="px-3 py-2 font-medium">
                  <Link href={`/espace/enseignant/eleves/${s.id}`} className="text-neutral-50 underline decoration-white/30 underline-offset-2 hover:decoration-brand-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
                    {s.name}
                  </Link>
                </th>
                <td className="px-3 py-2 text-neutral-300">{s.groups.join(', ')}</td>
                <td className="px-3 py-2 text-neutral-300">{s.subjects.map((x) => x.label).join(', ')}</td>
                <td className="px-3 py-2 tabular-nums text-neutral-100">{s.toCorrect > 0 ? <strong>{s.toCorrect}</strong> : '0'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
