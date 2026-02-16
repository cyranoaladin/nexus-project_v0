import { act } from '@testing-library/react';
import { useMathsLabStore } from '@/app/programme/maths-1ere/store';

function resetStore() {
  act(() => {
    useMathsLabStore.getState().resetProgress();
  });
  window.localStorage.clear();
}

describe('MathsLab store', () => {
  beforeEach(() => {
    resetStore();
  });

  it('addXP ajoute des points et déclenche un levelUp au seuil', () => {
    expect(useMathsLabStore.getState().totalXP).toBe(0);
    expect(useMathsLabStore.getState().levelUpCount).toBe(0);

    act(() => {
      useMathsLabStore.getState().addXP(200);
    });

    const state = useMathsLabStore.getState();
    expect(state.totalXP).toBe(200);
    expect(state.getNiveau().nom).toBe('Initié');
    expect(state.levelUpCount).toBe(1);
    expect(state.lastLevelUpName).toBe('Initié');
  });

  it('toggleChapterComplete débloque les chapitres enfants via prerequis', () => {
    const before = useMathsLabStore.getState();
    expect(before.unlockedChapters).not.toContain('suites');

    act(() => {
      useMathsLabStore.getState().toggleChapterComplete('second-degre');
    });

    const after = useMathsLabStore.getState();
    expect(after.completedChapters).toContain('second-degre');
    expect(after.unlockedChapters).toContain('suites');
  });

  it('unlockChapter does NOT mark chapter as completed for prerequisite evaluation', () => {
    act(() => {
      useMathsLabStore.getState().unlockChapter('second-degre');
    });

    const after = useMathsLabStore.getState();
    expect(after.unlockedChapters).toContain('second-degre');
    // suites requires second-degre to be COMPLETED, not just unlocked
    expect(after.unlockedChapters).not.toContain('suites');
    expect(after.completedChapters).not.toContain('second-degre');
  });
});
