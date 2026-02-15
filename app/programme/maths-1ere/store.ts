'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getNiveau, getNextNiveau, type NiveauEleve } from './data';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DailyChallengeState {
  /** ISO date string of last completed daily challenge */
  lastCompletedDate: string | null;
  /** ID of today's challenge (deterministic from date) */
  todayChallengeId: string | null;
  /** Whether today's challenge was completed */
  completedToday: boolean;
}

/** Hint level used: 0=none, 1=indice(-10%), 2=début(-25%), 3=correction(-50%) */
type HintLevel = 0 | 1 | 2 | 3;

/** XP malus multipliers per hint level */
const HINT_MALUS: Record<HintLevel, number> = {
  0: 1.0,
  1: 0.9,
  2: 0.75,
  3: 0.5,
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

  // ─── Computed (derived from state) ──────────────────────────────────────
  getNiveau: () => NiveauEleve;
  getNextNiveau: () => NiveauEleve | null;
  getXPProgress: () => { current: number; nextThreshold: number; percent: number };
  getComboMultiplier: () => number;

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
  resetProgress: () => void;
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
        });
      },
    }),
    {
      name: 'nexus-maths-lab-v2',
      version: 2,
    }
  )
);
