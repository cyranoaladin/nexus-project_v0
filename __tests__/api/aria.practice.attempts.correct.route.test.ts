import { auth } from '@/auth';
import { POST } from '@/app/api/aria/practice/attempts/[attemptId]/correct/route';
import { correctAriaPracticeAttempt } from '@/lib/aria/application/practice/correct-attempt';
import { AriaError } from '@/lib/aria/errors';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/practice/correct-attempt', () => ({
  correctAriaPracticeAttempt: jest.fn(),
}));
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }),
}));

function request() {
  return new Request('http://localhost/api/aria/practice/attempts/attempt-1/correct', {
    method: 'POST',
  });
}

const params = { params: Promise.resolve({ attemptId: 'attempt-1' }) };

describe('POST /api/aria/practice/attempts/:attemptId/correct', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const response = await POST(request() as never, params);
    expect(response.status).toBe(401);
    expect(correctAriaPracticeAttempt).not.toHaveBeenCalled();
  });

  it('returns 401 for a non-ELEVE role', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'COACH', id: 'user-1' } });
    const response = await POST(request() as never, params);
    expect(response.status).toBe(401);
    expect(correctAriaPracticeAttempt).not.toHaveBeenCalled();
  });

  it('uses only the authenticated actor and the URL attemptId, and returns the public result shape', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    const correctedAt = new Date('2026-09-10T12:00:00.000Z');
    (correctAriaPracticeAttempt as jest.Mock).mockResolvedValueOnce({
      result: {
        id: 'result-1',
        attemptId: 'attempt-1',
        outcome: 'CORRECT',
        feedback: { outcome: 'CORRECT', summary: 'Bien.', strengths: [], improvements: [] },
        correctedAt,
      },
      alreadyCorrected: false,
    });
    const response = await POST(request() as never, params);
    expect(response.status).toBe(200);
    expect(correctAriaPracticeAttempt).toHaveBeenCalledWith({
      actor: { userId: 'user-1', role: 'ELEVE' },
      attemptId: 'attempt-1',
    });
    await expect(response.json()).resolves.toEqual({
      result: {
        id: 'result-1',
        attemptId: 'attempt-1',
        outcome: 'CORRECT',
        feedback: { outcome: 'CORRECT', summary: 'Bien.', strengths: [], improvements: [] },
        correctedAt: correctedAt.toISOString(),
      },
      alreadyCorrected: false,
    });
  });

  it('reports idempotent replay via alreadyCorrected without leaking the correctionRubric', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (correctAriaPracticeAttempt as jest.Mock).mockResolvedValueOnce({
      result: {
        id: 'result-1',
        attemptId: 'attempt-1',
        outcome: 'CORRECT',
        feedback: { outcome: 'CORRECT', summary: 'Bien.', strengths: [], improvements: [] },
        correctedAt: new Date('2026-09-10T12:00:00.000Z'),
      },
      alreadyCorrected: true,
    });
    const response = await POST(request() as never, params);
    const body = await response.json();
    expect(body.alreadyCorrected).toBe(true);
    expect(body.result.correctionRubric).toBeUndefined();
  });

  it('maps an IDOR/not-found denial from the application layer to its stable public shape', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (correctAriaPracticeAttempt as jest.Mock).mockRejectedValueOnce(
      new AriaError('BAD_REQUEST', 404, 'Tentative introuvable.'),
    );
    const response = await POST(request() as never, params);
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toContain('BAD_REQUEST');
  });

  it('maps a not-yet-submitted attempt conflict to a stable public denial', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (correctAriaPracticeAttempt as jest.Mock).mockRejectedValueOnce(
      new AriaError('IDEMPOTENCY_CONFLICT', 409, 'Cette tentative n’a pas encore été soumise.', {
        reasonCode: 'ARIA_ATTEMPT_NOT_SUBMITTED',
      }),
    );
    const response = await POST(request() as never, params);
    expect(response.status).toBe(409);
  });

  it('maps a tier-entitlement denial to a stable public shape', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (correctAriaPracticeAttempt as jest.Mock).mockRejectedValueOnce(
      new AriaError('NOT_ENTITLED', 403, 'La formule ARIA actuelle ne comprend pas la correction des exercices.'),
    );
    const response = await POST(request() as never, params);
    expect(response.status).toBe(403);
  });
});
