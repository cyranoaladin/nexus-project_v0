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

describe('BusinessConfig production fallback gate', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllowed = process.env.BUSINESS_CONFIG_STATIC_FALLBACK_ALLOWED;

  beforeEach(() => {
    jest.clearAllMocks();
    _resetForTest();
  });

  afterEach(() => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalNodeEnv,
      configurable: true,
      writable: true,
    });
    _resetForTest();
    if (originalAllowed === undefined) {
      delete process.env.BUSINESS_CONFIG_STATIC_FALLBACK_ALLOWED;
    } else {
      process.env.BUSINESS_CONFIG_STATIC_FALLBACK_ALLOWED = originalAllowed;
    }
  });

  it('marks missing business_configs as unexpected and degraded in production by default', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      configurable: true,
      writable: true,
    });
    delete process.env.BUSINESS_CONFIG_STATIC_FALLBACK_ALLOWED;
    (prisma.businessConfig.findMany as jest.Mock).mockRejectedValueOnce(missingBusinessConfigTableError());

    await loadConfigSnapshot();

    expect(getConfigSnapshotRuntimeStatus()).toEqual({
      mode: 'static_fallback_unexpected',
      ok: false,
      lastError: {
        kind: 'missing_table',
        table: 'business_configs',
      },
    });
  });

  it('allows explicit static fallback only when configured', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      configurable: true,
      writable: true,
    });
    process.env.BUSINESS_CONFIG_STATIC_FALLBACK_ALLOWED = 'true';
    (prisma.businessConfig.findMany as jest.Mock).mockRejectedValueOnce(missingBusinessConfigTableError());

    await loadConfigSnapshot();

    expect(getConfigSnapshotRuntimeStatus()).toEqual({
      mode: 'static_fallback_allowed',
      ok: true,
      lastError: {
        kind: 'missing_table',
        table: 'business_configs',
      },
    });
  });
});
