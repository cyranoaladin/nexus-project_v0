'use client';

import { useState } from 'react';

export type GroupPlanPickerCandidate = Readonly<{
  id: string;
  assessmentPackId: string;
  status: string;
  displayName: string;
}>;

const MIN_SELECTION = 3;
const MAX_SELECTION = 5;

function validateSelection(
  candidates: readonly GroupPlanPickerCandidate[],
  selected: ReadonlySet<string>,
): string | null {
  const chosen = candidates.filter((candidate) => selected.has(candidate.id));
  if (chosen.length === 0) {
    return 'Sélectionnez entre trois et cinq passations du même pack.';
  }
  const packIds = new Set(chosen.map((candidate) => candidate.assessmentPackId));
  if (packIds.size > 1) {
    return 'Les passations sélectionnées doivent toutes appartenir au même pack.';
  }
  if (chosen.length < MIN_SELECTION || chosen.length > MAX_SELECTION) {
    return `Sélectionnez entre ${MIN_SELECTION} et ${MAX_SELECTION} passations (actuellement ${chosen.length}).`;
  }
  return null;
}

export function CoachGroupPlanPicker({
  candidates,
}: Readonly<{ candidates: readonly GroupPlanPickerCandidate[] }>) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setError(null);
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Deliberately not a native <form method="get">: that would submit
  // whatever checkboxes are checked in the live DOM at click time, which an
  // injected/forged extra checkbox (outside React's tree, so absent from
  // `selected` too) could ride along with -- no amount of comparing
  // `selected` against itself can catch that, since neither side would ever
  // see the forged id. Building the URL directly from validated `selected`
  // state and opening it ourselves means only ids this component actually
  // tracked can ever be sent, regardless of what else exists in the DOM.
  // (The server -- buildStaffGroupPlanDocument -- independently re-validates
  // count, pack homogeneity and per-coach ownership regardless; this is
  // defense in depth on the client, not the security boundary itself.)
  function open(format: 'html' | 'pdf') {
    const problem = validateSelection(candidates, selected);
    if (problem !== null) {
      setError(problem);
      return;
    }
    const params = new URLSearchParams();
    for (const id of selected) params.append('attemptId', id);
    params.set('format', format);
    window.open(`/dashboard/coach/bilans/group-plan?${params.toString()}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="mt-5">
      <div className="grid gap-3 md:grid-cols-2">
        {candidates.map((candidate) => (
          <label key={candidate.id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
            <input
              type="checkbox"
              className="mt-1"
              checked={selected.has(candidate.id)}
              onChange={() => toggle(candidate.id)}
            />
            <span>
              <strong className="block text-white">{candidate.displayName}</strong>
              <span className="text-xs text-slate-400">{candidate.assessmentPackId} · {candidate.status}</span>
            </span>
          </label>
        ))}
      </div>
      {error !== null && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={() => open('html')} className="rounded-xl bg-sky-300 px-4 py-2.5 font-semibold text-slate-950">Ouvrir le plan HTML</button>
        <button type="button" onClick={() => open('pdf')} className="rounded-xl border border-sky-300 px-4 py-2.5 font-semibold text-sky-100">Ouvrir le PDF</button>
      </div>
    </div>
  );
}
