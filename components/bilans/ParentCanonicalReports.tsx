'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  loadParentCanonicalReports,
  parentCanonicalReportUrl,
  type ParentCanonicalReportSummary,
} from '@/lib/bilans/passation/parent-report-protocol';

const STATUS_LABELS: Readonly<Record<string, string>> = Object.freeze({
  IN_PROGRESS: 'Bilan commencé',
  DRAFT: 'Bilan commencé',
  SUBMITTED: 'Réponses reçues',
  SCORED: 'Restitution en préparation',
  SCORING_FAILED: 'Traitement temporairement indisponible',
  REPORT_PENDING_REVIEW: 'Relecture pédagogique en cours',
  REPORT_GENERATION_FAILED: 'Traitement temporairement indisponible',
  COACH_VALIDATED: 'Relecture pédagogique en cours',
  COACH_REJECTED: 'Bilan indisponible',
  PUBLISHED: 'Bilan publié',
  INVALIDATED: 'Bilan indisponible',
});

function statusLabel(report: ParentCanonicalReportSummary): string {
  if (report.status === 'PUBLISHED' && !report.reportAvailable) return 'Bilan temporairement indisponible';
  return STATUS_LABELS[report.status] ?? 'Bilan en cours de traitement';
}

export function ParentCanonicalReports({
  studentId,
  refreshSignal,
}: Readonly<{ studentId: string; refreshSignal?: unknown }>) {
  const [reports, setReports] = useState<readonly ParentCanonicalReportSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [openAttemptId, setOpenAttemptId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(false);
    try {
      const result = await loadParentCanonicalReports(studentId);
      setReports(result.bilans);
      setOpenAttemptId((current) => result.bilans.some(({ attemptId }) => attemptId === current) ? current : null);
    } catch {
      setReports(null);
      setOpenAttemptId(null);
      setError(true);
    }
  }, [studentId]);

  useEffect(() => {
    void refresh();
    // refreshSignal is an intentional external trigger (e.g. parent-student consent
    // just got verified): bumping it must re-run the fetch even though studentId
    // itself did not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, refreshSignal]);

  return (
    <section aria-labelledby="canonical-parent-reports-title" className="rounded-xl border border-white/10 bg-surface-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="canonical-parent-reports-title" className="text-xl font-bold text-white">Bilans de positionnement</h2>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-neutral-100 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
        >
          Actualiser les bilans
        </button>
      </div>

      {reports === null && !error ? (
        <p role="status" aria-live="polite" className="mt-4 text-sm text-neutral-300">Chargement des bilans…</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">
          Les bilans de cet enfant ne sont pas accessibles avec ce compte.
        </p>
      ) : null}
      {reports?.length === 0 ? (
        <p role="status" aria-live="polite" className="mt-4 text-sm text-neutral-300">
          Aucun bilan de positionnement pour cet enfant.
        </p>
      ) : null}

      {reports !== null && reports.length > 0 ? (
        <div className="mt-5 space-y-4" aria-live="polite">
          {reports.map((report) => {
            const isOpen = openAttemptId === report.attemptId;
            const panelId = `parent-report-${report.attemptId}`;
            return (
              <article key={report.attemptId} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{report.title}</h3>
                    <p className="mt-1 text-sm text-neutral-300">{statusLabel(report)}</p>
                    <p className="mt-1 text-xs text-neutral-400">
                      Mis à jour le {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.updatedAt))}
                    </p>
                  </div>
                  {report.status === 'PUBLISHED' && report.reportAvailable ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => setOpenAttemptId(isOpen ? null : report.attemptId)}
                        className="rounded-lg bg-brand-accent px-3 py-2 text-sm font-semibold text-surface-darker focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      >
                        {isOpen ? `Fermer le bilan ${report.title}` : `Lire le bilan ${report.title}`}
                      </button>
                      <a
                        href={parentCanonicalReportUrl(studentId, report.attemptId, 'pdf')}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-neutral-100 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                      >
                        PDF — compte rendu parents
                      </a>
                      <a
                        href={parentCanonicalReportUrl(studentId, report.attemptId, 'pdf', 'ELEVE')}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-neutral-100 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                      >
                        PDF — bilan remis à votre enfant
                      </a>
                    </div>
                  ) : null}
                </div>
                {isOpen ? (
                  <div id={panelId} className="mt-4">
                    <iframe
                      title={`Bilan Parents publié · ${report.title}`}
                      src={parentCanonicalReportUrl(studentId, report.attemptId, 'html')}
                      className="min-h-[70vh] w-full rounded-xl border border-white/10 bg-white"
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
