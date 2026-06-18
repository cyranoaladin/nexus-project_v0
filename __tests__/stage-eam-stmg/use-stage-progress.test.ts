import { act, renderHook, waitFor } from '@testing-library/react';
import { useStageProgress, storageKey } from '@/hooks/stage-eam-stmg/useStageProgress';

describe('useStageProgress local persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('hydrates from localStorage and persists validated notions for a real DomainId', async () => {
    const { result } = renderHook(() => useStageProgress('student-sync-ok'));

    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => {
      result.current.toggleNotion('fonctions', 'Tangente');
    });

    const raw = window.localStorage.getItem(storageKey('student-sync-ok'));
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw as string) as { validatedNotions: Record<string, string[]> };
    expect(parsed.validatedNotions.fonctions).toContain('Tangente');
    expect(result.current.state.validatedNotions.fonctions).toContain('Tangente');
  });

  it('resets state and clears persisted progress cleanly', async () => {
    const { result } = renderHook(() => useStageProgress('student-sync-reset'));

    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => {
      result.current.toggleNotion('algorithmique-information', 'Variables');
    });
    expect(window.localStorage.getItem(storageKey('student-sync-reset'))).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    const raw = window.localStorage.getItem(storageKey('student-sync-reset'));
    expect(raw).toBeNull();
    expect(result.current.state.validatedNotions['algorithmique-information']).toHaveLength(0);
  });
});
