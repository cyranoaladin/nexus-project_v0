import Link from 'next/link';
import { notFound } from 'next/navigation';

import { auth } from '@/auth';
import {
  diffusionBlockedReasons,
  listRecentReportReviews,
  listScoringFailures,
  previewPendingReport,
  StaffReviewError,
  type RecentReportReview,
} from '@/lib/bilans/staff/review-service';

import { REPORT_ANNOTATION_SECTIONS } from '@/lib/bilans/core/report-service';
import { teacherBriefMonthlyUsage } from '@/lib/bilans/llm/teacher-brief-service';
import { prisma } from '@/lib/prisma';
import type { TeacherBriefContent } from '@/lib/bilans/llm/teacher-brief-schema';

import {
  addParentEmailAction,
  executeRegenerationAction,
  prepareUpdateInfoMessageAction,
  approveTeacherBriefAction,
  confirmWhatsAppTransmissionAction,
  generateTeacherBriefAction,
  prepareWhatsAppSendAction,
  rejectReportAction,
  requestCorrectionAction,
  requestTeacherBriefCorrectionAction,
  resumeReviewAction,
  validateAndPublishReportAction,
} from './actions';

function briefStatusLabel(status: string): string {
  if (status === 'PENDING_REVIEW') return 'Généré — en attente de relecture';
  if (status === 'APPROVED') return 'Relu et validé';
  if (status === 'CORRECTION_REQUESTED') return 'Correction demandée — à régénérer';
  return status;
}

function renderBriefText(content: TeacherBriefContent): string {
  return content.domaines.map((domaine) => [
    `■ ${domaine.domainId}`,
    'Erreurs typiques :',
    ...domaine.erreursTypiques.map((erreur) => `  — ${erreur.constat} (origine : ${erreur.origine})`),
    `Prérequis à vérifier : ${domaine.prerequisAVerifier.join(' · ')}`,
    `Activité : ${domaine.activite.titre} — ${domaine.activite.objectif}`,
    `Matériel : ${domaine.activite.materiel}`,
    ...domaine.activite.deroule.map((phase) => `  ${phase.nom} (${phase.dureeMin} min) : ${phase.consigne}`),
    `Différenciation : ${domaine.activite.differenciation}`,
    `Indicateur de progrès : ${domaine.indicateurProgres}`,
  ].join('\n')).join('\n\n');
}

const ANNOTATION_SECTION_LABELS: Readonly<Record<string, string>> = {
  introduction: 'Introduction',
  methode: 'Note de méthode',
  forces: 'Points d’appui',
  priorites: 'Priorités',
  parcours: 'Parcours de séances',
  'plan-action': 'Plan d’action',
  'detail-reponses': 'Détail des réponses',
  calibration: 'Auto-évaluation',
  conclusion: 'Conclusion',
  autre: 'Autre',
  'reprise-de-revue': 'Reprise de revue',
};

const WORKFLOW_PHASES = [
  'Foyer et enfants',
  'Saisie des tests',
  'Revue du bilan',
  'Diffusion',
  'Envoi WhatsApp',
  'Suivi',
] as const;

const AUDIENCES = ['ELEVE', 'PARENTS', 'NEXUS'] as const;

function statusClass(status: RecentReportReview['displayStatus']): string {
  if (status === 'Diffusé' || status === 'Transmis au parent') return 'bg-emerald-300/15 text-emerald-100';
  if (status === 'Rejeté') return 'bg-red-300/15 text-red-100';
  if (status === 'Correction demandée') return 'bg-sky-300/15 text-sky-100';
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
}: Readonly<{ searchParams: Promise<Readonly<{ preview?: string; regen?: string }>> }>) {
  const session = await auth();
  if (session?.user?.id === undefined || session.user.role === undefined) notFound();

  let revisions: readonly RecentReportReview[];
  try {
    revisions = await listRecentReportReviews({ userId: session.user.id, role: session.user.role });
  } catch (error) {
    if (error instanceof StaffReviewError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  const scoringFailures = await listScoringFailures({ userId: session.user.id, role: session.user.role });
  const statusCounts = {
    missingEmail: revisions.filter(({ displayStatus }) => displayStatus === 'Prêt — contact parent manquant').length,
    pending: revisions.filter(({ displayStatus }) => displayStatus === 'En attente de diffusion').length,
    correction: revisions.filter(({ displayStatus }) => displayStatus === 'Correction demandée').length,
    published: revisions.filter(({ displayStatus }) => displayStatus === 'Diffusé').length,
    transmitted: revisions.filter(({ displayStatus }) => displayStatus === 'Transmis au parent').length,
    rejected: revisions.filter(({ displayStatus }) => displayStatus === 'Rejeté').length,
  };
  const artifactIds = revisions.map(({ reportArtifact }) => reportArtifact.id);
  const briefs = await prisma.teacherBrief.findMany({
    where: { reportArtifactId: { in: artifactIds }, status: { in: ['PENDING_REVIEW', 'APPROVED', 'CORRECTION_REQUESTED'] } },
    orderBy: { version: 'desc' },
    select: {
      id: true, reportArtifactId: true, status: true, version: true, content: true,
      editedContent: true, promptVersion: true, model: true, reviewedAt: true,
      reviewedBy: { select: { firstName: true, lastName: true } },
      annotations: { select: { section: true, remark: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  const briefByArtifact = new Map<string, (typeof briefs)[number]>();
  for (const brief of briefs) {
    if (!briefByArtifact.has(brief.reportArtifactId)) briefByArtifact.set(brief.reportArtifactId, brief);
  }
  const briefUsage = await teacherBriefMonthlyUsage();

  const resolvedParams = await searchParams;
  const requestedPreview = resolvedParams.preview;
  const requestedRegen = resolvedParams.regen;
  let regenPreview: Awaited<ReturnType<typeof import('@/lib/bilans/staff/regeneration-service').prepareReportRegeneration>> | null = null;
  if (requestedRegen !== undefined) {
    const { prepareReportRegeneration, ReportRegenerationError } = await import('@/lib/bilans/staff/regeneration-service');
    try {
      regenPreview = await prepareReportRegeneration({
        actor: { userId: session.user.id, role: session.user.role },
        revisionId: requestedRegen,
      });
    } catch (error) {
      if (!(error instanceof ReportRegenerationError)) throw error;
      regenPreview = null;
    }
  }
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

        {scoringFailures.length > 0 && (
          <section className="mt-6 rounded-2xl border border-red-400/40 bg-red-400/10 p-5" data-testid="scoring-impossible">
            <h2 className="font-semibold text-red-100">Scoring impossible — élève sans bilan, à reprendre</h2>
            <p className="mt-1 text-sm text-red-100/80">
              {scoringFailures.length === 1 ? 'Une passation n’a pas pu être scorée' : `${scoringFailures.length} passations n’ont pas pu être scorées`} : l’élève n’a pas de bilan. Vérifiez la copie et re-saisissez-la, ou signalez-la à l’équipe technique.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-red-50">
              {scoringFailures.map((failure) => (
                <li key={failure.attemptId} className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-semibold">{failure.studentName}</span>
                  <span className="text-red-100/70">{provenanceLabel(failure.provenance)}</span>
                  {failure.submittedAt !== null && <span className="text-red-100/70">soumis le {dateLabel(failure.submittedAt)}</span>}
                  <span className="text-red-100/70">· {failure.attempts} tentative{failure.attempts > 1 ? 's' : ''}{failure.quarantined ? ' · en quarantaine' : ''}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav aria-label="Fil du workflow" className="mt-8 overflow-x-auto">
          <ol className="flex min-w-max items-center gap-2 text-xs text-slate-300">
            {WORKFLOW_PHASES.map((phase, index) => (
              <li key={phase} className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-300/60 font-semibold text-amber-200">{index + 1}</span>
                <span>{phase}</span>
                {index < WORKFLOW_PHASES.length - 1 && <span aria-hidden className="text-slate-600">→</span>}
              </li>
            ))}
          </ol>
        </nav>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Synthèse des états de diffusion">
          {[
            ['bilans prêts sans contact parent', statusCounts.missingEmail],
            ['En attente de diffusion', statusCounts.pending],
            ['Correction demandée', statusCounts.correction],
            ['Diffusé, à transmettre', statusCounts.published],
            ['Transmis au parent', statusCounts.transmitted],
            ['Rejeté', statusCounts.rejected],
          ].map(([label, count]) => (
            <article key={label} className={`rounded-2xl border p-4 ${label === 'bilans prêts sans contact parent' ? 'border-amber-300/50 bg-amber-300/10' : 'border-white/10 bg-white/[0.05]'}`}>
              <p className="text-2xl font-semibold text-white">{count}</p>
              <p className="mt-1 text-sm text-slate-300">{label}</p>
            </article>
          ))}
        </section>

        <p className="mt-3 text-xs text-slate-400">
          Assistant de rédaction enseignant — usage du mois : {briefUsage.briefs} brief{briefUsage.briefs > 1 ? 's' : ''}, {briefUsage.promptTokens + briefUsage.completionTokens} jetons (dont {briefUsage.cachedPromptTokens} en cache), ≈ {briefUsage.estimatedCostUsd.toFixed(2)} $ US.
        </p>

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

                  {revision.parentEmailMissing && revision.actionable && (
                    <section className="border-b border-amber-300/20 bg-amber-300/10 px-6 py-5">
                      <h3 className="font-semibold text-amber-100">Ajouter l’e-mail du parent</h3>
                      <p className="mt-1 text-sm text-slate-300">
                        L'e-mail est nécessaire pour créer l'accès en ligne du parent (activation du compte).
                        {revision.parentPhoneMissing
                          ? ' La diffusion attend un contact : renseignez un e-mail ou un téléphone.'
                          : ' La diffusion, elle, est déjà possible par WhatsApp au téléphone enregistré.'}
                      </p>
                      <form action={addParentEmailAction} className="mt-3 flex flex-col gap-3 sm:flex-row">
                        <input type="hidden" name="revisionId" value={revision.id} />
                        <label className="sr-only" htmlFor={`parent-email-${revision.id}`}>E-mail du parent</label>
                        <input
                          id={`parent-email-${revision.id}`}
                          name="email"
                          type="email"
                          required
                          placeholder="parent@exemple.tn"
                          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-white"
                        />
                        <button type="submit" className="rounded-xl bg-amber-300 px-4 py-2.5 font-semibold text-slate-950">
                          Ajouter l’e-mail et envoyer l’activation
                        </button>
                      </form>
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

                        {(revision.status === 'PENDING_REVIEW' || revision.status === 'CORRECTION_REQUESTED' || revision.reportArtifact.status === 'PUBLISHED') && (
                          regenPreview !== null && regenPreview.revisionId === revision.id ? (
                            <section className="lg:col-span-2 rounded-2xl border border-sky-300/30 bg-sky-300/5 p-5" data-testid="regeneration-apercu">
                              <h3 className="font-semibold text-sky-100">Régénérer le bilan — aperçu avant validation</h3>
                              <p className="mt-1 text-sm text-slate-300">
                                Règle {regenPreview.engineVersionBefore} → {regenPreview.engineVersionAfter} · génération {regenPreview.generation} → {regenPreview.nextGeneration}.
                                Le snapshot de score reste intact ; le bilan régénéré repasse en revue avant toute diffusion.
                              </p>
                              {regenPreview.changes.length === 0 ? (
                                <p className="mt-3 text-sm text-emerald-100">Aucun profil ne change : seule la mise en page et la prose seraient actualisées.</p>
                              ) : (
                                <ul className="mt-3 space-y-1 text-sm text-slate-200" data-testid="regeneration-diff">
                                  {regenPreview.changes.map((change) => (
                                    <li key={`${change.kind}-${change.id}`}>
                                      <span className="font-mono text-xs text-slate-400">{change.kind === 'DOMAIN' ? 'domaine' : 'nœud'}</span>{' '}
                                      <span className="font-semibold">{change.id}</span> : {change.before} → <span className="font-semibold text-amber-200">{change.after}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <p className="mt-3 text-sm text-slate-300">
                                {regenPreview.briefWillRegenerate
                                  ? 'Le brief enseignant sera régénéré (1 appel LLM facturé) puis repassera en relecture.'
                                  : 'Aucun appel LLM : pas de brief actif à régénérer.'}
                              </p>
                              {regenPreview.artifactStatus === 'PUBLISHED' && (
                                <p className="mt-3 rounded-xl border border-amber-300/40 bg-amber-300/10 p-3 text-sm text-amber-100" role="alert">
                                  Ce bilan a été diffusé{regenPreview.transmittedAt !== null ? ` et transmis le ${dateLabel(regenPreview.transmittedAt)}` : regenPreview.publishedAt !== null ? ` le ${dateLabel(regenPreview.publishedAt)}` : ''}.
                                  La famille verra la nouvelle version par son lien après re-validation et re-publication.
                                </p>
                              )}
                              <form action={executeRegenerationAction} className="mt-4">
                                <input type="hidden" name="revisionId" value={revision.id} />
                                <label className="block text-sm font-semibold text-white" htmlFor={`regen-motif-${revision.id}`}>Motif de la régénération</label>
                                <textarea id={`regen-motif-${revision.id}`} name="motif" required minLength={5} className="mt-2 min-h-20 w-full rounded-xl border border-white/15 bg-slate-950 p-3 text-sm text-white" placeholder="Ex. : correction de la règle de profil (v1.1.0)" />
                                {regenPreview.artifactStatus === 'PUBLISHED' && (
                                  <label className="mt-3 flex items-start gap-2 text-sm text-amber-100">
                                    <input type="checkbox" name="confirmAlreadyPublished" required className="mt-1" />
                                    <span>Je confirme la régénération d’un bilan déjà diffusé à une famille.</span>
                                  </label>
                                )}
                                <button type="submit" className="mt-3 rounded-xl bg-sky-400 px-4 py-2.5 font-semibold text-slate-950">
                                  Régénérer le bilan
                                </button>
                                <Link href="/dashboard/assistante/bilans" className="ml-3 text-sm text-slate-300 underline">Annuler</Link>
                              </form>
                            </section>
                          ) : (
                            <a
                              href={`/dashboard/assistante/bilans?regen=${encodeURIComponent(revision.id)}`}
                              className="lg:col-span-2 rounded-xl border border-sky-300/50 px-4 py-2.5 text-center font-semibold text-sky-100"
                              data-testid="regeneration-preparer"
                            >
                              Préparer une régénération du bilan
                            </a>
                          )
                        )}
                        <form action={validateAndPublishReportAction} className="rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-4">
                          <input type="hidden" name="revisionId" value={revision.id} />
                          <label className="block text-sm font-semibold text-white" htmlFor={`approve-${revision.id}`}>Motif de validation et diffusion</label>
                          <textarea id={`approve-${revision.id}`} name="motif" required minLength={5} className="mt-3 min-h-24 w-full rounded-xl border border-white/15 bg-slate-950 p-3 text-sm text-white" />
                          <button type="submit" disabled={blocked || !revision.diffusable} className="mt-3 rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
                            Valider et diffuser aux familles
                          </button>
                          {(blocked || !revision.diffusable) && (
                            <ul className="mt-3 space-y-1 text-sm text-amber-100" data-testid="diffusion-bloquee-motifs">
                              {diffusionBlockedReasons(revision).map((reason) => (
                                <li key={reason}>{reason}</li>
                              ))}
                            </ul>
                          )}
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
                      {revision.displayStatus === 'Transmis au parent' && revision.transmittedAt !== null
                        ? `Transmis au parent le ${dateLabel(revision.transmittedAt)} par WhatsApp.`
                        : revision.displayStatus === 'Diffusé'
                          ? 'Le bilan a été diffusé. Prochaine étape : l’envoyer au parent par WhatsApp.'
                          : revision.displayStatus === 'Correction demandée'
                            ? 'Une correction a été demandée. Le bilan reviendra en revue dès qu’elle sera apportée.'
                            : revision.displayStatus === 'Rejeté'
                              ? 'Le bilan a été rejeté et ne peut pas être diffusé.'
                              : blocked
                                ? 'Corrigez les blocages signalés avant de reprendre la diffusion.'
                                : 'Ce bilan n’est pas actionnable avec la configuration actuelle.'}
                    </p>
                  )}

                  {revision.status === 'PENDING_REVIEW' && (
                    <details className="border-t border-white/10 px-6 py-5">
                      <summary className="cursor-pointer text-sm font-semibold text-sky-200">
                        Demander une correction ciblée
                      </summary>
                      <form action={requestCorrectionAction} className="mt-4 grid gap-3 lg:grid-cols-2">
                        <input type="hidden" name="revisionId" value={revision.id} />
                        <label className="text-sm text-slate-300">
                          Document concerné
                          <select name="audience" required className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-white">
                            <option value="ELEVE">Bilan élève</option>
                            <option value="PARENTS">Bilan parents</option>
                            <option value="NEXUS">Document interne Nexus</option>
                          </select>
                        </label>
                        <label className="text-sm text-slate-300">
                          Section concernée
                          <select name="section" required className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-white">
                            {REPORT_ANNOTATION_SECTIONS.filter((section) => section !== 'reprise-de-revue').map((section) => (
                              <option key={section} value={section}>{ANNOTATION_SECTION_LABELS[section] ?? section}</option>
                            ))}
                          </select>
                        </label>
                        <label className="lg:col-span-2 text-sm text-slate-300">
                          Remarque pour la correction
                          <textarea name="remark" required minLength={5} className="mt-1 min-h-20 w-full rounded-xl border border-white/15 bg-slate-950 p-3 text-sm text-white" />
                        </label>
                        <label className="lg:col-span-2 text-sm text-slate-300">
                          Motif structuré
                          <input name="motif" required minLength={5} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-white" placeholder="Exemple : reformuler la priorité no 2 du bilan élève" />
                        </label>
                        <button type="submit" className="rounded-xl border border-sky-300 px-4 py-2.5 font-semibold text-sky-100">
                          Renvoyer en correction
                        </button>
                      </form>
                    </details>
                  )}

                  {revision.correctionRequested && (
                    <section className="border-t border-sky-300/20 bg-sky-300/5 px-6 py-5">
                      <h3 className="font-semibold text-sky-100">Correction demandée — reprise de revue</h3>
                      <p className="mt-1 text-sm text-slate-300">
                        Une fois la correction apportée, reprenez la revue : le bilan reviendra dans la file « À revoir », historique intact.
                      </p>
                      <form action={resumeReviewAction} className="mt-3 flex flex-col gap-3 sm:flex-row">
                        <input type="hidden" name="revisionId" value={revision.id} />
                        <input name="motif" required minLength={5} placeholder="Correction apportée : préciser quoi" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                        <button type="submit" className="rounded-xl bg-sky-300 px-4 py-2.5 font-semibold text-slate-950">
                          Reprendre la revue
                        </button>
                      </form>
                    </section>
                  )}

                  {revision.reportArtifact.status === 'PUBLISHED' && (
                    <section className="border-t border-emerald-300/20 bg-emerald-300/5 px-6 py-5">
                      <h3 className="font-semibold text-emerald-100">Envoi au parent par WhatsApp</h3>
                      {revision.transmittedAt !== null ? (
                        <>
                          <p className="mt-1 text-sm text-emerald-100">
                            Transmis au parent le {dateLabel(revision.transmittedAt)} par WhatsApp.
                          </p>
                          {revision.generation > 1 && !revision.parentPhoneMissing && (
                            <form action={prepareUpdateInfoMessageAction} target="_blank" className="mt-3">
                              <input type="hidden" name="artifactId" value={revision.reportArtifact.id} />
                              <button type="submit" className="rounded-xl border border-emerald-300 px-4 py-2.5 font-semibold text-emerald-100" data-testid="whatsapp-info-mise-a-jour">
                                Préparer le message d’information (bilan mis à jour)
                              </button>
                              <p className="mt-2 text-xs leading-5 text-slate-400">
                                Ce bilan régénéré remplace une version que la famille a déjà reçue : un court message courtois
                                l’informe de la mise à jour. Les liens existants restent valables — rien n’est révoqué.
                              </p>
                            </form>
                          )}
                        </>
                      ) : revision.parentPhoneMissing ? (
                        <p className="mt-1 text-sm text-slate-300">
                          Aucun téléphone enregistré pour ce parent : l’envoi WhatsApp est indisponible.
                        </p>
                      ) : (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <form action={prepareWhatsAppSendAction} target="_blank">
                            <input type="hidden" name="artifactId" value={revision.reportArtifact.id} />
                            <button type="submit" className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-slate-950">
                              Envoyer par WhatsApp
                            </button>
                            <p className="mt-2 text-xs leading-5 text-slate-400">
                              Prépare des liens signés neufs (élève et parents, jamais le document interne) et ouvre WhatsApp avec le message prêt à envoyer.
                            </p>
                          </form>
                          <form action={confirmWhatsAppTransmissionAction}>
                            <input type="hidden" name="artifactId" value={revision.reportArtifact.id} />
                            <button type="submit" className="w-full rounded-xl border border-emerald-300 px-4 py-2.5 font-semibold text-emerald-100">
                              Confirmer : message envoyé
                            </button>
                            <p className="mt-2 text-xs leading-5 text-slate-400">
                              À confirmer après l’envoi effectif — c’est cette trace qui alimente le suivi « qui a reçu quoi ».
                            </p>
                          </form>
                        </div>
                      )}
                    </section>
                  )}

                  {(() => {
                    const brief = briefByArtifact.get(revision.reportArtifact.id);
                    const briefContent = brief?.content as TeacherBriefContent | undefined;
                    return (
                      <section className="border-t border-indigo-300/20 bg-indigo-300/5 px-6 py-5">
                        <h3 className="font-semibold text-indigo-100">Brief enseignant (document interne)</h3>
                        <p className="mt-1 text-xs text-slate-400">
                          Préparation de séance rédigée par l’assistant de rédaction à partir du diagnostic déterministe, relue avant tout usage. Jamais transmis aux familles.
                        </p>
                        {brief === undefined ? (
                          <form action={generateTeacherBriefAction} className="mt-3">
                            <input type="hidden" name="artifactId" value={revision.reportArtifact.id} />
                            <button type="submit" className="rounded-xl border border-indigo-300 px-4 py-2.5 text-sm font-semibold text-indigo-100">
                              Générer le brief enseignant
                            </button>
                            <p className="mt-2 text-xs text-slate-500">
                              Si l’assistant de rédaction est indisponible, le document interne Nexus déterministe reste la référence.
                            </p>
                          </form>
                        ) : (
                          <div className="mt-3 space-y-3">
                            <p className="text-sm">
                              <span className="rounded-full bg-indigo-300/15 px-3 py-1 text-xs font-semibold text-indigo-100">{briefStatusLabel(brief.status)}</span>
                              <span className="ml-3 text-xs text-slate-400">v{brief.version} · {brief.promptVersion} · {brief.model}{brief.reviewedAt ? ` · relu le ${dateLabel(brief.reviewedAt)}` : ''}</span>
                            </p>
                            {brief.editedContent ? (
                              <div className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-5 text-slate-200">{brief.editedContent}</div>
                            ) : briefContent !== undefined && (
                              <div className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-5 text-slate-200">{renderBriefText(briefContent)}</div>
                            )}
                            {brief.annotations.length > 0 && (
                              <ul className="space-y-1 text-xs text-sky-200">
                                {brief.annotations.map((annotation, index) => (
                                  <li key={index}>Annotation ({annotation.section}) : {annotation.remark}</li>
                                ))}
                              </ul>
                            )}
                            {brief.status === 'PENDING_REVIEW' && (
                              <div className="grid gap-3 lg:grid-cols-2">
                                <form action={approveTeacherBriefAction} className="rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-4">
                                  <input type="hidden" name="briefId" value={brief.id} />
                                  <label className="block text-xs font-semibold text-white">Motif de validation</label>
                                  <input name="motif" required minLength={5} className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white" />
                                  <label className="mt-3 block text-xs font-semibold text-white">Correction manuelle (facultative — elle prime sur le texte généré)</label>
                                  <textarea name="editedContent" className="mt-2 min-h-16 w-full rounded-xl border border-white/15 bg-slate-950 p-3 text-xs text-white" placeholder="Laisser vide pour valider le texte généré tel quel." />
                                  <button type="submit" className="mt-3 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950">Valider le brief</button>
                                </form>
                                <form action={requestTeacherBriefCorrectionAction} className="rounded-2xl border border-sky-300/20 bg-sky-300/5 p-4">
                                  <input type="hidden" name="briefId" value={brief.id} />
                                  <label className="block text-xs font-semibold text-white">Section concernée</label>
                                  <input name="section" required className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="ex. : activité du domaine trigonométrie" />
                                  <label className="mt-3 block text-xs font-semibold text-white">Remarque</label>
                                  <textarea name="remark" required minLength={5} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-slate-950 p-3 text-xs text-white" />
                                  <label className="mt-3 block text-xs font-semibold text-white">Motif</label>
                                  <input name="motif" required minLength={5} className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white" />
                                  <button type="submit" className="mt-3 rounded-xl border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-100">Demander une régénération</button>
                                </form>
                              </div>
                            )}
                            {brief.status === 'CORRECTION_REQUESTED' && (
                              <form action={generateTeacherBriefAction}>
                                <input type="hidden" name="artifactId" value={revision.reportArtifact.id} />
                                <button type="submit" className="rounded-xl border border-indigo-300 px-4 py-2.5 text-sm font-semibold text-indigo-100">
                                  Régénérer le brief (nouvelle version, historique conservé)
                                </button>
                              </form>
                            )}
                          </div>
                        )}
                      </section>
                    );
                  })()}

                  {revision.reviews.some((review) => review.annotations.length > 0 || review.decision === 'CHANGES_REQUESTED') && (
                    <details className="border-t border-white/10 px-6 py-5">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-300">
                        Historique des annotations de revue
                      </summary>
                      <ol className="mt-4 space-y-4">
                        {revision.reviews
                          .filter((review) => review.decision === 'CHANGES_REQUESTED' || review.annotations.length > 0)
                          .map((review) => (
                            <li key={review.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
                              <p className="font-semibold text-white">
                                {review.reviewer ? `${review.reviewer.firstName ?? ''} ${review.reviewer.lastName ?? ''}`.trim() || 'Assistante' : 'Assistante'}
                                <span className="ml-2 font-normal text-slate-400">{dateLabel(review.reviewedAt)}</span>
                              </p>
                              <p className="mt-1 text-slate-300">{review.motif}</p>
                              {review.annotations.length > 0 && (
                                <ul className="mt-3 space-y-2">
                                  {review.annotations.map((annotation, index) => (
                                    <li key={`${review.id}-${index}`} className="rounded-xl border border-sky-300/20 bg-sky-300/5 p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-sky-200">
                                        {annotation.audience === 'ELEVE' ? 'Bilan élève' : annotation.audience === 'PARENTS' ? 'Bilan parents' : 'Document interne'} · {ANNOTATION_SECTION_LABELS[annotation.section] ?? annotation.section}
                                      </p>
                                      <p className="mt-1 text-slate-200">{annotation.remark}</p>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                      </ol>
                    </details>
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
