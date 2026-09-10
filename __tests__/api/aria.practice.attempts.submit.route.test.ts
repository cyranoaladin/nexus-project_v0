import { auth } from '@/auth';
import { POST } from '@/app/api/aria/practice/attempts/[attemptId]/submit/route';
import { submitAriaPracticeAttempt } from '@/lib/aria/application/practice/submit-attempt';
import { AriaError } from '@/lib/aria/errors';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/practice/submit-attempt', () => ({
  submitAriaPracticeAttempt: jest.fn(),
}));
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }),
}));

function request(body: unknown) {
  return new Request('http://localhost/api/aria/practice/attempts/attempt-1/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ attemptId: 'attempt-1' }) };

describe('POST /api/aria/practice/attempts/:attemptId/submit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const response = await POST(request({ payload: { selectedOptionId: 'a' } }) as never, params);
    expect(response.status).toBe(401);
    expect(submitAriaPracticeAttempt).not.toHaveBeenCalled();
  });

  it('rejects an oversized body before submitting', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    const response = await POST(new Request('http://localhost/api/aria/practice/attempts/attempt-1/submit', {
      method: 'POST', body: 'x'.repeat(8_193), headers: { 'content-length': '1' },
    }) as never, params);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'PAYLOAD_TOO_LARGE' },
    });
    expect(submitAriaPracticeAttempt).not.toHaveBeenCalled();
  });

  it.each([
    { payload: { selectedOptionId: 'a' }, studentId: 'forged' },
    { payload: { selectedOptionId: 'a' }, unknownField: true },
  ])('strictly rejects mutation injection: %o', async (body) => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    const response = await POST(request(body) as never, params);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'BAD_REQUEST' } });
    expect(submitAriaPracticeAttempt).not.toHaveBeenCalled();
  });

  it('uses only the authenticated actor and the URL attemptId, and returns the persisted result', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (submitAriaPracticeAttempt as jest.Mock).mockResolvedValueOnce({
      attempt: { id: 'attempt-1', status: 'SUBMITTED' },
      response: { id: 'response-1', payload: { selectedOptionId: 'a' } },
    });
    const response = await POST(request({ payload: { selectedOptionId: 'a' } }) as never, params);
    expect(response.status).toBe(200);
    expect(submitAriaPracticeAttempt).toHaveBeenCalledWith({
      actor: { userId: 'user-1', role: 'ELEVE' },
      attemptId: 'attempt-1',
      payload: { selectedOptionId: 'a' },
    });
    await expect(response.json()).resolves.toEqual({
      attempt: { id: 'attempt-1', status: 'SUBMITTED' },
      response: { id: 'response-1', payload: { selectedOptionId: 'a' } },
    });
  });

  it('maps an IDOR/not-found denial from the application layer to its stable public shape', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (submitAriaPracticeAttempt as jest.Mock).mockRejectedValueOnce(
      new AriaError('BAD_REQUEST', 404, 'Tentative introuvable.'),
    );
    const response = await POST(request({ payload: { selectedOptionId: 'a' } }) as never, params);
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toContain('BAD_REQUEST');
  });

  it('maps an idempotency conflict (already-submitted attempt) to a stable public denial', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (submitAriaPracticeAttempt as jest.Mock).mockRejectedValueOnce(
      new AriaError('IDEMPOTENCY_CONFLICT', 409, 'Cette tentative a déjà été soumise.'),
    );
    const response = await POST(request({ payload: { selectedOptionId: 'a' } }) as never, params);
    expect(response.status).toBe(409);
  });
});
