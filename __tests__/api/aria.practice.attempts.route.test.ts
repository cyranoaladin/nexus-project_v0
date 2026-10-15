
import { ariaV1Claims } from '../helpers/aria-v1-route-authority';
import { readBoundPrivateV1Session } from '@/lib/auth/private-v1-session';
import { withV1SessionAuthority } from '@/lib/auth/v1-session-authority';
jest.mock('@/lib/auth/private-v1-session', () => ({ readBoundPrivateV1Session: jest.fn(async () => require('../helpers/aria-v1-route-authority').ariaV1Claims) }));
jest.mock('@/lib/auth/v1-session-authority', () => ({ withV1SessionAuthority: jest.fn(require('../helpers/aria-v1-route-authority').syntheticV1Authority) }));
jest.mock('@/lib/aria/infrastructure/prisma/actor-authority', () => ({ lockV1AriaSubject: jest.fn(async () => undefined) }));
jest.mock('@/lib/aria/infrastructure/prisma/activity-repository', () => ({ makePrismaActivityRepository: jest.fn(() => require('../helpers/aria-v1-route-authority').ariaV1Repository) }));
jest.mock('@/lib/aria/application/practice/authorize', () => ({ authorizePracticeCourseForActor: jest.fn(async () => ({ assertCurrent: jest.fn() })), authorizePracticeCorrectionForActor: jest.fn(async () => ({ assertCurrent: jest.fn() })) }));
import { auth } from '@/auth';
import { POST } from '@/app/api/aria/practice/attempts/route';
import { startAriaPracticeAttempt } from '@/lib/aria/application/practice/start-attempt';
import { AriaError } from '@/lib/aria/errors';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/practice/start-attempt', () => {
  const operation = jest.fn();
  return { startAriaPracticeAttempt: operation, makeStartAriaPracticeAttempt: jest.fn(() => operation) };
});
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }),
}));

function request(body: unknown) {
  return new Request('http://localhost/api/aria/practice/attempts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/aria/practice/attempts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refuses an absent original cookie before any authority transaction or application operation', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    jest.mocked(readBoundPrivateV1Session).mockResolvedValueOnce(null);
    const response = await POST(request({ activityId: 'activity-1' }) as never);
    expect(response.status).toBe(403);
    expect(withV1SessionAuthority).not.toHaveBeenCalled();
    expect(startAriaPracticeAttempt).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const response = await POST(request({ activityId: 'activity-1' }) as never);
    expect(response.status).toBe(401);
    expect(startAriaPracticeAttempt).not.toHaveBeenCalled();
  });

  it('rejects an oversized body before starting an attempt', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    const response = await POST(new Request('http://localhost/api/aria/practice/attempts', {
      method: 'POST', body: 'x'.repeat(8_193), headers: { 'content-length': '1' },
    }) as never);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'PAYLOAD_TOO_LARGE' },
    });
    expect(startAriaPracticeAttempt).not.toHaveBeenCalled();
  });

  it.each([
    { activityId: 'activity-1', studentId: 'forged' },
    { activityId: 'activity-1', unknownField: true },
    {},
  ])('strictly rejects mutation injection: %o', async (body) => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    const response = await POST(request(body) as never);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'BAD_REQUEST' } });
    expect(startAriaPracticeAttempt).not.toHaveBeenCalled();
  });

  it('uses only the authenticated actor and returns the started/resumed attempt', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (startAriaPracticeAttempt as jest.Mock).mockResolvedValueOnce({
      id: 'attempt-1', status: 'IN_PROGRESS',
    });
    const response = await POST(request({ activityId: 'activity-1' }) as never);
    expect(response.status).toBe(200);
    expect(startAriaPracticeAttempt).toHaveBeenCalledWith({
      actor: ariaV1Claims,
      activityId: 'activity-1',
    });
    await expect(response.json()).resolves.toEqual({
      attempt: { id: 'attempt-1', status: 'IN_PROGRESS' },
    });
  });

  it('maps an authorization failure from the application layer to its stable public denial', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (startAriaPracticeAttempt as jest.Mock).mockRejectedValueOnce(
      new AriaError('NOT_ENTITLED', 403, 'private detail should not leak'),
    );
    const response = await POST(request({ activityId: 'activity-1' }) as never);
    expect(response.status).toBe(403);
    const body = await response.text();
    expect(body).toContain('NOT_ENTITLED');
    expect(body).not.toContain('private detail');
  });
});
