import Link from 'next/link';
import { notFound } from 'next/navigation';

import { auth } from '@/auth';
import {
  listRecentReportReviews,
  previewPendingReport,
  StaffReviewError,
  type RecentReportReview,
} from '@/lib/bilans/staff/review-service';

import { rejectReportAction, validateAndPublishReportAction } from './actions';

const AUDIENCES = ['ELEVE', 'PARENTS', 'NEXUS'] as const;

function statusClass(status: RecentReportReview['displayStatus']): string {
  if (status === 'Diffusé') return 'bg-emerald-300/15 text-emerald-100';
  if (status === 'Rejeté') return 'bg-red-300/15 text-red-100';
  return 'bg-amber-300/15 text-amber-100';
}

function provenanceLabel(provenance: string): string {
  return provenance === 'SAISIE_PAPIER' ? 'Saisie papier' : 'Passation en ligne';
}

function dateLabel(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Tunis',
  }).format(date);
}

export default async function CanonicalBilansReviewPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Readonly<{ preview?: string }>> }>) {
  const session = await auth();
  if (session?.user?.id === undefined || session.user.role === undefined) notFound();

  let revisions: readonly RecentReportReview[];
  try {
    revisions = await listRecentReportReviews({ userId: session.user.id, role: session.user.role });
  } catch (error) {
    if (error instanceof StaffReviewError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  const statusCounts = {
    pending: revisions.filter(({ displayStatus }) => displayStatus === 'En attente de diffusion').length,
    published: revisions.filter(({ displayStatus }) => displayStatus === 'Diffusé').length,
    rejected: revisions.filter(({ displayStatus }) => displayStatus === 'Rejeté').length,
  };
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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Revue administrative</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold text-white sm:text-4xl">Bilans récents et diffusion</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Chaque diffusion aux familles exige une lecture humaine des trois audiences. La validation et la publication sont déclenchées uniquement par l’action explicite de l’assistante.
          </p>
          <Link
            href="/dashboard/assistante/bilans/saisie-papier"
            className="mt-5 inline-block rounded-xl border border-amber-300 px-4 py-2.5 text-sm font-semibold text-amber-100"
          >
            Saisir un bilan passé sur copie papier
          </Link>
        </header>

        <section className="mt-8 grid gap-3 sm:grid-cols-3" aria-label="Synthèse des états de diffusion">
          {[
            ['En attente de diffusion', statusCounts.pending],
            ['Diffusé', statusCounts.published],
            ['Rejeté', statusCounts.rejected],
          ].map(([label, count]) => (
            <article key={label} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
              <p className="text-2xl font-semibold text-white">{count}</p>
              <p className="mt-1 text-sm text-slate-300">{label}</p>
            </article>
          ))}
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
            Aucun bilan récent à afficher.
          </section>
        ) : (
          <div className="mt-8 space-y-8">
            {revisions.map((revision) => {
              const blocked = revision.validationFailures.length > 0;
              const canReject = revision.status === 'PENDING_REVIEW';
              return (
                <article key={revision.id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06]">
                  <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-6">
                    <div>
                      <h2 className="text-xl font-semibold text-white">{revision.studentName}</h2>
                      <p className="mt-1 text-sm font-medium text-amber-100">{revision.packLabel}</p>
                      <p className="mt-2 text-sm text-slate-400">
                        {provenanceLabel(revision.reportArtifact.assessmentAttempt.provenance)} · {dateLabel(revision.createdAt)}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(revision.displayStatus)}`}>
                      {revision.displayStatus}
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

                  {revision.actionable ? (
                    <>
                      <div className="grid gap-4 p-6 xl:grid-cols-3">
                        {AUDIENCES.map((audience) => (
                          <section key={audience} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <h3 className="text-sm font-semibold text-amber-200">Document {audience}</h3>
                            <p className="mt-2 text-xs leading-5 text-slate-400">
                              Vérifiez le document humain avant toute diffusion.
                            </p>
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                              <a
                                href={`/dashboard/assistante/bilans/${encodeURIComponent(revision.id)}/document/${audience}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-amber-300/60 px-3 py-2 text-center text-xs font-semibold text-amber-100"
                              >
                                Prévisualiser le PDF
                              </a>
                              <a
                                href={`/dashboard/assistante/bilans/${encodeURIComponent(revision.id)}/document/${audience}?download=1`}
                                className="rounded-lg bg-amber-300 px-3 py-2 text-center text-xs font-semibold text-slate-950"
                              >
                                Télécharger le PDF
                              </a>
                            </div>
                          </section>
                        ))}
                      </div>

                      <div className="grid gap-4 border-t border-white/10 p-6 lg:grid-cols-2">
                        <a href={`/dashboard/assistante/bilans?preview=${encodeURIComponent(revision.id)}`} className="lg:col-span-2 rounded-xl border border-amber-300 px-4 py-2.5 text-center font-semibold text-amber-100">
                          Prévisualiser les trois rendus HTML
                        </a>
                        <form action={validateAndPublishReportAction} className="rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-4">
                          <input type="hidden" name="revisionId" value={revision.id} />
                          <label className="block text-sm font-semibold text-white" htmlFor={`approve-${revision.id}`}>Motif de validation et diffusion</label>
                          <textarea id={`approve-${revision.id}`} name="motif" required minLength={5} className="mt-3 min-h-24 w-full rounded-xl border border-white/15 bg-slate-950 p-3 text-sm text-white" />
                          <button type="submit" disabled={blocked} className="mt-3 rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
                            Valider et diffuser aux familles
                          </button>
                        </form>

                        {canReject && (
                          <form action={rejectReportAction} className="rounded-2xl border border-red-300/20 bg-red-300/5 p-4">
                            <input type="hidden" name="revisionId" value={revision.id} />
                            <label className="block text-sm font-semibold text-white" htmlFor={`reject-${revision.id}`}>Motif du rejet</label>
                            <textarea id={`reject-${revision.id}`} name="motif" required minLength={5} className="mt-3 min-h-24 w-full rounded-xl border border-white/15 bg-slate-950 p-3 text-sm text-white" />
                            <button type="submit" className="mt-3 rounded-xl border border-red-300 px-4 py-2.5 font-semibold text-red-100">
                              Rejeter le bilan
                            </button>
                          </form>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="px-6 py-5 text-sm text-slate-400">
                      {revision.displayStatus === 'Diffusé'
                        ? 'Le bilan a été diffusé aux destinataires prévus.'
                        : revision.displayStatus === 'Rejeté'
                          ? 'Le bilan a été rejeté et ne peut pas être diffusé.'
                          : blocked
                            ? 'Corrigez les blocages signalés avant de reprendre la diffusion.'
                            : 'Ce bilan n’est pas actionnable avec la configuration actuelle.'}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
