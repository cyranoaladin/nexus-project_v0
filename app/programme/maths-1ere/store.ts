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

interface MathsLabState {
  // ─── Progression ────────────────────────────────────────────────────────
  /** IDs of completed chapters */
  completedChapters: string[];
  /** IDs of chapters where all exercises were completed */
  masteredChapters: string[];

  // ─── XP & Gamification ──────────────────────────────────────────────────
  totalXP: number;
  quizScore: number;

  // ─── Streak ─────────────────────────────────────────────────────────────
  /** Current streak in days */
  streak: number;
  /** ISO date string of last activity */
  lastActivityDate: string | null;

  // ─── Daily Challenge ────────────────────────────────────────────────────
  dailyChallenge: DailyChallengeState;

  // ─── Exercise Results ───────────────────────────────────────────────────
  /** Map of chapterId -> exerciseIndex[] that were answered correctly */
  exerciseResults: Record<string, number[]>;

  // ─── Computed (derived from state) ──────────────────────────────────────
  getNiveau: () => NiveauEleve;
  getNextNiveau: () => NiveauEleve | null;
  getXPProgress: () => { current: number; nextThreshold: number; percent: number };

  // ─── Actions ────────────────────────────────────────────────────────────
  toggleChapterComplete: (chapId: string) => void;
  addXP: (amount: number) => void;
  addQuizScore: (points: number) => void;
  recordExerciseResult: (chapId: string, exerciseIndex: number) => void;
  completeDailyChallenge: (challengeId: string, xp: number) => void;
  recordActivity: () => void;
  resetProgress: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function calculateStreak(lastDate: string | null, currentStreak: number): number {
  if (!lastDate) return 1;
  const today = getTodayISO();
  if (lastDate === today) return currentStreak;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().slice(0, 10);

  if (lastDate === yesterdayISO) return currentStreak + 1;
  return 1; // streak broken
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
      streak: 0,
      lastActivityDate: null,
      dailyChallenge: {
        lastCompletedDate: null,
        todayChallengeId: null,
        completedToday: false,
      },
      exerciseResults: {},

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
          return {
            exerciseResults: {
              ...state.exerciseResults,
              [chapId]: [...prev, exerciseIndex],
            },
            totalXP: state.totalXP + 10,
          };
        });
        get().recordActivity();
      },

      completeDailyChallenge: (challengeId: string, xp: number) => {
        const today = getTodayISO();
        set((state) => ({
          dailyChallenge: {
            lastCompletedDate: today,
            todayChallengeId: challengeId,
            completedToday: true,
          },
          totalXP: state.totalXP + xp,
        }));
        get().recordActivity();
      },

      recordActivity: () => {
        const today = getTodayISO();
        set((state) => {
          const newStreak = calculateStreak(state.lastActivityDate, state.streak);
          return {
            lastActivityDate: today,
            streak: newStreak,
            // Reset daily challenge flag if it's a new day
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
          streak: 0,
          lastActivityDate: null,
          dailyChallenge: {
            lastCompletedDate: null,
            todayChallengeId: null,
            completedToday: false,
          },
          exerciseResults: {},
        });
      },
    }),
    {
      name: 'nexus-maths-lab-v2',
      version: 1,
    }
  )
);
