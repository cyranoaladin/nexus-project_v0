'use client';

/**
 * Interaction réelle locale (P3 §12) : énoncé → révéler l'attendu → révéler
 * la correction. État React local uniquement.
 */
import { useState } from 'react';
import type { ResourceGuidedExercise } from '@/lib/demo/utica-2026/resources';

export function GuidedExerciseInteractive({ exercise }: { exercise: ResourceGuidedExercise }) {
  const [step, setStep] = useState<0 | 1 | 2>(0);

  return (
    <div className="rounded-xl border border-white/10 bg-surface-darker/40 p-4">
      <p className="text-sm text-neutral-200">{exercise.enonce}</p>

      {step >= 1 && (
        <p className="mt-3 rounded-lg border border-white/10 bg-surface-card/60 p-3 text-xs text-neutral-400">
          <span className="font-semibold text-neutral-300">Attendu : </span>
          {exercise.attendu}
        </p>
      )}
      {step >= 2 && (
        <p className="mt-2 rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-3 text-xs text-neutral-300">
          <span className="font-semibold text-brand-accent">Correction : </span>
          {exercise.correction}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {step < 1 && (
          <button
            type="button"
            onClick={() => setStep(1)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary/90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-primary"
          >
            Voir l&apos;attendu
          </button>
        )}
        {step >= 1 && step < 2 && (
          <button
            type="button"
            onClick={() => setStep(2)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary/90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-primary"
          >
            Voir la correction
          </button>
        )}
      </div>
    </div>
  );
}
