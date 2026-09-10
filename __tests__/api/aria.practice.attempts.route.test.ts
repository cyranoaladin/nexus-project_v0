import { auth } from '@/auth';
import { POST } from '@/app/api/aria/practice/attempts/route';
import { startAriaPracticeAttempt } from '@/lib/aria/application/practice/start-attempt';
import { AriaError } from '@/lib/aria/errors';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/practice/start-attempt', () => ({
  startAriaPracticeAttempt: jest.fn(),
}));
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
      actor: { userId: 'user-1', role: 'ELEVE' },
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
