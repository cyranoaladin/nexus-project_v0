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

  it('addXP adds points and updates niveau', () => {
    expect(useMathsLabStore.getState().totalXP).toBe(0);

    act(() => {
      useMathsLabStore.getState().addXP(200);
    });

    const state = useMathsLabStore.getState();
    expect(state.totalXP).toBe(200);
    // getNiveau returns the current level based on XP
    const niveau = state.getNiveau();
    expect(niveau).toBeDefined();
    expect(niveau.nom).toBeTruthy();
  });

  it('toggleChapterComplete adds chapter to completedChapters and awards XP', () => {
    const before = useMathsLabStore.getState();
    expect(before.completedChapters).not.toContain('second-degre');

    act(() => {
      useMathsLabStore.getState().toggleChapterComplete('second-degre');
    });

    const after = useMathsLabStore.getState();
    expect(after.completedChapters).toContain('second-degre');
    expect(after.totalXP).toBe(25); // 25 XP bonus for completing a chapter
  });

  it('toggleChapterComplete twice removes chapter but does not remove XP', () => {
    act(() => {
      useMathsLabStore.getState().toggleChapterComplete('second-degre');
    });
    expect(useMathsLabStore.getState().completedChapters).toContain('second-degre');
    const xpAfterComplete = useMathsLabStore.getState().totalXP;

    act(() => {
      useMathsLabStore.getState().toggleChapterComplete('second-degre');
    });
    const after = useMathsLabStore.getState();
    expect(after.completedChapters).not.toContain('second-degre');
    // XP is not removed on un-complete (by design: xpDelta = 0 when uncompleting)
    expect(after.totalXP).toBe(xpAfterComplete);
  });
});
