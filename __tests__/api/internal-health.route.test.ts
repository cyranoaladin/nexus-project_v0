import { NextResponse } from 'next/server';

const mockPolicy = jest.fn();
const mockDatabaseProbe = jest.fn();
const mockRagConfiguration = jest.fn();
const mockAuthorityReadiness = jest.fn();
const mockRateLimitReadiness = jest.fn();
const mockStorageReadiness = jest.fn();
const mockReleaseIdentity = jest.fn();
jest.mock('@/lib/rbac', () => ({ enforcePolicy: (...args: unknown[]) => mockPolicy(...args) }));
jest.mock('@/lib/guards', () => ({ isErrorResponse: (value: unknown) => value instanceof NextResponse }));
jest.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: (...args: unknown[]) => mockDatabaseProbe(...args) } }));
jest.mock('@/lib/rate-limit', () => ({
  assertRateLimitRuntimeConfiguration: jest.fn(), getRateLimitRuntimeMode: () => 'redis',
  assertRateLimitStoreReady: () => mockRateLimitReadiness(),
}));
jest.mock('@/lib/aria/rag', () => ({ isProductionAriaRagRuntimeFullyConfigured: () => mockRagConfiguration() }));
jest.mock('@/lib/auth/auth-rollout-startup', () => ({ checkAuthAuthorityReadiness: () => mockAuthorityReadiness() }));

jest.mock('@/lib/health/document-storage-readiness', () => ({ probeDocumentStorageReadiness: () => mockStorageReadiness() }));
jest.mock('@/lib/core-v2/diagnostics/release-identity', () => ({ readRunningReleaseSha: () => mockReleaseIdentity() }));

import { GET } from '@/app/api/internal/health/route';

const originalEnvironment = process.env;
beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnvironment, SMTP_HOST: 'mail.synthetic.test', SMTP_PORT: '1025',
    SMTP_USER: 'synthetic', SMTP_PASS: 'synthetic', NPC_LLM_MODE: 'MOCK' };
  delete process.env.RAG_API_BASE_URL;
  mockPolicy.mockResolvedValue({ user: { id: 'synthetic-admin', role: 'ADMIN' } });
  mockDatabaseProbe.mockResolvedValue([{ value: 1 }]);
  mockRagConfiguration.mockReturnValue(false);
  mockAuthorityReadiness.mockResolvedValue({ mode: 'HYBRID', coreV2: 'ready' });
  mockRateLimitReadiness.mockResolvedValue(undefined);
  mockStorageReadiness.mockResolvedValue({ ok: true, detail: 'directory-access-verified', scope: 'runtime' });
  mockReleaseIdentity.mockResolvedValue('5'.repeat(40));
});
afterEach(() => { process.env = originalEnvironment; });

test.each([undefined, '', '   '])('CORE_ONLY without a RAG target (%s) remains ready without claiming RAG reachability', async baseUrl => {
  if (baseUrl !== undefined) process.env.RAG_API_BASE_URL = baseUrl;
  const response = await GET();
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.readiness.core.ok).toBe(true);
  expect(body.checks.rag).toMatchObject({ ok: true, detail: 'not-applicable', scope: 'configuration' });
  expect(mockRagConfiguration).not.toHaveBeenCalled();
});
test('a targeted but unconfigured RAG feature is degraded without disabling Core readiness', async () => {
  process.env.RAG_API_BASE_URL = 'https://rag.synthetic.test';
  const response = await GET();
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.status).toBe('degraded');
  expect(body.readiness.core.ok).toBe(true);
  expect(body.checks.rag).toMatchObject({ ok: false, scope: 'configuration' });
});
test('a database failure blocks Core with a constant error code and no underlying connection details', async () => {
  mockDatabaseProbe.mockRejectedValue(new Error('synthetic-private-connection-detail'));
  const response = await GET();
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body.readiness.core.ok).toBe(false);
  expect(body.checks.db.detail).toBe('database-unavailable');
  expect(JSON.stringify(body)).not.toContain('synthetic-private-connection-detail');
});
test('a Core authority outage blocks readiness without a permissive V1 fallback', async () => {
  mockAuthorityReadiness.mockRejectedValue(new Error('synthetic-private-authority-detail'));
  const response = await GET();
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body.readiness.core.ok).toBe(false);
  expect(JSON.stringify(body)).not.toContain('synthetic-private-authority-detail');
});
test('unauthorized monitoring requests trigger no dependency probes', async () => {
  mockPolicy.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  expect((await GET()).status).toBe(401);
  expect(mockDatabaseProbe).not.toHaveBeenCalled();
  expect(mockRagConfiguration).not.toHaveBeenCalled();
  expect(mockAuthorityReadiness).not.toHaveBeenCalled();
  expect(mockRateLimitReadiness).not.toHaveBeenCalled();
  expect(mockStorageReadiness).not.toHaveBeenCalled();
  expect(mockReleaseIdentity).not.toHaveBeenCalled();
});

test('an unreachable Redis store blocks Core even when its environment is configured', async () => {
  process.env.RAG_API_BASE_URL = 'https://rag.synthetic.test';
  mockRagConfiguration.mockReturnValue(true);
  mockRateLimitReadiness.mockRejectedValue(new Error('synthetic-private-redis-detail'));
  const response = await GET();
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body.checks.redis).toMatchObject({ ok: false, detail: 'rate-limit-unavailable', scope: 'runtime' });
  expect(JSON.stringify(body)).not.toContain('synthetic-private-redis-detail');
});

test('an unavailable document root blocks Core instead of qualifying the process cwd', async () => {
  mockStorageReadiness.mockResolvedValue({ ok: false, detail: 'document-storage-unavailable', scope: 'runtime' });
  const response = await GET();
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body.readiness.core.ok).toBe(false);
  expect(body.checks.documentStorage).toMatchObject({ ok: false, scope: 'runtime' });
});
test('monitoring replies cannot be cached publicly', async () => {
  expect((await GET()).headers.get('Cache-Control')).toBe('private, no-store');
});
test('release identity comes from the verified immutable artifact manifest', async () => {
  const body = await (await GET()).json();
  expect(body.release).toEqual({ sha: '5'.repeat(40), verified: true });
});
test('missing release identity is reported honestly without an environment SHA fallback', async () => {
  process.env.GITHUB_SHA = '6'.repeat(40);
  mockReleaseIdentity.mockResolvedValue(null);
  const body = await (await GET()).json();
  expect(body.release).toEqual({ sha: null, verified: false });
  expect(body.status).toBe('degraded');
});

test('an unavailable runtime cwd returns controlled 503 without claiming a release identity', async () => {
  const cwd = jest.spyOn(process, 'cwd').mockImplementation(() => { throw new Error('synthetic-private-cwd-detail'); });
  const response = await GET().finally(() => cwd.mockRestore());
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body.release).toEqual({ sha: null, verified: false });
  expect(JSON.stringify(body)).not.toContain('synthetic-private-cwd-detail');
});
