'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { QCM_BANK } from '@/lib/survival/qcm-bank';
import type { QcmChoiceLetter, QcmQuestion } from '@/lib/survival/types';

type TrainerMode = 'HELP' | 'EXAM' | 'ERRORS';

const MODE_LABELS: Record<TrainerMode, string> = {
  HELP: 'Avec aide',
  EXAM: 'Comme à l’épreuve',
  ERRORS: 'Mes erreurs',
};

function selectQuestions(mode: TrainerMode, errorIds: string[]): QcmQuestion[] {
  if (mode === 'HELP') return QCM_BANK.filter((question) => question.category !== 'ROUGE').slice(0, 8);
  if (mode === 'ERRORS') return QCM_BANK.filter((question) => errorIds.includes(question.id));
  return QCM_BANK;
}

export function QcmTrainerWorkspace() {
  const [mode, setMode] = useState<TrainerMode>('HELP');
  const [current, setCurrent] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [errorIds, setErrorIds] = useState<string[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(90);
  const questions = useMemo(() => selectQuestions(mode, errorIds), [mode, errorIds]);
  const question = questions[current];

  useEffect(() => {
    setCurrent(0);
    setFeedback(null);
    setShowHint(false);
    setSecondsLeft(90);
  }, [mode]);

  const persistAttempt = useCallback(async (item: QcmQuestion, givenAnswer: string) => {
    await fetch('/api/student/survival/qcm/attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: item.id,
        givenAnswer,
        timeSpentSec: mode === 'EXAM' ? 90 - secondsLeft : 30,
      }),
    }).catch(() => undefined);
  }, [mode, secondsLeft]);

  const answerQuestion = useCallback((choice: QcmChoiceLetter | 'TIMEOUT') => {
    if (!question || feedback) return;
    const correct = choice === question.correctAnswer;
    if (!correct) {
      setErrorIds((currentIds) => currentIds.includes(question.id) ? currentIds : [...currentIds, question.id]);
    }
    setFeedback({
      correct,
      text: correct
        ? 'Réponse juste. Ce geste rapporte.'
        : question.pedagogicalHint ?? question.exclusionTip ?? 'On reprend cette question calmement.',
    });
    void persistAttempt(question, choice);
  }, [feedback, persistAttempt, question]);

  useEffect(() => {
    if (mode !== 'EXAM' || !question || feedback) return undefined;
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          answerQuestion('TIMEOUT');
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [answerQuestion, feedback, mode, question]);

  function goNext() {
    setCurrent((value) => value + 1);
    setFeedback(null);
    setShowHint(false);
    setSecondsLeft(90);
  }

  if (!question) {
    return (
      <div className="rounded-lg border border-eaf-teal/30 bg-eaf-teal/10 p-4 text-sm text-eaf-text-primary">
        Série terminée. Les réponses données sont enregistrées.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-eaf-indigo/20 bg-eaf-hero-gradient p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MODE_LABELS) as TrainerMode[]).map((item) => (
            <Button
              key={item}
              type="button"
              variant={mode === item ? 'default' : 'outline'}
              className={mode === item ? 'min-h-10 bg-eaf-orange text-eaf-text-primary' : 'min-h-10 border-eaf-indigo/30 text-eaf-text-secondary'}
              onClick={() => setMode(item)}
            >
              {MODE_LABELS[item]}
            </Button>
          ))}
        </div>
        <span className="rounded-full border border-eaf-amber/30 bg-eaf-amber/10 px-3 py-1 text-xs text-eaf-amber">
          {question.category}
        </span>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-eaf-text-secondary">QCM {current + 1} / {questions.length}</p>
        {mode === 'EXAM' && <p className="text-sm text-eaf-text-secondary">90 s : {secondsLeft}s</p>}
      </div>

      <p className="text-base font-semibold text-eaf-text-primary">{question.enonce}</p>
      {question.graphicAsset && (
        <img
          src={`/${question.graphicAsset}`}
          alt=""
          className="mt-4 w-full rounded-lg border border-eaf-indigo/20 bg-eaf-indigo/10"
        />
      )}

      {mode === 'HELP' && (
        <div className="mt-4 rounded-lg border border-eaf-indigo/30 bg-eaf-indigo/10 p-3 text-sm text-eaf-text-secondary">
          <p className="font-fraunces font-semibold text-eaf-text-primary">Repères autorisés</p>
          <p className="mt-1">+10 % → × 1,10 · -10 % → × 0,90 · ax = 0 → x = 0</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-10 border-eaf-indigo/30 text-eaf-orange"
            onClick={() => setShowHint((value) => !value)}
          >
            Voir l’indice
          </Button>
          {showHint && <p className="mt-2 text-eaf-amber">{question.pedagogicalHint ?? question.exclusionTip ?? 'Regarde d’abord les réponses impossibles.'}</p>}
        </div>
      )}

      <div className="mt-4 grid gap-2">
        {question.choices.map((choice) => (
          <Button
            key={choice.letter}
            type="button"
            variant="outline"
            className="min-h-11 justify-start border-eaf-indigo/30 text-left text-eaf-text-secondary"
            onClick={() => answerQuestion(choice.letter)}
            disabled={Boolean(feedback)}
          >
            {choice.letter}. {choice.text}
          </Button>
        ))}
      </div>

      {feedback && (
        <div className={`mt-4 rounded-lg border p-3 text-sm ${feedback.correct ? 'border-eaf-teal/30 bg-eaf-teal/10 text-eaf-teal' : 'border-eaf-amber/30 bg-eaf-amber/10 text-eaf-amber'}`}>
          {feedback.correct ? '✓ ' : '⏳ '}
          {feedback.text}
          <div className="mt-3">
            <Button type="button" className="min-h-10 bg-eaf-orange text-eaf-text-primary" onClick={goNext}>
              Question suivante
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
