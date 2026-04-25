'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { QCM_BANK } from '@/lib/survival/qcm-bank';

export function QcmTrainerWorkspace() {
  const questions = useMemo(() => QCM_BANK.slice(0, 6), []);
  const [current, setCurrent] = useState(0);
  const question = questions[current];

  if (!question) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-white">
        Serie terminee. Tu as rempli les questions, c'est la regle d'or.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-surface-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-neutral-300">QCM {current + 1} / {questions.length}</p>
        <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs text-warning">
          {question.category}
        </span>
      </div>
      <p className="text-base font-semibold text-white">{question.enonce}</p>
      <div className="mt-4 grid gap-2">
        {question.choices.map((choice) => (
          <Button
            key={choice.letter}
            type="button"
            variant="outline"
            className="min-h-11 justify-start border-white/10 text-left text-neutral-200"
            onClick={() => setCurrent((value) => value + 1)}
          >
            {choice.letter}. {choice.text}
          </Button>
        ))}
      </div>
      {question.pedagogicalHint && <p className="mt-3 text-sm text-neutral-400">{question.pedagogicalHint}</p>}
    </div>
  );
}
