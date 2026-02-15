/**
 * Unit Tests — Zustand Store (Maths Lab V2)
 * Tests for: XP, levels, combos, chapters, badges, daily challenges, SRS, persistence
 */
import { act } from '@testing-library/react';

// Reset zustand persist storage before each test
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Must import after localStorage mock
import { useMathsLabStore } from '@/app/programme/maths-1ere/store';
import { getNiveau, niveaux } from '@/app/programme/maths-1ere/data';

function resetStore() {
    const { resetProgress } = useMathsLabStore.getState();
    act(() => { resetProgress(); });
    localStorageMock.clear();
}

describe('Maths Lab Store', () => {
    beforeEach(() => {
        resetStore();
    });

    // ─── XP System ────────────────────────────────────────────────────────────

    describe('XP & Levels', () => {
        it('should start at 0 XP', () => {
            expect(useMathsLabStore.getState().totalXP).toBe(0);
        });

        it('addXP() should increment total XP', () => {
            act(() => { useMathsLabStore.getState().addXP(50); });
            expect(useMathsLabStore.getState().totalXP).toBe(50);
        });

        it('addXP() should accumulate across multiple calls', () => {
            act(() => {
                useMathsLabStore.getState().addXP(100);
                useMathsLabStore.getState().addXP(150);
            });
            expect(useMathsLabStore.getState().totalXP).toBe(250);
        });

        it('getNiveau() should return "Novice" at 0 XP', () => {
            const level = useMathsLabStore.getState().getNiveau();
            expect(level.nom).toBe('Novice');
        });

        it('getNiveau() should return "Initié" at 200 XP', () => {
            act(() => { useMathsLabStore.getState().addXP(200); });
            expect(useMathsLabStore.getState().getNiveau().nom).toBe('Initié');
        });

        it('getNiveau() should return "Expert" at 500 XP', () => {
            act(() => { useMathsLabStore.getState().addXP(500); });
            expect(useMathsLabStore.getState().getNiveau().nom).toBe('Expert');
        });

        it('getXPProgress() should return correct progress percentage', () => {
            act(() => { useMathsLabStore.getState().addXP(100); });
            const progress = useMathsLabStore.getState().getXPProgress();
            expect(progress.percent).toBeGreaterThanOrEqual(0);
            expect(progress.percent).toBeLessThanOrEqual(100);
            expect(progress.current).toBe(100);
        });
    });

    // ─── Chapters ─────────────────────────────────────────────────────────────

    describe('Chapter Completion', () => {
        it('should start with no completed chapters', () => {
            expect(useMathsLabStore.getState().completedChapters).toEqual([]);
        });

        it('toggleChapterComplete() should add chapter and award 25 XP', () => {
            act(() => { useMathsLabStore.getState().toggleChapterComplete('second-degre'); });
            const state = useMathsLabStore.getState();
            expect(state.completedChapters).toContain('second-degre');
            expect(state.totalXP).toBe(25);
        });

        it('toggleChapterComplete() toggling already completed chapter should NOT remove XP', () => {
            act(() => {
                useMathsLabStore.getState().toggleChapterComplete('suites');
                useMathsLabStore.getState().toggleChapterComplete('suites');
            });
            const state = useMathsLabStore.getState();
            expect(state.completedChapters).not.toContain('suites');
            // XP still 25 from first toggle (no negative XP on untoggle)
            expect(state.totalXP).toBe(25);
        });
    });

    // ─── Combo System ─────────────────────────────────────────────────────────

    describe('Combo System', () => {
        it('should start at combo 0 with multiplier 1.0', () => {
            expect(useMathsLabStore.getState().comboCount).toBe(0);
            expect(useMathsLabStore.getState().getComboMultiplier()).toBe(1.0);
        });

        it('incrementCombo() should increase combo count', () => {
            act(() => { useMathsLabStore.getState().incrementCombo(); });
            expect(useMathsLabStore.getState().comboCount).toBe(1);
        });

        it('getComboMultiplier() should return 1.25 at combo 3', () => {
            act(() => {
                for (let i = 0; i < 3; i++) useMathsLabStore.getState().incrementCombo();
            });
            expect(useMathsLabStore.getState().getComboMultiplier()).toBe(1.25);
        });

        it('getComboMultiplier() should return 1.5 at combo 5', () => {
            act(() => {
                for (let i = 0; i < 5; i++) useMathsLabStore.getState().incrementCombo();
            });
            expect(useMathsLabStore.getState().getComboMultiplier()).toBe(1.5);
        });

        it('getComboMultiplier() should return 2.0 at combo 10', () => {
            act(() => {
                for (let i = 0; i < 10; i++) useMathsLabStore.getState().incrementCombo();
            });
            expect(useMathsLabStore.getState().getComboMultiplier()).toBe(2.0);
        });

        it('resetCombo() should reset to 0', () => {
            act(() => {
                useMathsLabStore.getState().incrementCombo();
                useMathsLabStore.getState().incrementCombo();
                useMathsLabStore.getState().resetCombo();
            });
            expect(useMathsLabStore.getState().comboCount).toBe(0);
        });
    });

    // ─── Exercise Recording ───────────────────────────────────────────────────

    describe('Exercise Recording', () => {
        it('recordExerciseResult() should track exercise and award XP', () => {
            act(() => { useMathsLabStore.getState().recordExerciseResult('derivation', 0); });
            const state = useMathsLabStore.getState();
            expect(state.exerciseResults['derivation']).toContain(0);
            expect(state.totalXP).toBeGreaterThan(0);
        });

        it('recordExerciseResult() should not double-record same exercise', () => {
            act(() => {
                useMathsLabStore.getState().recordExerciseResult('derivation', 0);
                useMathsLabStore.getState().recordExerciseResult('derivation', 0);
            });
            const state = useMathsLabStore.getState();
            expect(state.exerciseResults['derivation']).toHaveLength(1);
        });

        it('recordExerciseWithHint() should apply XP malus for hints', () => {
            // Hint level 1 = 90% XP
            act(() => { useMathsLabStore.getState().recordExerciseWithHint('suites', 0, 1, 100); });
            const state = useMathsLabStore.getState();
            expect(state.totalXP).toBe(90); // 100 * 0.9
        });

        it('recordExerciseWithHint() with full solution (level 3) should give 0 XP', () => {
            act(() => { useMathsLabStore.getState().recordExerciseWithHint('suites', 1, 3, 100); });
            const state = useMathsLabStore.getState();
            expect(state.totalXP).toBe(0); // 100 * 0.0
        });
    });

    // ─── Badges ───────────────────────────────────────────────────────────────

    describe('Badges', () => {
        it('earnBadge() should add badge and award 50 XP', () => {
            act(() => { useMathsLabStore.getState().earnBadge('sherlock'); });
            const state = useMathsLabStore.getState();
            expect(state.badges).toContain('sherlock');
            expect(state.totalXP).toBe(50);
        });

        it('earnBadge() should prevent duplicate badges', () => {
            act(() => {
                useMathsLabStore.getState().earnBadge('sherlock');
                useMathsLabStore.getState().earnBadge('sherlock');
            });
            const state = useMathsLabStore.getState();
            expect(state.badges.filter(b => b === 'sherlock')).toHaveLength(1);
            expect(state.totalXP).toBe(50); // only 50, not 100
        });
    });

    // ─── Daily Challenge ──────────────────────────────────────────────────────

    describe('Daily Challenge', () => {
        it('completeDailyChallenge() should mark done and award XP', () => {
            act(() => { useMathsLabStore.getState().completeDailyChallenge('dc1', 15); });
            const state = useMathsLabStore.getState();
            expect(state.dailyChallenge.completedToday).toBe(true);
            expect(state.totalXP).toBe(15);
        });

        it('completeDailyChallenge() should prevent double completion', () => {
            act(() => {
                useMathsLabStore.getState().completeDailyChallenge('dc1', 15);
                useMathsLabStore.getState().completeDailyChallenge('dc2', 20);
            });
            const state = useMathsLabStore.getState();
            // Second call should be ignored
            expect(state.totalXP).toBe(15);
        });
    });

    // ─── Reset ────────────────────────────────────────────────────────────────

    describe('Reset', () => {
        it('resetProgress() should clear all state', () => {
            act(() => {
                useMathsLabStore.getState().addXP(500);
                useMathsLabStore.getState().earnBadge('fusee');
                useMathsLabStore.getState().toggleChapterComplete('derivation');
                useMathsLabStore.getState().resetProgress();
            });
            const state = useMathsLabStore.getState();
            expect(state.totalXP).toBe(0);
            expect(state.badges).toEqual([]);
            expect(state.completedChapters).toEqual([]);
            expect(state.comboCount).toBe(0);
        });
    });
});
