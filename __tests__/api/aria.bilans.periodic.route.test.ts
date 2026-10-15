import { NextRequest } from 'next/server';
import { POST } from '@/app/api/aria/bilans/periodic/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { generateAndPersistAriaPeriodicBilan } from '@/lib/aria/bilans/periodic/generate-and-persist-periodic-bilan';
import { AriaError } from '@/lib/aria/errors';
import { readBoundPrivateV1Session } from '@/lib/auth/private-v1-session';
import { withV1SessionAuthority } from '@/lib/auth/v1-session-authority';

jest.mock('@/lib/auth/private-v1-session', () => ({ readBoundPrivateV1Session: jest.fn() }));
jest.mock('@/lib/auth/v1-session-authority', () => ({ withV1SessionAuthority: jest.fn(async (_claims, operation, publish) => { const result = await operation({ syntheticTx: true }); publish?.(result); return result; }) }));

jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn(),
}));
jest.mock('@/lib/aria/bilans/periodic/generate-and-persist-periodic-bilan', () => ({
  generateAndPersistAriaPeriodicBilan: jest.fn(),
}));
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), getRequestId: () => 'req_test' }),
}));

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockIsErrorResponse = isErrorResponse as unknown as jest.Mock;
const mockGenerate = generateAndPersistAriaPeriodicBilan as jest.Mock;

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/aria/bilans/periodic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  studentId: 'student-1',
  courseKey: 'eds-maths-premiere',
  periodStart: '2026-08-29T00:00:00.000Z',
  periodEnd: '2026-09-12T00:00:00.000Z',
};

describe('POST /api/aria/bilans/periodic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsErrorResponse.mockReturnValue(false);
    jest.mocked(readBoundPrivateV1Session).mockResolvedValue({ userId: 'coach-1', role: 'COACH', sessionVersion: 7, expiresAt: 4_070_908_800_000 });
  });

  it('requires ADMIN, ASSISTANTE, or COACH', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    mockGenerate.mockResolvedValueOnce({ assertScopeNow: jest.fn(), bilanId: 'bilan-1', report: { totalAttemptsInPeriod: 3, globalScore: 66.7 } });
    await POST(makeRequest(VALID_BODY));
    expect(mockRequireAnyRole).toHaveBeenCalledWith(['ADMIN', 'ASSISTANTE', 'COACH']);
  });

  it('returns the guard response as-is when the caller has none of those roles', async () => {
    const denied = new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    mockRequireAnyRole.mockResolvedValue(denied);
    mockIsErrorResponse.mockReturnValueOnce(true);

    const response = await POST(makeRequest(VALID_BODY));
    expect(response).toBe(denied);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('rejects a malformed JSON body without calling the application layer', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    const malformed = new NextRequest('http://localhost:3000/api/aria/bilans/periodic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    const response = await POST(malformed);
    expect(response.status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('rejects an invalid body without calling the application layer', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    const response = await POST(makeRequest({ studentId: 'student-1' }));
    expect(response.status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('delegates the original issuer and authoritative transaction before returning the computed scores', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    mockGenerate.mockResolvedValueOnce({ assertScopeNow: jest.fn(), bilanId: 'bilan-1', report: { totalAttemptsInPeriod: 3, globalScore: 66.7 } });

    const response = await POST(makeRequest(VALID_BODY));
    expect(response.status).toBe(200);
    expect(mockGenerate).toHaveBeenCalledWith({
      actor: { userId: 'coach-1', role: 'COACH', sessionVersion: 7, expiresAt: 4_070_908_800_000 },
      studentId: 'student-1',
      courseKey: 'eds-maths-premiere',
      periodStart: new Date(VALID_BODY.periodStart),
      periodEnd: new Date(VALID_BODY.periodEnd),
    }, { syntheticTx: true });
    await expect(response.json()).resolves.toEqual({
      bilanId: 'bilan-1',
      totalAttemptsInPeriod: 3,
      globalScore: 66.7,
    });
  });

  it('refuses an absent private cookie without calling the generator or transaction', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    jest.mocked(readBoundPrivateV1Session).mockResolvedValueOnce(null);
    expect((await POST(makeRequest(VALID_BODY))).status).toBe(403);
    expect(mockGenerate).not.toHaveBeenCalled(); expect(withV1SessionAuthority).not.toHaveBeenCalled();
  });

  it('maps a domain rejection (e.g. no activity in the period) to its stable public error, without leaking internal detail', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    mockGenerate.mockRejectedValueOnce(new AriaError('BAD_REQUEST', 400, 'internal detail should not leak'));

    const response = await POST(makeRequest(VALID_BODY));
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toContain('BAD_REQUEST');
    expect(body).not.toContain('internal detail');
  });
});
