
import { ariaV1Claims } from '../helpers/aria-v1-route-authority';
import { readBoundPrivateV1Session } from '@/lib/auth/private-v1-session';
import { withV1SessionAuthority } from '@/lib/auth/v1-session-authority';
jest.mock('@/lib/auth/private-v1-session', () => ({ readBoundPrivateV1Session: jest.fn(async () => require('../helpers/aria-v1-route-authority').ariaV1Claims) }));
jest.mock('@/lib/auth/v1-session-authority', () => ({ withV1SessionAuthority: jest.fn(require('../helpers/aria-v1-route-authority').syntheticV1Authority) }));
jest.mock('@/lib/aria/infrastructure/prisma/actor-authority', () => ({ lockV1AriaSubject: jest.fn(async () => undefined) }));
jest.mock('@/lib/aria/infrastructure/prisma/activity-repository', () => ({ makePrismaActivityRepository: jest.fn(() => require('../helpers/aria-v1-route-authority').ariaV1Repository) }));
jest.mock('@/lib/aria/application/practice/authorize', () => ({ authorizePracticeCourseForActor: jest.fn(async () => ({ assertCurrent: jest.fn() })), authorizePracticeCorrectionForActor: jest.fn(async () => ({ assertCurrent: jest.fn() })) }));
import { auth } from '@/auth';
import { POST } from '@/app/api/aria/practice/attempts/[attemptId]/correct/route';
import { correctAriaPracticeAttempt } from '@/lib/aria/application/practice/correct-attempt';
import { AriaError } from '@/lib/aria/errors';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/practice/correct-attempt', () => {
  const operation = jest.fn();
  return { correctAriaPracticeAttempt: operation, makeCorrectAriaPracticeAttempt: jest.fn((dependencies: { present: (result: unknown) => void }) => async (input: unknown) => {
    const result = await operation(input); dependencies.present(result); return result;
  }) };
});
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

  it('refuses an absent original cookie before any authority transaction or application operation', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    jest.mocked(readBoundPrivateV1Session).mockResolvedValueOnce(null);
    const response = await POST(request() as never, params);
    expect(response.status).toBe(403);
    expect(withV1SessionAuthority).not.toHaveBeenCalled();
    expect(correctAriaPracticeAttempt).not.toHaveBeenCalled();
  });

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
      actor: ariaV1Claims,
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
