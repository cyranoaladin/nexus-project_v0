import { auth } from '@/auth';
import { GET } from '@/app/api/parent/children/[studentId]/aria/next-best-action/route';
import { getAriaNextBestActionForParent } from '@/lib/aria/application/mastery/get-next-best-action-for-parent';
import { AriaError } from '@/lib/aria/errors';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/mastery/get-next-best-action-for-parent', () => ({
  getAriaNextBestActionForParent: jest.fn(),
}));
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }),
}));

function request(courseKey?: string) {
  const url = courseKey
    ? `http://localhost/api/parent/children/student-1/aria/next-best-action?courseKey=${courseKey}`
    : 'http://localhost/api/parent/children/student-1/aria/next-best-action';
  return new Request(url);
}

function context(studentId = 'student-1') {
  return { params: Promise.resolve({ studentId }) };
}

describe('GET /api/parent/children/[studentId]/aria/next-best-action', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const response = await GET(request('eds-maths-premiere') as never, context());
    expect(response.status).toBe(401);
    expect(getAriaNextBestActionForParent).not.toHaveBeenCalled();
  });

  it('returns 401 when the session role is not PARENT', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    const response = await GET(request('eds-maths-premiere') as never, context());
    expect(response.status).toBe(401);
    expect(getAriaNextBestActionForParent).not.toHaveBeenCalled();
  });

  it('rejects a missing courseKey without calling the application layer', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'PARENT', id: 'parent-1' } });
    const response = await GET(request() as never, context());
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'BAD_REQUEST' } });
    expect(getAriaNextBestActionForParent).not.toHaveBeenCalled();
  });

  it('uses only the authenticated actor and the URL studentId, and returns the real recommendation (or null)', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'PARENT', id: 'parent-1' } });
    (getAriaNextBestActionForParent as jest.Mock).mockResolvedValueOnce({
      courseKey: 'eds-maths-premiere',
      skillId: 'ALG_SUITE_ARITH',
      skillLabel: 'Suites arithmétiques',
      level: 'NOT_STARTED',
      activityId: 'activity-1',
    });
    const response = await GET(request('eds-maths-premiere') as never, context('student-42'));
    expect(response.status).toBe(200);
    expect(getAriaNextBestActionForParent).toHaveBeenCalledWith({
      actor: { userId: 'parent-1', role: 'PARENT' },
      studentId: 'student-42',
      courseKey: 'eds-maths-premiere',
    });
    await expect(response.json()).resolves.toEqual({
      studentId: 'student-42',
      courseKey: 'eds-maths-premiere',
      action: {
        courseKey: 'eds-maths-premiere',
        skillId: 'ALG_SUITE_ARITH',
        skillLabel: 'Suites arithmétiques',
        level: 'NOT_STARTED',
        activityId: 'activity-1',
      },
    });
  });

  it('maps an authorization failure from the application layer to its stable public denial (e.g. a different family’s child)', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'PARENT', id: 'parent-1' } });
    (getAriaNextBestActionForParent as jest.Mock).mockRejectedValueOnce(
      new AriaError('NOT_ENROLLED', 403, 'private detail should not leak'),
    );
    const response = await GET(request('eds-maths-premiere') as never, context());
    expect(response.status).toBe(403);
    const body = await response.text();
    expect(body).toContain('NOT_ENROLLED');
    expect(body).not.toContain('private detail');
  });
});
