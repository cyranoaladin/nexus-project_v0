import { GET } from '@/app/api/internal/health/route';
import { enforcePolicy } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { ragSearch } from '@/lib/rag-client';

jest.mock('@/lib/rbac', () => ({
  enforcePolicy: jest.fn(),
}));

jest.mock('@/lib/rag-client', () => ({
  ragSearch: jest.fn(),
}));

const ORIGINAL_ENV = {
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
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key as keyof NodeJS.ProcessEnv];
    } else {
      process.env[key as keyof NodeJS.ProcessEnv] = value;
    }
  }
}

function setHealthyNonSecretEnv() {
  process.env.SMTP_HOST = 'smtp.test';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'smtp-user';
  process.env.SMTP_PASS = 'smtp-pass';
  process.env.NPC_LLM_MODE = 'stub';
}

describe('GET /api/internal/health — rate limit runtime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    restoreEnv();
    delete process.env.REDIS_URL;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    setHealthyNonSecretEnv();
    (enforcePolicy as jest.Mock).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ ok: 1 }]);
    (ragSearch as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    restoreEnv();
  });

  it('reports memory mode as degraded and blocked for go-live large', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.checks.redis).toEqual({ ok: false, detail: 'memory' });
    expect(body.runtime.rateLimit).toEqual({
      mode: 'memory',
      distributed: false,
      goLiveLarge: 'blocked',
    });
  });

  it('reports redis mode unambiguously when configured', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.checks.redis).toEqual({ ok: true, detail: 'redis' });
    expect(body.runtime.rateLimit).toEqual({
      mode: 'redis',
      distributed: true,
      goLiveLarge: 'allowed',
    });
  });
});
