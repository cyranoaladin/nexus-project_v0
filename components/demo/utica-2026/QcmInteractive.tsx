'use client';

/**
 * Interaction réelle locale (P3 §12) : choix, validation, correction —
 * état React local uniquement, aucune API, aucune sauvegarde. Le reset
 * UTICA (rechargement complet de la page) remet l'état à zéro.
 */
import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { ResourceQcmQuestion } from '@/lib/demo/utica-2026/resources';

export function QcmInteractive({ questions }: { questions: ResourceQcmQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-5">
      {questions.map((q, index) => {
        const selected = answers[q.id];
        const isRevealed = revealed[q.id];
        const isCorrect = selected === q.correctIndex;
        return (
          <fieldset key={q.id} className="rounded-xl border border-white/10 bg-surface-darker/40 p-4">
            <legend className="px-1 text-sm font-medium text-neutral-200">
              {index + 1}. {q.question}
            </legend>
            <div className="mt-3 space-y-2">
              {q.options.map((option, optionIndex) => {
                const isSelected = selected === optionIndex;
                return (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      isSelected ? 'border-brand-primary/50 bg-brand-primary/10 text-neutral-100' : 'border-white/10 text-neutral-300 hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      className="h-3.5 w-3.5 accent-brand-primary"
                      checked={isSelected}
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: optionIndex }))}
                    />
                    {option}
                  </label>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                disabled={selected === undefined}
                onClick={() => setRevealed((prev) => ({ ...prev, [q.id]: true }))}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary/90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Valider
              </button>
              {isRevealed && (
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isCorrect ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                  {isCorrect ? 'Correct' : 'Pas tout à fait'}
                </span>
              )}
            </div>
            {isRevealed && <p className="mt-2 text-xs text-neutral-400">{q.explanation}</p>}
          </fieldset>
        );
      })}
    </div>
  );
}
