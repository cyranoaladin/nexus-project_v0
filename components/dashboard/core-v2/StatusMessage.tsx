'use client';

import type { ReactNode } from 'react';

/** Inline, screen-reader-announced feedback: errors are assertive alerts, the rest polite status. */
export function StatusMessage({ kind, children }: { kind: 'error' | 'success' | 'info'; children: ReactNode }) {
  const tone =
    kind === 'error'
      ? 'border-red-500/40 bg-red-500/10 text-red-200'
      : kind === 'success'
        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
        : 'border-white/10 bg-white/5 text-neutral-200';
  return (
    <p role={kind === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${tone}`}>
      {children}
    </p>
  );
}
