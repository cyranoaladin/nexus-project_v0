'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMathsLabStore } from '../store';
import { 
  loadProgressWithStatus, 
  saveProgress, 
  type MathsLabRow 
} from '../lib/supabase';

const PROGRESS_API_ROUTE = '/api/programme/maths-1ere/progress';

type ProgressPayload = Omit<MathsLabRow, 'id' | 'user_id' | 'updated_at'>;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<T>((resolve) => {
      timeoutHandle = setTimeout(() => resolve(fallback), timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

function toProgressPayload(state: any): ProgressPayload {
  return {
    completed_chapters: state.completedChapters,
    mastered_chapters: state.masteredChapters,
    total_xp: state.totalXP,
    quiz_score: state.quizScore,
    combo_count: state.comboCount,
    best_combo: state.bestCombo,
    streak: state.streak,
    streak_freezes: state.streakFreezes,
    last_activity_date: state.lastActivityDate,
    daily_challenge: state.dailyChallenge,
    exercise_results: state.exerciseResults,
    hint_usage: state.hintUsage,
    badges: state.badges,
    srs_queue: state.srsQueue,
    diagnostic_results: state.diagnosticResults,
    time_per_chapter: state.timePerChapter,
    formulaire_viewed: state.formulaireViewed,
    grand_oral_seen: state.grandOralSeen,
    lab_archimede_opened: state.labArchimedeOpened,
    euler_max_steps: state.eulerMaxSteps,
    newton_best_iterations: state.newtonBestIterations ?? null,
    printed_fiche: state.printedFiche,
  };
}

async function saveProgressViaApi(payload: ProgressPayload, keepalive = false): Promise<boolean> {
  try {
    const response = await fetch(PROGRESS_API_ROUTE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
      keepalive,
    });
    return response.ok;
  } catch {
    return false;
  }
}

function saveProgressWithBeacon(payload: ProgressPayload): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false;
  }
  const body = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  return navigator.sendBeacon(PROGRESS_API_ROUTE, body);
}

export function useProgressionSync(userId: string) {
  const [isHydrating, setIsHydrating] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPayloadRef = useRef<ProgressPayload | null>(null);

  const flushPayload = useCallback(
    async (payload: ProgressPayload, critical = false): Promise<boolean> => {
      const state = useMathsLabStore.getState();
      if (!state.isHydrated || !state.canWriteRemote) {
        return false;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        pendingPayloadRef.current = payload;
        setSyncError('Mode hors ligne: progression en attente de synchronisation.');
        return false;
      }

      const viaApi = await saveProgressViaApi(payload, critical);
      if (viaApi) {
        pendingPayloadRef.current = null;
        setSyncError(null);
        return true;
      }

      const viaSupabase = await saveProgress(userId, payload);
      if (viaSupabase) {
        pendingPayloadRef.current = null;
        setSyncError(null);
        return true;
      }

      pendingPayloadRef.current = payload;
      setSyncError('Échec de sauvegarde. La progression sera réessayée automatiquement.');
      return false;
    },
    [userId]
  );

  // Initial Hydration
  useEffect(() => {
    let active = true;
    const TIMEOUT_MARKER = '__HYDRATION_TIMEOUT__';

    async function hydrate() {
      try {
        useMathsLabStore.getState().setHydrationStatus({
          isHydrated: false,
          canWriteRemote: false,
          hydrationError: null,
        });

        const remoteResult = await withTimeout(
          loadProgressWithStatus(userId),
          2500,
          { status: 'error', data: null, error: TIMEOUT_MARKER } as const
        );

        if (!active) return;

        if (remoteResult.status === 'error') {
          useMathsLabStore.getState().setHydrationStatus({
            isHydrated: false,
            canWriteRemote: false,
            hydrationError: 'Impossible de récupérer votre profil. Réessayez.',
          });
          return;
        }

        const remote = remoteResult.data;
        if (remote) {
          useMathsLabStore.setState((state) => ({
            ...state,
            completedChapters: remote.completed_chapters ?? state.completedChapters,
            masteredChapters: remote.mastered_chapters ?? state.masteredChapters,
            totalXP: remote.total_xp ?? state.totalXP,
            quizScore: remote.quiz_score ?? state.quizScore,
            comboCount: remote.combo_count ?? state.comboCount,
            bestCombo: remote.best_combo ?? state.bestCombo,
            streak: remote.streak ?? state.streak,
            streakFreezes: remote.streak_freezes ?? state.streakFreezes,
            lastActivityDate: remote.last_activity_date ?? state.lastActivityDate,
            dailyChallenge: remote.daily_challenge as any ?? state.dailyChallenge,
            exerciseResults: remote.exercise_results as any ?? state.exerciseResults,
            hintUsage: remote.hint_usage as any ?? state.hintUsage,
            badges: remote.badges ?? state.badges,
            srsQueue: remote.srs_queue as any ?? state.srsQueue,
            diagnosticResults: remote.diagnostic_results as any ?? state.diagnosticResults,
            timePerChapter: remote.time_per_chapter as any ?? state.timePerChapter,
            formulaireViewed: remote.formulaire_viewed ?? state.formulaireViewed,
            grandOralSeen: remote.grand_oral_seen ?? state.grandOralSeen,
            labArchimedeOpened: remote.lab_archimede_opened ?? state.labArchimedeOpened,
            eulerMaxSteps: remote.euler_max_steps ?? state.eulerMaxSteps,
            newtonBestIterations: remote.newton_best_iterations ?? state.newtonBestIterations,
            printedFiche: remote.printed_fiche ?? state.printedFiche,
          }));

          for (const chapId of remote.completed_chapters ?? []) {
            useMathsLabStore.getState().unlockChapter(chapId);
          }
        }

        useMathsLabStore.getState().setHydrationStatus({
          isHydrated: true,
          canWriteRemote: true,
          hydrationError: null,
        });
        useMathsLabStore.getState().recordActivity();
        useMathsLabStore.getState().evaluateBadges();
      } catch {
        if (active) {
          useMathsLabStore.getState().setHydrationStatus({
            isHydrated: false,
            canWriteRemote: false,
            hydrationError: 'Erreur lors de la synchronisation.',
          });
        }
      } finally {
        if (active) setIsHydrating(false);
      }
    }

    hydrate();
    return () => { active = false; };
  }, [userId]);

  // Sync Logic
  useEffect(() => {
    const unsub = useMathsLabStore.subscribe((state, prevState) => {
      if (!state.isHydrated || !state.canWriteRemote) return;

      // Deep compare relevant fields or just trigger on any relevant change
      const changed = 
        state.totalXP !== prevState.totalXP ||
        state.completedChapters !== prevState.completedChapters ||
        state.masteredChapters !== prevState.masteredChapters ||
        state.badges !== prevState.badges ||
        state.exerciseResults !== prevState.exerciseResults ||
        state.streak !== prevState.streak;

      if (!changed) return;

      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        const payload = toProgressPayload(state);
        pendingPayloadRef.current = payload;
        void flushPayload(payload);
      }, 800);
    });

    return () => {
      unsub();
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [flushPayload]);

  // Flush on exit
  useEffect(() => {
    const flushOnExit = () => {
      const state = useMathsLabStore.getState();
      if (!state.isHydrated || !state.canWriteRemote) return;
      const payload = toProgressPayload(state);
      saveProgressWithBeacon(payload);
    };

    window.addEventListener('beforeunload', flushOnExit);
    return () => window.removeEventListener('beforeunload', flushOnExit);
  }, []);

  return { isHydrating, syncError };
}
