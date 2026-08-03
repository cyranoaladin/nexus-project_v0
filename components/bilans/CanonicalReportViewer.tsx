'use client';

import { useEffect, useState } from 'react';

import { canonicalReportUrl, loadCanonicalReportStatus } from '@/lib/bilans/passation/pilot-protocol';

function waitingMessage(status: string | null): string {
  if (status === 'REPORT_PENDING_REVIEW' || status === 'COACH_VALIDATED') return 'Le bilan est en cours de relecture pédagogique.';
  if (status === 'SUBMITTED' || status === 'SCORED') return 'Les réponses ont été reçues. Le bilan est en préparation.';
  return 'Le bilan n’est pas encore disponible.';
}

export function CanonicalReportViewer({ attemptId }: Readonly<{ attemptId: string }>) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const current = await loadCanonicalReportStatus(attemptId);
        if (!active) return;
        setStatus(current.status);
        if (current.status !== 'PUBLISHED') timer = setTimeout(() => void poll(), 5_000);
      } catch {
        if (active) setError(true);
      }
    };
    void poll();
    return () => { active = false; if (timer !== undefined) clearTimeout(timer); };
  }, [attemptId]);

  if (error) return <p role="alert" className="mx-auto mt-12 max-w-xl rounded-2xl bg-red-50 p-5 text-red-900">Ce bilan n’est pas accessible avec ce compte.</p>;
  if (status !== 'PUBLISHED') {
    return <p role="status" className="mx-auto mt-12 max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">{waitingMessage(status)}</p>;
  }
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto flex max-w-6xl justify-end pb-4">
        <a href={canonicalReportUrl(attemptId, 'pdf')} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-950 px-4 py-2.5 font-semibold text-white">Ouvrir le PDF</a>
      </div>
      <iframe title="Bilan Nexus publié" src={canonicalReportUrl(attemptId, 'html')} className="mx-auto min-h-[85vh] w-full max-w-6xl rounded-2xl border border-slate-200 bg-white" />
    </main>
  );
}
