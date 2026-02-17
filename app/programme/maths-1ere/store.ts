'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  getNiveau,
  getNextNiveau,
  programmeData,
  badgeDefinitions,
  type NiveauEleve,
} from './data';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DailyChallengeState {
  /** ISO date string of last completed daily challenge */
  lastCompletedDate: string | null;
  /** ID of today's challenge (deterministic from date) */
  todayChallengeId: string | null;
  /** Whether today's challenge was completed */
  completedToday: boolean;
}

/** Hint level used: 0=none, 1=indice(-10%), 2=début(-30%), 3=correction(-100%) */
type HintLevel = 0 | 1 | 2 | 3;

/** XP malus multipliers per hint level (CdC §3.2) */
const HINT_MALUS: Record<HintLevel, number> = {
  0: 1.0,
  1: 0.9,   // -10% XP
  2: 0.7,   // -30% XP
  3: 0.0,   // -100% XP (solution complète = 0 XP)
};

interface MathsLabState {
  // ─── Progression ────────────────────────────────────────────────────────
  /** IDs of completed chapters */
  completedChapters: string[];
  /** IDs of chapters where all exercises were completed */
  masteredChapters: string[];

  // ─── XP & Gamification ──────────────────────────────────────────────────
  totalXP: number;
  quizScore: number;

  // ─── Combo System ─────────────────────────────────────────────────────
  /** Consecutive correct answers (resets on wrong answer) */
  comboCount: number;
  /** Highest combo ever achieved */
  bestCombo: number;

  // ─── Streak ─────────────────────────────────────────────────────────────
  /** Current streak in days */
  streak: number;
  /** ISO date string of last activity */
  lastActivityDate: string | null;
  /** Number of streak freezes available (bought with XP) */
  streakFreezes: number;

  // ─── Daily Challenge ────────────────────────────────────────────────────
  dailyChallenge: DailyChallengeState;

  // ─── Exercise Results ───────────────────────────────────────────────────
  /** Map of chapterId -> exerciseIndex[] that were answered correctly */
  exerciseResults: Record<string, number[]>;

  // ─── Hint Usage ───────────────────────────────────────────────────────
  /** Map of "chapId:exIndex" -> max hint level used */
  hintUsage: Record<string, HintLevel>;

  // ─── Badges ───────────────────────────────────────────────────────────
  /** Earned badge IDs */
  badges: string[];

  // ─── Hydration (remote sync) ──────────────────────────────────────────
  /** Whether the store has been hydrated from remote */
  isHydrated: boolean;
  /** Whether the store can write to remote */
  canWriteRemote: boolean;
  /** Error message from hydration attempt */
  hydrationError: string | null;

  // ─── SRS (Spaced Repetition System) ───────────────────────────────────
  /** Map of chapterId -> { nextReview: ISO date, interval: days, easeFactor } */
  srsQueue: Record<string, SRSItem>;

  // ─── Computed (derived from state) ──────────────────────────────────────
  getNiveau: () => NiveauEleve;
  getNextNiveau: () => NiveauEleve | null;
  getXPProgress: () => { current: number; nextThreshold: number; percent: number };
  getComboMultiplier: () => number;
  getDueReviews: () => string[];

  // ─── Actions ────────────────────────────────────────────────────────────
  toggleChapterComplete: (chapId: string) => void;
  addXP: (amount: number) => void;
  addQuizScore: (points: number) => void;
  recordExerciseResult: (chapId: string, exerciseIndex: number) => void;
  recordExerciseWithHint: (chapId: string, exerciseIndex: number, hintLevel: HintLevel, baseXP: number) => void;
  completeDailyChallenge: (challengeId: string, xp: number) => void;
  incrementCombo: () => void;
  resetCombo: () => void;
  buyStreakFreeze: () => boolean;
  earnBadge: (badgeId: string) => void;
  recordActivity: () => void;
  evaluateBadges: () => void;
  recordSRSReview: (chapId: string, quality: 0 | 1 | 2 | 3 | 4 | 5) => void;
  resetProgress: () => void;
  setHydrationStatus: (status: { isHydrated: boolean; canWriteRemote: boolean; hydrationError: string | null }) => void;
  unlockChapter: (chapId: string) => void;
}

// ─── SRS Types ──────────────────────────────────────────────────────────────

interface SRSItem {
  /** ISO date of next scheduled review */
  nextReview: string;
  /** Current interval in days */
  interval: number;
  /** SM-2 ease factor (default 2.5) */
  easeFactor: number;
  /** Number of consecutive correct reviews */
  repetitions: number;
}

/**
 * SM-2 algorithm for spaced repetition.
 * quality: 0-5 (0=blackout, 5=perfect)
 */
function sm2(item: SRSItem, quality: number): SRSItem {
  let { interval, easeFactor, repetitions } = item;

  if (quality < 3) {
    // Failed: reset
    repetitions = 0;
    interval = 1;
  } else {
    // Success
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 3;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  }

  // Update ease factor (minimum 1.3)
  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);

  return {
    nextReview: nextDate.toISOString().slice(0, 10),
    interval,
    easeFactor,
    repetitions,
  };
}

// ─── Badge Evaluation Logic ─────────────────────────────────────────────────

function evaluateBadgeConditions(state: {
  streak: number;
  bestCombo: number;
  completedChapters: string[];
  masteredChapters: string[];
  exerciseResults: Record<string, number[]>;
  hintUsage: Record<string, HintLevel>;
  badges: string[];
}): string[] {
  const newBadges: string[] = [];
  const allChapterIds = Object.values(programmeData).flatMap((cat) =>
    cat.chapitres.map((c) => c.id)
  );
  const geoChapterIds = programmeData.geometrie?.chapitres.map((c) => c.id) ?? [];
  const probaChapterIds = programmeData.probabilites?.chapitres.map((c) => c.id) ?? [];

  for (const badge of badgeDefinitions) {
    if (state.badges.includes(badge.id)) continue;

    let earned = false;
    const cond = badge.condition;

    if (cond === 'streak >= 7') earned = state.streak >= 7;
    else if (cond === 'streak >= 30') earned = state.streak >= 30;
    else if (cond === 'combo >= 10') earned = state.bestCombo >= 10;
    else if (cond === 'hard_no_hint') {
      // Any exercise on a difficulty >= 4 chapter completed with no hints
      for (const cat of Object.values(programmeData)) {
        for (const chap of cat.chapitres) {
          if (chap.difficulte >= 4 && (state.exerciseResults[chap.id]?.length ?? 0) > 0) {
            const hasHint = state.exerciseResults[chap.id]?.some(
              (idx) => (state.hintUsage[`${chap.id}:${idx}`] ?? 0) > 0
            );
            if (!hasHint) earned = true;
          }
        }
      }
    } else if (cond === 'perfect_chapter') {
      earned = state.masteredChapters.length > 0;
    } else if (cond === 'first_python') {
      earned = (state.exerciseResults['algorithmique-python']?.length ?? 0) > 0;
    } else if (cond.startsWith('mastered:')) {
      const target = cond.replace('mastered:', '');
      if (target === 'geometrie-all') {
        earned = geoChapterIds.length > 0 && geoChapterIds.every((id) => state.completedChapters.includes(id));
      } else if (target === 'probabilites-all') {
        earned = probaChapterIds.length > 0 && probaChapterIds.every((id) => state.completedChapters.includes(id));
      } else {
        earned = state.completedChapters.includes(target);
      }
    } else if (cond === 'all_chapters_completed') {
      earned = allChapterIds.length > 0 && allChapterIds.every((id) => state.completedChapters.includes(id));
    }

    if (earned) newBadges.push(badge.id);
  }

  return newBadges;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function calculateStreak(lastDate: string | null, currentStreak: number, freezes: number): { streak: number; freezesUsed: number } {
  if (!lastDate) return { streak: 1, freezesUsed: 0 };
  const today = getTodayISO();
  if (lastDate === today) return { streak: currentStreak, freezesUsed: 0 };

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().slice(0, 10);

  if (lastDate === yesterdayISO) return { streak: currentStreak + 1, freezesUsed: 0 };

  // Check if we can use a streak freeze (missed 1 day)
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysAgoISO = twoDaysAgo.toISOString().slice(0, 10);

  if (lastDate === twoDaysAgoISO && freezes > 0) {
    return { streak: currentStreak + 1, freezesUsed: 1 };
  }

  return { streak: 1, freezesUsed: 0 }; // streak broken
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useMathsLabStore = create<MathsLabState>()(
  persist(
    (set, get) => ({
      // ─── Initial State ──────────────────────────────────────────────────
      completedChapters: [],
      masteredChapters: [],
      totalXP: 0,
      quizScore: 0,
      comboCount: 0,
      bestCombo: 0,
      streak: 0,
      lastActivityDate: null,
      streakFreezes: 0,
      dailyChallenge: {
        lastCompletedDate: null,
        todayChallengeId: null,
        completedToday: false,
      },
      exerciseResults: {},
      hintUsage: {},
      badges: [],
      isHydrated: false,
      canWriteRemote: false,
      hydrationError: null,
      srsQueue: {},

      // ─── Computed ───────────────────────────────────────────────────────
      getNiveau: () => getNiveau(get().totalXP),
      getNextNiveau: () => getNextNiveau(get().totalXP),
      getXPProgress: () => {
        const xp = get().totalXP;
        const current = getNiveau(xp);
        const next = getNextNiveau(xp);
        if (!next) return { current: xp, nextThreshold: current.xpMin, percent: 100 };
        const range = next.xpMin - current.xpMin;
        const progress = xp - current.xpMin;
        return {
          current: progress,
          nextThreshold: range,
          percent: Math.min(100, Math.round((progress / range) * 100)),
        };
      },
      getComboMultiplier: () => {
        const combo = get().comboCount;
        if (combo >= 10) return 2.0;
        if (combo >= 5) return 1.5;
        if (combo >= 3) return 1.25;
        return 1.0;
      },
      getDueReviews: () => {
        const today = getTodayISO();
        const queue = get().srsQueue;
        return Object.entries(queue)
          .filter(([, item]) => item.nextReview <= today)
          .map(([chapId]) => chapId);
      },

      // ─── Actions ────────────────────────────────────────────────────────
      toggleChapterComplete: (chapId: string) => {
        set((state) => {
          const isCompleted = state.completedChapters.includes(chapId);
          const completedChapters = isCompleted
            ? state.completedChapters.filter((id) => id !== chapId)
            : [...state.completedChapters, chapId];

          const xpDelta = isCompleted ? 0 : 25; // bonus XP for completing a chapter
          return {
            completedChapters,
            totalXP: state.totalXP + xpDelta,
          };
        });
        get().recordActivity();
      },

      addXP: (amount: number) => {
        set((state) => ({ totalXP: state.totalXP + amount }));
        get().recordActivity();
      },

      addQuizScore: (points: number) => {
        set((state) => ({
          quizScore: state.quizScore + points,
          totalXP: state.totalXP + points,
        }));
        get().recordActivity();
      },

      recordExerciseResult: (chapId: string, exerciseIndex: number) => {
        set((state) => {
          const prev = state.exerciseResults[chapId] ?? [];
          if (prev.includes(exerciseIndex)) return state;
          const comboMult = get().getComboMultiplier();
          const xpGain = Math.round(10 * comboMult);
          return {
            exerciseResults: {
              ...state.exerciseResults,
              [chapId]: [...prev, exerciseIndex],
            },
            totalXP: state.totalXP + xpGain,
          };
        });
        get().recordActivity();
      },

      recordExerciseWithHint: (chapId: string, exerciseIndex: number, hintLevel: HintLevel, baseXP: number) => {
        const key = `${chapId}:${exerciseIndex}`;
        set((state) => {
          const prev = state.exerciseResults[chapId] ?? [];
          if (prev.includes(exerciseIndex)) return state;
          const malus = HINT_MALUS[hintLevel];
          const comboMult = get().getComboMultiplier();
          const xpGain = Math.round(baseXP * malus * comboMult);
          return {
            exerciseResults: {
              ...state.exerciseResults,
              [chapId]: [...prev, exerciseIndex],
            },
            hintUsage: {
              ...state.hintUsage,
              [key]: Math.max(state.hintUsage[key] ?? 0, hintLevel) as HintLevel,
            },
            totalXP: state.totalXP + xpGain,
          };
        });
        get().recordActivity();
      },

      completeDailyChallenge: (challengeId: string, xp: number) => {
        const today = getTodayISO();
        // Guard: prevent double completion
        if (get().dailyChallenge.completedToday && get().dailyChallenge.lastCompletedDate === today) return;
        const streakBonus = get().streak >= 5 ? 1.5 : get().streak >= 3 ? 1.25 : 1.0;
        const xpGain = Math.round(xp * streakBonus);
        set((state) => ({
          dailyChallenge: {
            lastCompletedDate: today,
            todayChallengeId: challengeId,
            completedToday: true,
          },
          totalXP: state.totalXP + xpGain,
        }));
        get().recordActivity();
      },

      incrementCombo: () => {
        set((state) => ({
          comboCount: state.comboCount + 1,
          bestCombo: Math.max(state.bestCombo, state.comboCount + 1),
        }));
      },

      resetCombo: () => {
        set({ comboCount: 0 });
      },

      buyStreakFreeze: () => {
        const cost = 100;
        const state = get();
        if (state.totalXP < cost) return false;
        set({ totalXP: state.totalXP - cost, streakFreezes: state.streakFreezes + 1 });
        return true;
      },

      earnBadge: (badgeId: string) => {
        set((state) => {
          if (state.badges.includes(badgeId)) return state;
          return { badges: [...state.badges, badgeId], totalXP: state.totalXP + 50 };
        });
      },

      evaluateBadges: () => {
        const state = get();
        const newBadges = evaluateBadgeConditions({
          streak: state.streak,
          bestCombo: state.bestCombo,
          completedChapters: state.completedChapters,
          masteredChapters: state.masteredChapters,
          exerciseResults: state.exerciseResults,
          hintUsage: state.hintUsage,
          badges: state.badges,
        });
        if (newBadges.length > 0) {
          set((s) => ({
            badges: [...s.badges, ...newBadges],
            totalXP: s.totalXP + newBadges.length * 50,
          }));
        }
      },

      recordSRSReview: (chapId: string, quality: 0 | 1 | 2 | 3 | 4 | 5) => {
        set((state) => {
          const current = state.srsQueue[chapId] ?? {
            nextReview: getTodayISO(),
            interval: 0,
            easeFactor: 2.5,
            repetitions: 0,
          };
          const updated = sm2(current, quality);
          return {
            srsQueue: { ...state.srsQueue, [chapId]: updated },
          };
        });
        get().recordActivity();
      },

      recordActivity: () => {
        const today = getTodayISO();
        set((state) => {
          const { streak: newStreak, freezesUsed } = calculateStreak(
            state.lastActivityDate,
            state.streak,
            state.streakFreezes
          );
          return {
            lastActivityDate: today,
            streak: newStreak,
            streakFreezes: state.streakFreezes - freezesUsed,
            dailyChallenge: state.dailyChallenge.lastCompletedDate === today
              ? state.dailyChallenge
              : { ...state.dailyChallenge, completedToday: false },
          };
        });
      },

      setHydrationStatus: (status: { isHydrated: boolean; canWriteRemote: boolean; hydrationError: string | null }) => {
        set(status);
      },

      unlockChapter: (chapId: string) => {
        set((state) => {
          if (state.completedChapters.includes(chapId)) return state;
          return { completedChapters: [...state.completedChapters, chapId] };
        });
      },

      resetProgress: () => {
        set({
          completedChapters: [],
          masteredChapters: [],
          totalXP: 0,
          quizScore: 0,
          comboCount: 0,
          bestCombo: 0,
          streak: 0,
          lastActivityDate: null,
          streakFreezes: 0,
          dailyChallenge: {
            lastCompletedDate: null,
            todayChallengeId: null,
            completedToday: false,
          },
          exerciseResults: {},
          hintUsage: {},
          badges: [],
          srsQueue: {},
        });
      },
    }),
    {
      name: 'nexus-maths-lab-v2',
      version: 3,
    }
  )
);
