'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { badgesTerminale } from './data';

type HintLevel = 0 | 1 | 2 | 3;

const HINT_MALUS: Record<HintLevel, number> = {
  0: 1,
  1: 0.9,
  2: 0.7,
  3: 0,
};

export interface SRSItem {
  nextReview: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
  errorTag?: string;
}

function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function sm2(item: SRSItem, quality: 0 | 1 | 2 | 3 | 4 | 5): SRSItem {
  let { interval, easeFactor, repetitions } = item;
  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 3;
    else interval = Math.max(1, Math.round(interval * easeFactor));
    repetitions += 1;
  }
  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  const next = new Date();
  next.setDate(next.getDate() + interval);
  return {
    ...item,
    interval,
    easeFactor,
    repetitions,
    nextReview: next.toISOString().slice(0, 10),
  };
}

interface DailyChallengeState {
  lastCompletedDate: string | null;
  todayChallengeId: string | null;
  completedToday: boolean;
}

interface TerminaleLabState {
  completedChapters: string[];
  masteredChapters: string[];
  totalXP: number;
  quizScore: number;
  comboCount: number;
  bestCombo: number;
  streak: number;
  lastActivityDate: string | null;
  streakFreezes: number;
  dailyChallenge: DailyChallengeState;
  exerciseResults: Record<string, number[]>;
  hintUsage: Record<string, HintLevel>;
  badges: string[];
  srsQueue: Record<string, SRSItem>;
  hintPenaltyXp: number;
  errorTags: Record<string, number>;
  bacChecklistCompletions: number;

  getComboMultiplier: () => number;
  getDueReviews: () => string[];

  addXP: (amount: number) => void;
  addQuizScore: (points: number) => void;
  recordActivity: () => void;
  incrementCombo: () => void;
  resetCombo: () => void;
  toggleChapterComplete: (chapId: string) => void;
  recordExerciseResult: (chapId: string, exerciseIndex: number) => void;
  recordExerciseWithHint: (chapId: string, exerciseIndex: number, hintLevel: HintLevel, baseXP: number) => void;
  addToSRS: (key: string, errorTag?: string) => void;
  recordSRSReview: (key: string, quality: 0 | 1 | 2 | 3 | 4 | 5) => void;
  completeDailyChallenge: (challengeId: string, xp: number) => void;
  earnBadge: (badgeId: string) => void;
  evaluateBadges: () => void;
  addErrorTag: (tag: string) => void;
  markBacChecklist: (complete: boolean) => void;
  resetProgress: () => void;
}

function updateStreak(lastDate: string | null, current: number): number {
  if (!lastDate) return 1;
  const today = getTodayISO();
  if (lastDate === today) return current;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (lastDate === yesterday.toISOString().slice(0, 10)) return current + 1;
  return 1;
}

export const useMathsTerminaleStore = create<TerminaleLabState>()(
  persist(
    (set, get) => ({
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
      hintPenaltyXp: 0,
      errorTags: {},
      bacChecklistCompletions: 0,

      getComboMultiplier: () => {
        const combo = get().comboCount;
        if (combo >= 15) return 2.5;
        if (combo >= 10) return 2;
        if (combo >= 5) return 1.5;
        return 1;
      },

      getDueReviews: () => {
        const today = getTodayISO();
        return Object.entries(get().srsQueue)
          .filter(([, item]) => item.nextReview <= today)
          .map(([id]) => id);
      },

      addXP: (amount) =>
        set((state) => ({
          totalXP: Math.max(0, state.totalXP + amount),
        })),

      addQuizScore: (points) =>
        set((state) => ({ quizScore: Math.max(0, state.quizScore + points) })),

      recordActivity: () =>
        set((state) => {
          const today = getTodayISO();
          return {
            lastActivityDate: today,
            streak: updateStreak(state.lastActivityDate, state.streak),
          };
        }),

      incrementCombo: () =>
        set((state) => {
          const combo = state.comboCount + 1;
          return {
            comboCount: combo,
            bestCombo: Math.max(state.bestCombo, combo),
          };
        }),

      resetCombo: () => set({ comboCount: 0 }),

      toggleChapterComplete: (chapId) =>
        set((state) => {
          const completed = state.completedChapters.includes(chapId)
            ? state.completedChapters.filter((id) => id !== chapId)
            : [...state.completedChapters, chapId];
          return { completedChapters: completed };
        }),

      recordExerciseResult: (chapId, exerciseIndex) =>
        set((state) => {
          const done = new Set(state.exerciseResults[chapId] ?? []);
          done.add(exerciseIndex);
          return {
            exerciseResults: {
              ...state.exerciseResults,
              [chapId]: Array.from(done),
            },
          };
        }),

      recordExerciseWithHint: (chapId, exerciseIndex, hintLevel, baseXP) =>
        set((state) => {
          const done = new Set(state.exerciseResults[chapId] ?? []);
          done.add(exerciseIndex);
          const key = `${chapId}:${exerciseIndex}`;
          const prevHint = state.hintUsage[key] ?? 0;
          const maxHint = Math.max(prevHint, hintLevel) as HintLevel;
          const baseWithHint = baseXP * HINT_MALUS[maxHint];
          const comboMultiplier = state.comboCount >= 5 ? 1.5 : 1;
          const earned = Math.round(baseWithHint * comboMultiplier);
          return {
            exerciseResults: {
              ...state.exerciseResults,
              [chapId]: Array.from(done),
            },
            hintUsage: {
              ...state.hintUsage,
              [key]: maxHint,
            },
            totalXP: state.totalXP + Math.max(0, earned),
            hintPenaltyXp: state.hintPenaltyXp + Math.max(0, baseXP - Math.max(0, earned)),
          };
        }),

      addToSRS: (key, errorTag) =>
        set((state) => ({
          srsQueue: {
            ...state.srsQueue,
            [key]: {
              nextReview: getTodayISO(),
              interval: 1,
              easeFactor: 2.5,
              repetitions: 0,
              errorTag,
            },
          },
        })),

      recordSRSReview: (key, quality) =>
        set((state) => {
          const current = state.srsQueue[key] ?? {
            nextReview: getTodayISO(),
            interval: 1,
            easeFactor: 2.5,
            repetitions: 0,
          };
          return {
            srsQueue: {
              ...state.srsQueue,
              [key]: sm2(current, quality),
            },
          };
        }),

      completeDailyChallenge: (challengeId, xp) =>
        set((state) => {
          const today = getTodayISO();
          if (state.dailyChallenge.lastCompletedDate === today) return state;
          return {
            totalXP: state.totalXP + xp,
            dailyChallenge: {
              lastCompletedDate: today,
              todayChallengeId: challengeId,
              completedToday: true,
            },
          };
        }),

      earnBadge: (badgeId) =>
        set((state) => {
          if (state.badges.includes(badgeId)) return state;
          const badge = badgesTerminale.find((b) => b.id === badgeId);
          return {
            badges: [...state.badges, badgeId],
            totalXP: state.totalXP + (badge?.xp ?? 0),
          };
        }),

      evaluateBadges: () =>
        set((state) => {
          const newOnes: string[] = [];
          if ((state.exerciseResults['A2-espace-bases']?.length ?? 0) + (state.exerciseResults['A3-ortho-dist']?.length ?? 0) >= 12) {
            newOnes.push('b-espace');
          }
          if ((state.exerciseResults['B4-continuite-tvi']?.length ?? 0) >= 10) {
            newOnes.push('b-tvi');
          }
          if ((state.exerciseResults['C1-binomiale']?.length ?? 0) >= 5) {
            newOnes.push('b-binom');
          }
          if (state.streak >= 7 && (state.errorTags.signe ?? 0) === 0) {
            newOnes.push('b-nosign');
          }
          const trulyNew = newOnes.filter((id) => !state.badges.includes(id));
          if (trulyNew.length === 0) return state;
          const bonus = trulyNew.reduce((sum, id) => sum + (badgesTerminale.find((b) => b.id === id)?.xp ?? 0), 0);
          return {
            badges: [...state.badges, ...trulyNew],
            totalXP: state.totalXP + bonus,
          };
        }),

      addErrorTag: (tag) =>
        set((state) => ({
          errorTags: {
            ...state.errorTags,
            [tag]: (state.errorTags[tag] ?? 0) + 1,
          },
        })),

      markBacChecklist: (complete) =>
        set((state) => ({
          bacChecklistCompletions: state.bacChecklistCompletions + (complete ? 1 : 0),
          totalXP: state.totalXP + (complete ? 15 : 0),
        })),

      resetProgress: () =>
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
          hintPenaltyXp: 0,
          errorTags: {},
          bacChecklistCompletions: 0,
        }),
    }),
    {
      name: 'nexus-maths-terminale-lab-v1',
      version: 1,
      partialize: (state) => ({
        completedChapters: state.completedChapters,
        masteredChapters: state.masteredChapters,
        totalXP: state.totalXP,
        quizScore: state.quizScore,
        comboCount: state.comboCount,
        bestCombo: state.bestCombo,
        streak: state.streak,
        lastActivityDate: state.lastActivityDate,
        streakFreezes: state.streakFreezes,
        dailyChallenge: state.dailyChallenge,
        exerciseResults: state.exerciseResults,
        hintUsage: state.hintUsage,
        badges: state.badges,
        srsQueue: state.srsQueue,
        hintPenaltyXp: state.hintPenaltyXp,
        errorTags: state.errorTags,
        bacChecklistCompletions: state.bacChecklistCompletions,
      }),
    }
  )
);
