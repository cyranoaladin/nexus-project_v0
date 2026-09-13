'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useCanonicalSession as useSession, useSessionRecoveryController, useSessionRecoveryState } from '@/components/auth/SessionRecoveryProvider';
import type { NsiProgress, SubjectProgress, PatternProgress, FlashcardProgress, SelfAssessmentProgress, MockExamResult, OralFourPhrases, FiveDayTaskProgress } from '@/data/nsi-pratique-2026/types';
import { createProgressStorage } from '@/lib/nsi-pratique-2026/progress-storage';
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
  const { data: session, status: authStatus } = useSession();
  const recovery = useSessionRecoveryController();
  const { canMutate } = useSessionRecoveryState();
  const hydratedOwner = useRef<string | null>(null);
  const owner = session?.user?.email ?? session?.user?.id ?? null;
  const storage = useMemo(() => createProgressStorage(owner), [owner]);
  const { loadProgress, saveProgress, updateSubjectProgress, updatePatternProgress, updateFlashcardProgress,
    updateFiveDayTask, updateSelfAssessment, addMockExamResult, updateOralPhrases, resetProgress } = storage;
  const [progress, setProgress] = useState<NsiProgress | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTicketRef = useRef<(() => void) | null>(null);
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
      const stillCurrent = recovery.captureMutation();
      const res = await fetch('/api/eleve/nsi-pratique-2026/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Server PUT failed: ${res.status}`);
      const result = await res.json();
      stillCurrent();
      setSyncStatus('synced');
      setLastSyncedAt(result.updatedAt);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setSyncStatus('error');
    }
  }, [recovery]);

  // --- Debounced server sync ---
  const debouncedServerSave = useCallback((data: NsiProgress) => {
    if (authStatus === 'unauthenticated' && !canSyncServerRef.current) return;
    let stillCurrent: () => void;
    try { stillCurrent = recovery.captureMutation(); } catch { setSyncStatus('error'); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pendingTicketRef.current = stillCurrent;
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      pendingTicketRef.current = null;
      dirtyRef.current = false;
      try { stillCurrent(); } catch { setSyncStatus('error'); return; }
      void saveToServer(data);
    }, DEBOUNCE_MS);
  }, [authStatus, saveToServer, recovery]);

  useEffect(() => {
    if (!progress || !dirtyRef.current) return;
    debouncedServerSave(progress);
  }, [progress, debouncedServerSave]);

  // --- Initial load: localStorage + server hydration ---
  useEffect(() => {
    // Navigation verifies the new route after child effects. Retry that initial
    // hydration when verification completes, without reloading an existing draft.
    if (!canMutate || !owner || hydratedOwner.current === owner) return;
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
    let cancelled = false;
    let stillCurrent: () => void;
    try { stillCurrent = recovery.captureMutation(); } catch { setSyncStatus('error'); return; }

    // Fetch server data and merge with local
    fetchServerProgress()
      .then(({ data: serverData, updatedAt }) => {
        if (cancelled) return;
        stillCurrent();
        const latestLocalData = loadProgress();
        hydratedOwner.current = owner;
        if (serverData) {
          const serverProgress = serverData as NsiProgress;
          const localHasData = hasMeaningfulProgress(latestLocalData);

          if (localHasData) {
            // Both have data — merge intelligently (no silent data loss)
            const merged = mergeNsiProgress(latestLocalData, serverProgress);
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
          if (hasMeaningfulProgress(latestLocalData)) {
            saveToServer(latestLocalData);
          } else {
            setSyncStatus('synced');
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Network error — keep localStorage, mark error, don't lose data
        setSyncStatus('error');
      });
    return () => { cancelled = true; };
  }, [authStatus, loadProgress, saveProgress, fetchServerProgress, saveToServer, recovery, canMutate, owner]);

  // Flush pending save on tab close/navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (debounceRef.current && progress && authStatus === 'authenticated') {
        try { if (!pendingTicketRef.current) return; pendingTicketRef.current(); } catch { return; }
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        pendingTicketRef.current = null;
        void fetch('/api/eleve/nsi-pratique-2026/progress', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: progress }),
          keepalive: true,
        }).catch(() => { /* The owner-scoped local draft remains recoverable. */ });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [progress, authStatus, recovery]);

  // --- Wrapper: update localStorage + trigger server sync ---
  const withSync = useCallback((updatedProgress: NsiProgress) => {
    dirtyRef.current = true;
    setProgress({ ...updatedProgress });
  }, []);

  const setSubjectProgress = useCallback((subjectId: number, update: Partial<SubjectProgress>) => {
    withSync(updateSubjectProgress(subjectId, update));
  }, [withSync, updateSubjectProgress]);

  const setPatternProgress = useCallback((patternId: number, update: Partial<PatternProgress>) => {
    withSync(updatePatternProgress(patternId, update));
  }, [withSync, updatePatternProgress]);

  const setFlashcardProgress = useCallback((cardId: string, update: Partial<FlashcardProgress>) => {
    withSync(updateFlashcardProgress(cardId, update));
  }, [withSync, updateFlashcardProgress]);

  const setFiveDayTask = useCallback((taskKey: string, update: Partial<FiveDayTaskProgress>) => {
    withSync(updateFiveDayTask(taskKey, update));
  }, [withSync, updateFiveDayTask]);

  const setSelfAssessment = useCallback((itemId: string, update: Partial<SelfAssessmentProgress>) => {
    withSync(updateSelfAssessment(itemId, update));
  }, [withSync, updateSelfAssessment]);

  const addMockExam = useCallback((result: MockExamResult) => {
    withSync(addMockExamResult(result));
  }, [withSync, addMockExamResult]);

  const setOralPhrases = useCallback((subjectId: number, update: Partial<OralFourPhrases>) => {
    withSync(updateOralPhrases(subjectId, update));
  }, [withSync, updateOralPhrases]);

  const reset = useCallback(() => {
    const updated = resetProgress();
    setProgress({ ...updated });
    if (authStatus === 'authenticated') {
      saveToServer(updated);
    }
  }, [authStatus, saveToServer, resetProgress]);

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
