import { prisma } from '@/lib/prisma';
import {
  _resetForTest,
  getConfigSnapshotRuntimeStatus,
  loadConfigSnapshot,
} from '@/lib/config/snapshot';

function missingBusinessConfigTableError() {
  const error = new Error('The table `public.business_configs` does not exist in the current database.');
  (error as Error & { code?: string; meta?: Record<string, unknown> }).code = 'P2021';
  (error as Error & { code?: string; meta?: Record<string, unknown> }).meta = {
    table: 'public.business_configs',
  };
  return error;
}

describe('BusinessConfig passive snapshot fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetForTest();
  });

  afterEach(() => {
    _resetForTest();
  });

  it('classifies a missing optional business_configs table without loud recurring console.error', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (prisma.businessConfig.findMany as jest.Mock).mockRejectedValueOnce(missingBusinessConfigTableError());

    try {
      await loadConfigSnapshot();
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Passive refresh failed'),
        expect.anything(),
      );
      expect(getConfigSnapshotRuntimeStatus()).toEqual({
        mode: 'static_fallback_allowed',
        ok: true,
        lastError: {
          kind: 'missing_table',
          table: 'business_configs',
        },
      });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('marks successful DB-backed loads as database mode', async () => {
    (prisma.businessConfig.findMany as jest.Mock).mockResolvedValueOnce([]);

    await loadConfigSnapshot();

    expect(getConfigSnapshotRuntimeStatus()).toEqual({
      mode: 'database',
      ok: true,
      lastError: null,
    });
  });
});
