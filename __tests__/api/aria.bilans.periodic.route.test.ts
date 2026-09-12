import { NextRequest } from 'next/server';
import { POST } from '@/app/api/aria/bilans/periodic/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { generateAndPersistAriaPeriodicBilan } from '@/lib/aria/bilans/periodic/generate-and-persist-periodic-bilan';
import { AriaError } from '@/lib/aria/errors';

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
  });

  it('requires ADMIN, ASSISTANTE, or COACH', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    mockGenerate.mockResolvedValueOnce({ bilanId: 'bilan-1', report: { totalAttemptsInPeriod: 3, globalScore: 66.7 } });
    await POST(makeRequest(VALID_BODY));
    expect(mockRequireAnyRole).toHaveBeenCalledWith(['ADMIN', 'ASSISTANTE', 'COACH']);
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

  it('creates the bilan and returns its id and computed scores on success', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    mockGenerate.mockResolvedValueOnce({ bilanId: 'bilan-1', report: { totalAttemptsInPeriod: 3, globalScore: 66.7 } });

    const response = await POST(makeRequest(VALID_BODY));
    expect(response.status).toBe(200);
    expect(mockGenerate).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseKey: 'eds-maths-premiere',
      periodStart: new Date(VALID_BODY.periodStart),
      periodEnd: new Date(VALID_BODY.periodEnd),
    });
    await expect(response.json()).resolves.toEqual({
      bilanId: 'bilan-1',
      totalAttemptsInPeriod: 3,
      globalScore: 66.7,
    });
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
