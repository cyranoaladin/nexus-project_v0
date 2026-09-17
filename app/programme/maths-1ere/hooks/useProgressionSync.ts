'use client';

import { useCallback,useEffect,useRef,useState } from 'react';
import { useProtectedFetch, useSessionRecoveryController, useSessionRecoveryState } from '@/components/auth/SessionRecoveryProvider';
import { bindPersistedStoreOwner, isPersistedStoreOwner } from '@/lib/auth/session-owned-store';
import { type MathsLabState,useMathsLabStore } from '../store';

const PROGRESS_API_ROUTE = '/api/programme/maths-1ere/progress';

// Progress payload matching API contract (Prisma source of truth)
interface ProgressPayload {
  completed_chapters: string[];
  mastered_chapters: string[];
  total_xp: number;
  quiz_score: number;
  combo_count: number;
  best_combo: number;
  streak: number;
  streak_freezes: number;
  last_activity_date: string | null;
  daily_challenge: MathsLabState['dailyChallenge'];
  exercise_results: MathsLabState['exerciseResults'];
  hint_usage: MathsLabState['hintUsage'];
  badges: string[];
  srs_queue: MathsLabState['srsQueue'];
  diagnostic_results?: MathsLabState['diagnosticResults'];
  time_per_chapter?: MathsLabState['timePerChapter'];
  formulaire_viewed?: boolean;
  grand_oral_seen?: number;
  lab_archimede_opened?: boolean;
  euler_max_steps?: number;
  newton_best_iterations?: number | null;
  printed_fiche?: boolean;
}

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

// Load progress from API route (Prisma source of truth)
async function loadProgressFromApi(fetch: typeof globalThis.fetch): Promise<
  | { status: 'ok'; data: ProgressPayload | null }
  | { status: 'error'; data: null; error: string }
> {
  try {
    const response = await fetch(PROGRESS_API_ROUTE, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { status: 'error', data: null, error: 'Authentication required' };
      }
      return { status: 'error', data: null, error: `HTTP ${response.status}` };
    }

    const result = await response.json();
    if (result.ok && result.data) {
      return { status: 'ok', data: result.data as ProgressPayload };
    }
    return { status: 'ok', data: null };
  } catch (error) {
    return { status: 'error', data: null, error: String(error) };
  }
}

function toProgressPayload(state: MathsLabState): ProgressPayload {
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

async function saveProgressViaApi(fetch: typeof globalThis.fetch, payload: ProgressPayload, keepalive = false): Promise<boolean> {
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

export function useProgressionSync(userId: string) {
  const fetch = useProtectedFetch();
  const recovery = useSessionRecoveryController();
  const { canMutate } = useSessionRecoveryState();
  const [isHydrating, setIsHydrating] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedOwner = useRef<string | null>(null);
  const pendingSave = useRef<(() => void) | null>(null);

  const flushPayload = useCallback(
    async (payload: ProgressPayload, critical = false): Promise<boolean> => {
      const state = useMathsLabStore.getState();
      if (!isPersistedStoreOwner(useMathsLabStore, userId) || !state.isHydrated || !state.canWriteRemote) {
        return false;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncError('Mode hors ligne : votre progression locale est conservée, mais non sauvegardée sur le serveur.');
        return false;
      }

      const viaApi = await saveProgressViaApi(fetch, payload, critical);
      if (viaApi) {
        setSyncError(null);
        return true;
      }

      // API route is the only canonical persistence layer
      // localStorage (Zustand persist) remains as local cache only
      setSyncError('Sauvegarde indisponible. Votre progression locale est conservée.');
      return false;
    },
    [fetch, userId]
  );

  // Initial Hydration
  useEffect(() => {
    if (!canMutate || hydratedOwner.current === userId) return;
    let active = true;
    let check: () => void;
    try { check = recovery.captureMutation(); } catch { return; }
    const TIMEOUT_MARKER = '__HYDRATION_TIMEOUT__';

    async function hydrate() {
      try {
        setIsHydrating(true);
        await bindPersistedStoreOwner(useMathsLabStore, userId);
        if (!active) return;
        check();
        useMathsLabStore.getState().setHydrationStatus({
          isHydrated: false,
          canWriteRemote: false,
          hydrationError: null,
        });

        const remoteResult = await withTimeout(
          loadProgressFromApi(fetch),
          2500,
          { status: 'error', data: null, error: TIMEOUT_MARKER } as const
        );

        if (!active) return;
        check();

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
            dailyChallenge: remote.daily_challenge ?? state.dailyChallenge,
            exerciseResults: remote.exercise_results ?? state.exerciseResults,
            hintUsage: remote.hint_usage ?? state.hintUsage,
            badges: remote.badges ?? state.badges,
            srsQueue: remote.srs_queue ?? state.srsQueue,
            diagnosticResults: remote.diagnostic_results ?? state.diagnosticResults,
            timePerChapter: remote.time_per_chapter ?? state.timePerChapter,
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
        hydratedOwner.current = userId;
        useMathsLabStore.getState().recordActivity();
        useMathsLabStore.getState().evaluateBadges();
      } catch {
        if (active && isPersistedStoreOwner(useMathsLabStore, userId)) {
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
  }, [userId, canMutate, fetch, recovery]);

  // Sync Logic
  useEffect(() => {
    const unsub = useMathsLabStore.subscribe((state, prevState) => {
      if (!isPersistedStoreOwner(useMathsLabStore, userId) || !state.isHydrated || !state.canWriteRemote) return;

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
      const save = recovery.bindDeferredMutation(() => {
        pendingSave.current = null;
        const payload = toProgressPayload(state);
        void flushPayload(payload);
      });
      pendingSave.current = save;
      syncTimerRef.current = setTimeout(save, 800);
    });

    return () => {
      unsub();
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      pendingSave.current = null;
    };
  }, [flushPayload, userId, recovery]);

  // Flush on exit
  useEffect(() => {
    const flushOnExit = () => {
      // Only an already-authorized pending operation may run. Never create a
      // new beacon or replay an invalidated draft when the document exits.
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      pendingSave.current?.();
      pendingSave.current = null;
    };

    window.addEventListener('beforeunload', flushOnExit);
    return () => window.removeEventListener('beforeunload', flushOnExit);
  }, []);

  return { isHydrating, syncError };
}
