import { notFound } from 'next/navigation';

import { auth } from '@/auth';
import {
  listStaffGroupPlanCandidates,
  StaffGroupPlanError,
  type StaffGroupPlanCandidate,
} from '@/lib/bilans/staff/group-plan-service';

export default async function CoachBilansGroupPlanPage() {
  const session = await auth();
  if (session?.user?.id === undefined || session.user.role === undefined) notFound();

  let groupCandidates: readonly StaffGroupPlanCandidate[];
  try {
    groupCandidates = await listStaffGroupPlanCandidates({ userId: session.user.id, role: session.user.role });
  } catch (error) {
    if (error instanceof StaffGroupPlanError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Préparation pédagogique</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold text-white sm:text-4xl">Plan de groupe — bilans de positionnement</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            La revue et la diffusion des bilans aux familles sont gérées par l’assistante. Cet espace reste dédié à la préparation pédagogique du stage.
          </p>
        </header>

        <section className="mt-8 rounded-3xl border border-sky-300/20 bg-sky-300/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">Préparation des cinq séances</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Construire un plan de groupe</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Sélectionnez trois à cinq passations scorées du même pack. Le document est généré à la demande, sans créer ni modifier un groupe en base.
          </p>
          {groupCandidates.length === 0 ? (
            <p className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">Aucune passation scorée n’est disponible sur un pack activé.</p>
          ) : (
            <form action="/dashboard/coach/bilans/group-plan" method="get" target="_blank" className="mt-5">
              <div className="grid gap-3 md:grid-cols-2">
                {groupCandidates.map((candidate) => (
                  <label key={candidate.id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
                    <input type="checkbox" name="attemptId" value={candidate.id} className="mt-1" />
                    <span><strong className="block text-white">{candidate.displayName}</strong><span className="text-xs text-slate-400">{candidate.assessmentPackId} · {candidate.status}</span></span>
                  </label>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="submit" name="format" value="html" className="rounded-xl bg-sky-300 px-4 py-2.5 font-semibold text-slate-950">Ouvrir le plan HTML</button>
                <button type="submit" name="format" value="pdf" className="rounded-xl border border-sky-300 px-4 py-2.5 font-semibold text-sky-100">Ouvrir le PDF</button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
