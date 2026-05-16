'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import type { NsiProgress, SubjectProgress, PatternProgress, FlashcardProgress, SelfAssessmentProgress, MockExamResult, OralFourPhrases, FiveDayTaskProgress } from '@/data/nsi-pratique-2026/types';
import {
  loadProgress,
  saveProgress,
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
import { hasMeaningfulProgress, mergeNsiProgress } from '@/lib/nsi-pratique-2026/progress-merge';

export type SyncStatus = 'idle' | 'synced' | 'saving' | 'error' | 'local-only';

const DEBOUNCE_MS = 1500;

/**
 * Hybrid progress hook: localStorage for instant display + server persistence.
 * - On mount: load localStorage immediately, then fetch server if authenticated.
 * - On update: save localStorage synchronously + debounced PUT to server.
 * - Migration: if server is empty but local has data, auto-upload.
 */
export function useNsiProgress() {
  const { status: authStatus } = useSession();
  const [progress, setProgress] = useState<NsiProgress | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const canSyncServerRef = useRef(false);
  const dirtyRef = useRef(false);

  // --- Server fetch ---
  const fetchServerProgress = useCallback(async (): Promise<{ data: NsiProgress | null; updatedAt: string | null }> => {
    const res = await fetch('/api/eleve/nsi-pratique-2026/progress');
    if (!res.ok) throw new Error(`Server GET failed: ${res.status}`);
    return res.json();
  }, []);

  // --- Server save ---
  const saveToServer = useCallback(async (data: NsiProgress) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSyncStatus('saving');
    try {
      const res = await fetch('/api/eleve/nsi-pratique-2026/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Server PUT failed: ${res.status}`);
      const result = await res.json();
      setSyncStatus('synced');
      setLastSyncedAt(result.updatedAt);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setSyncStatus('error');
    }
  }, []);

  // --- Debounced server sync ---
  const debouncedServerSave = useCallback((data: NsiProgress) => {
    if (authStatus === 'unauthenticated' && !canSyncServerRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      dirtyRef.current = false;
      void saveToServer(data);
    }, DEBOUNCE_MS);
  }, [authStatus, saveToServer]);

  useEffect(() => {
    if (!progress || !dirtyRef.current) return;
    debouncedServerSave(progress);
  }, [progress, debouncedServerSave]);

  // --- Initial load: localStorage + server hydration ---
  useEffect(() => {
    const localData = loadProgress();
    setProgress(localData);

    if (authStatus === 'loading') {
      setSyncStatus('idle');
      return;
    }

    if (authStatus !== 'authenticated') {
      canSyncServerRef.current = false;
      setSyncStatus('local-only');
      return;
    }

    canSyncServerRef.current = true;

    // Fetch server data and merge with local
    fetchServerProgress()
      .then(({ data: serverData, updatedAt }) => {
        if (serverData) {
          const serverProgress = serverData as NsiProgress;
          const localHasData = hasMeaningfulProgress(localData);

          if (localHasData) {
            // Both have data — merge intelligently (no silent data loss)
            const merged = mergeNsiProgress(localData, serverProgress);
            saveProgress(merged);
            setProgress(merged);
            // Push merged result to server if it differs from server
            saveToServer(merged);
          } else {
            // Local empty — use server as-is
            saveProgress(serverProgress);
            setProgress(serverProgress);
            setSyncStatus('synced');
            setLastSyncedAt(updatedAt);
          }
        } else {
          // Server empty — migrate localStorage to server if non-empty
          if (hasMeaningfulProgress(localData)) {
            saveToServer(localData);
          } else {
            setSyncStatus('synced');
          }
        }
      })
      .catch(() => {
        // Network error — keep localStorage, mark error, don't lose data
        setSyncStatus('error');
      });
  }, [authStatus, fetchServerProgress, saveToServer]);

  // Flush pending save on tab close/navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (debounceRef.current && progress && authStatus === 'authenticated') {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        void fetch('/api/eleve/nsi-pratique-2026/progress', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: progress }),
          keepalive: true,
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [progress, authStatus]);

  // --- Wrapper: update localStorage + trigger server sync ---
  const withSync = useCallback((updatedProgress: NsiProgress) => {
    dirtyRef.current = true;
    setProgress({ ...updatedProgress });
  }, []);

  const setSubjectProgress = useCallback((subjectId: number, update: Partial<SubjectProgress>) => {
    withSync(updateSubjectProgress(subjectId, update));
  }, [withSync]);

  const setPatternProgress = useCallback((patternId: number, update: Partial<PatternProgress>) => {
    withSync(updatePatternProgress(patternId, update));
  }, [withSync]);

  const setFlashcardProgress = useCallback((cardId: string, update: Partial<FlashcardProgress>) => {
    withSync(updateFlashcardProgress(cardId, update));
  }, [withSync]);

  const setFiveDayTask = useCallback((taskKey: string, update: Partial<FiveDayTaskProgress>) => {
    withSync(updateFiveDayTask(taskKey, update));
  }, [withSync]);

  const setSelfAssessment = useCallback((itemId: string, update: Partial<SelfAssessmentProgress>) => {
    withSync(updateSelfAssessment(itemId, update));
  }, [withSync]);

  const addMockExam = useCallback((result: MockExamResult) => {
    withSync(addMockExamResult(result));
  }, [withSync]);

  const setOralPhrases = useCallback((subjectId: number, update: Partial<OralFourPhrases>) => {
    withSync(updateOralPhrases(subjectId, update));
  }, [withSync]);

  const reset = useCallback(() => {
    const updated = resetProgress();
    setProgress({ ...updated });
    if (authStatus === 'authenticated') {
      saveToServer(updated);
    }
  }, [authStatus, saveToServer]);

  const stats = progress ? computeStats(progress) : null;
  const recommendation = progress ? getRecommendedNextAction(progress) : null;

  return {
    progress,
    stats,
    recommendation,
    syncStatus,
    lastSyncedAt,
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
