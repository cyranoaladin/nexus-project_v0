'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { SurvivalReflex } from '@/lib/survival/types';
import { ReflexLesson } from './ReflexLesson';

type ReflexPracticeWorkspaceProps = {
  reflex: SurvivalReflex;
};

export function ReflexPracticeWorkspace({ reflex }: ReflexPracticeWorkspaceProps) {
  const [answered, setAnswered] = useState<Record<string, boolean>>({});

  async function markAttempt(itemId: string, answer: string) {
    setAnswered((current) => ({ ...current, [itemId]: true }));
    await fetch(`/api/student/survival/reflexes/${reflex.id}/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId,
        givenAnswer: answer,
        correctAnswer: answer,
        isCorrect: true,
        timeSpentSec: 20,
      }),
    }).catch(() => undefined);
  }

  return (
    <div className="space-y-4">
      <ReflexLesson reflex={reflex} />
      <div className="space-y-3">
        {reflex.miniQuiz.map((quiz) => (
          <div key={quiz.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">{quiz.prompt}</p>
            <p className="mt-2 text-sm text-neutral-300">{quiz.explanation}</p>
            <Button
              type="button"
              className="mt-3 min-h-11 bg-brand-accent text-white"
              onClick={() => markAttempt(quiz.id, quiz.answer)}
              disabled={answered[quiz.id]}
            >
              {answered[quiz.id] ? 'Enregistre' : 'Je retiens cette reponse'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
