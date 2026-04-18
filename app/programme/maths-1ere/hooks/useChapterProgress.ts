'use client';

import { useEffect, useRef } from 'react';
import { useMathsLabStore } from '../store';

export function useChapterProgress(chapId: string, pointsXP: number) {
  const store = useMathsLabStore();
  const timeRef = useRef<number>(Date.now());

  useEffect(() => {
    timeRef.current = Date.now();
    
    return () => {
      const elapsed = Math.round((Date.now() - timeRef.current) / 1000);
      if (elapsed > 10) store.addChapterTime(chapId, elapsed);
    };
  }, [chapId, store]);

  const recordDiagnostic = (score: number, total: number) => {
    store.recordDiagnostic(chapId, score, total);
  };

  const recordExerciseResult = (targetChapId: string, score: number) => {
    store.recordExerciseResult(targetChapId, score);
  };

  const recordHintUsage = (level: number) => {
    // Malus mapping logic
    // level 1: -10%, level 2: -30%, level 3: -100%
    store.recordExerciseWithHint(chapId, -1, level, pointsXP);
  };

  const recordSRSReview = (quality: number) => {
    store.recordSRSReview(chapId, quality);
  };

  const toggleChapterComplete = () => {
    store.toggleChapterComplete(chapId);
  };

  const markPrinted = () => {
    store.markPrintedFiche();
    store.earnBadge('imprimeur');
  };

  return {
    recordDiagnostic,
    recordExerciseResult,
    recordHintUsage,
    recordSRSReview,
    toggleChapterComplete,
    markPrinted,
    isCompleted: store.completedChapters.includes(chapId)
  };
}
