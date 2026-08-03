import { notFound } from 'next/navigation';

import { auth } from '@/auth';
import {
  listPendingReportReviews,
  previewPendingReport,
  StaffReviewError,
  type PendingReportReview,
} from '@/lib/bilans/staff/review-service';
import {
  listStaffGroupPlanCandidates,
  StaffGroupPlanError,
  type StaffGroupPlanCandidate,
} from '@/lib/bilans/staff/group-plan-service';

import { rejectReportAction, validateAndPublishReportAction } from './actions';

const AUDIENCES = ['ELEVE', 'PARENTS', 'NEXUS'] as const;

function audienceContent(revision: PendingReportReview, audience: typeof AUDIENCES[number]): unknown {
  if (typeof revision.content !== 'object' || revision.content === null || Array.isArray(revision.content)) return null;
  return (revision.content as Record<string, unknown>)[audience] ?? null;
}

export default async function CanonicalBilansReviewPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Readonly<{ preview?: string }>> }>) {
  const session = await auth();
  if (session?.user?.id === undefined || session.user.role === undefined) notFound();

  let revisions: readonly PendingReportReview[];
  let groupCandidates: readonly StaffGroupPlanCandidate[];
  try {
    revisions = await listPendingReportReviews({ userId: session.user.id, role: session.user.role });
    groupCandidates = await listStaffGroupPlanCandidates({ userId: session.user.id, role: session.user.role });
  } catch (error) {
    if (
      (error instanceof StaffReviewError && error.code === 'NOT_FOUND')
      || (error instanceof StaffGroupPlanError && error.code === 'NOT_FOUND')
    ) notFound();
    throw error;
  }
  const requestedPreview = (await searchParams).preview;
  let preview: Awaited<ReturnType<typeof previewPendingReport>> | null = null;
  if (requestedPreview !== undefined) {
    try {
      preview = await previewPendingReport({
        userId: session.user.id,
        role: session.user.role,
        revisionId: requestedPreview,
      });
    } catch (error) {
      if (error instanceof StaffReviewError && error.code === 'NOT_FOUND') notFound();
      throw error;
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Revue pédagogique interne</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold text-white sm:text-4xl">Bilans en attente de décision</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Chaque publication exige une lecture humaine des trois audiences. La validation et la publication sont déclenchées uniquement par l’action explicite du coach.
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

        {preview !== null && typeof preview === 'object' && 'audiences' in preview && (
          <section className="mt-8 rounded-3xl border border-amber-300/30 bg-amber-300/5 p-5">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-amber-200">
              PRÉVISUALISATION NON OFFICIELLE — aucun artefact enregistré
            </p>
            <div className="mt-5 grid gap-5 xl:grid-cols-3">
              {(preview.audiences as readonly Readonly<{ audience: string; html: string }>[]).map((item) => (
                <section key={item.audience}>
                  <h2 className="mb-2 text-sm font-semibold text-white">{item.audience}</h2>
                  <iframe title={`Prévisualisation ${item.audience}`} srcDoc={item.html} className="h-[46rem] w-full bg-white" />
                </section>
              ))}
            </div>
          </section>
        )}

        {revisions.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-300">
            Aucun bilan assigné n’attend de revue sur un pack actuellement activé.
          </section>
        ) : (
          <div className="mt-8 space-y-8">
            {revisions.map((revision) => {
              const blocked = revision.validationFailures.length > 0;
              return (
                <article key={revision.id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06]">
                  <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-6">
                    <div>
                      <p className="font-mono text-xs text-slate-400">Révision {revision.id}</p>
                      <h2 className="mt-2 text-xl font-semibold text-white">{revision.reportPackId} · v{revision.reportPackVersion}</h2>
                      <p className="mt-1 text-sm text-slate-400">Tentative {revision.reportArtifact.assessmentAttemptId}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${blocked ? 'bg-red-400/15 text-red-200' : 'bg-amber-300/15 text-amber-200'}`}>
                      {blocked ? 'Publication bloquée' : 'Revue requise'}
                    </span>
                  </header>

                  {blocked && (
                    <section role="alert" className="border-b border-red-400/20 bg-red-400/10 px-6 py-4 text-sm text-red-100">
                      <p className="font-semibold">Échecs de validation bloquants</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {revision.validationFailures.map((failure) => <li key={failure}>{failure}</li>)}
                      </ul>
                    </section>
                  )}

                  <div className="grid gap-4 p-6 xl:grid-cols-3">
                    {AUDIENCES.map((audience) => (
                      <section key={audience} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <h3 className="text-sm font-semibold text-amber-200">{audience}</h3>
                        <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-200">
                          {JSON.stringify(audienceContent(revision, audience), null, 2)}
                        </pre>
                      </section>
                    ))}
                  </div>

                  <div className="grid gap-4 border-t border-white/10 p-6 lg:grid-cols-2">
                    <a href={`/dashboard/coach/bilans?preview=${encodeURIComponent(revision.id)}`} className="lg:col-span-2 rounded-xl border border-amber-300 px-4 py-2.5 text-center font-semibold text-amber-100">
                      Prévisualiser le rendu final non officiel
                    </a>
                    <form action={validateAndPublishReportAction} className="rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-4">
                      <input type="hidden" name="revisionId" value={revision.id} />
                      <label className="block text-sm font-semibold text-white" htmlFor={`approve-${revision.id}`}>Motif de validation et publication</label>
                      <textarea id={`approve-${revision.id}`} name="motif" required minLength={5} className="mt-3 min-h-24 w-full rounded-xl border border-white/15 bg-slate-950 p-3 text-sm text-white" />
                      <button type="submit" disabled={blocked} className="mt-3 rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
                        Valider et publier
                      </button>
                    </form>

                    <form action={rejectReportAction} className="rounded-2xl border border-red-300/20 bg-red-300/5 p-4">
                      <input type="hidden" name="revisionId" value={revision.id} />
                      <label className="block text-sm font-semibold text-white" htmlFor={`reject-${revision.id}`}>Motif du rejet</label>
                      <textarea id={`reject-${revision.id}`} name="motif" required minLength={5} className="mt-3 min-h-24 w-full rounded-xl border border-white/15 bg-slate-950 p-3 text-sm text-white" />
                      <button type="submit" className="mt-3 rounded-xl border border-red-300 px-4 py-2.5 font-semibold text-red-100">
                        Rejeter le bilan
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
