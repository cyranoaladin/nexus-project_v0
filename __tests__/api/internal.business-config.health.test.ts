import { GET } from '@/app/api/internal/health/route';
import { enforcePolicy } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { ragSearch } from '@/lib/rag-client';
import { getConfigSnapshotRuntimeStatus } from '@/lib/config/snapshot';

jest.mock('@/lib/rbac', () => ({
  enforcePolicy: jest.fn(),
}));

jest.mock('@/lib/rag-client', () => ({
  ragSearch: jest.fn(),
}));

jest.mock('@/lib/config/snapshot', () => ({
  getConfigSnapshotRuntimeStatus: jest.fn(),
}));

const originalEnv = {
  REDIS_URL: process.env.REDIS_URL,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  NPC_LLM_MODE: process.env.NPC_LLM_MODE,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key as keyof NodeJS.ProcessEnv];
    } else {
      process.env[key as keyof NodeJS.ProcessEnv] = value;
    }
  }
}

describe('GET /api/internal/health — business config drift classification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    restoreEnv();
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.SMTP_HOST = 'smtp.test';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-pass';
    process.env.NPC_LLM_MODE = 'stub';
    (enforcePolicy as jest.Mock).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ ok: 1 }]);
    (ragSearch as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    restoreEnv();
  });

  it('exposes database-backed business config mode when available', async () => {
    (getConfigSnapshotRuntimeStatus as jest.Mock).mockReturnValue({
      mode: 'database',
      ok: true,
      lastError: null,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.checks.businessConfig).toEqual({ ok: true, detail: 'database' });
    expect(body.runtime.businessConfig).toEqual({
      mode: 'database',
      ok: true,
      lastError: null,
    });
  });

  it('classifies missing business_configs as static fallback instead of an ambiguous warning', async () => {
    (getConfigSnapshotRuntimeStatus as jest.Mock).mockReturnValue({
      mode: 'static_fallback_allowed',
      ok: true,
      lastError: { kind: 'missing_table', table: 'business_configs' },
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.checks.businessConfig).toEqual({
      ok: true,
      detail: 'static_fallback_allowed:missing_table',
    });
    expect(body.runtime.businessConfig.lastError).toEqual({
      kind: 'missing_table',
      table: 'business_configs',
    });
  });
});
