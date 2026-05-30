import { act, renderHook, waitFor } from '@testing-library/react';
import { useStageProgress } from '@/hooks/stage-eam-stmg/useStageProgress';

describe('useStageProgress server sync guard', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    window.localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('does not write remote stage progress when initial server load fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as jest.Mock;

    const { result } = renderHook(() => useStageProgress('student-sync-failed'));

    await waitFor(() => expect(result.current.serverSyncStatus).toBe('failed'));

    act(() => {
      result.current.toggleNotion('derivation', 'Tangente');
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/programme/maths-1ere-stmg/stage-progress');
  });

  it('writes only to the scoped stage-progress endpoint after a valid server load', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, data: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, persisted: true }) }) as jest.Mock;

    const { result } = renderHook(() => useStageProgress('student-sync-ok'));

    await waitFor(() => expect(result.current.serverSyncStatus).toBe('ok'));

    act(() => {
      result.current.toggleNotion('derivation', 'Tangente');
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/programme/maths-1ere-stmg/stage-progress', expect.objectContaining({
      method: 'POST',
    }));
  });
});
