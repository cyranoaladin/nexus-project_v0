'use client';

import { useState, useEffect, useCallback } from 'react';
import type { NsiProgress, SubjectProgress, PatternProgress, FlashcardProgress, SelfAssessmentProgress, MockExamResult, OralFourPhrases, FiveDayTaskProgress } from '@/data/nsi-pratique-2026/types';
import {
  loadProgress,
  updateSubjectProgress,
  updatePatternProgress,
  updateFlashcardProgress,
  updateFiveDayTask,
  updateSelfAssessment,
  addMockExamResult,
  updateOralPhrases,
  resetProgress,
} from '@/lib/nsi-pratique-2026/progress-storage';
import { computeStats, getRecommendedNextAction } from '@/lib/nsi-pratique-2026/recommendations';

export function useNsiProgress() {
  const [progress, setProgress] = useState<NsiProgress | null>(null);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  const setSubjectProgress = useCallback((subjectId: number, update: Partial<SubjectProgress>) => {
    const updated = updateSubjectProgress(subjectId, update);
    setProgress({ ...updated });
  }, []);

  const setPatternProgress = useCallback((patternId: number, update: Partial<PatternProgress>) => {
    const updated = updatePatternProgress(patternId, update);
    setProgress({ ...updated });
  }, []);

  const setFlashcardProgress = useCallback((cardId: string, update: Partial<FlashcardProgress>) => {
    const updated = updateFlashcardProgress(cardId, update);
    setProgress({ ...updated });
  }, []);

  const setFiveDayTask = useCallback((taskKey: string, update: Partial<FiveDayTaskProgress>) => {
    const updated = updateFiveDayTask(taskKey, update);
    setProgress({ ...updated });
  }, []);

  const setSelfAssessment = useCallback((itemId: string, update: Partial<SelfAssessmentProgress>) => {
    const updated = updateSelfAssessment(itemId, update);
    setProgress({ ...updated });
  }, []);

  const addMockExam = useCallback((result: MockExamResult) => {
    const updated = addMockExamResult(result);
    setProgress({ ...updated });
  }, []);

  const setOralPhrases = useCallback((subjectId: number, update: Partial<OralFourPhrases>) => {
    const updated = updateOralPhrases(subjectId, update);
    setProgress({ ...updated });
  }, []);

  const reset = useCallback(() => {
    const updated = resetProgress();
    setProgress({ ...updated });
  }, []);

  const stats = progress ? computeStats(progress) : null;
  const recommendation = progress ? getRecommendedNextAction(progress) : null;

  return {
    progress,
    stats,
    recommendation,
    setSubjectProgress,
    setPatternProgress,
    setFlashcardProgress,
    setFiveDayTask,
    setSelfAssessment,
    addMockExam,
    setOralPhrases,
    reset,
  };
}
