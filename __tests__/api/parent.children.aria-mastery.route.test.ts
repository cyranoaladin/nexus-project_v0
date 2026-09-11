import { auth } from '@/auth';
import { GET } from '@/app/api/parent/children/[studentId]/aria/mastery/route';
import { listAriaCourseMasteryForParent } from '@/lib/aria/application/mastery/list-course-mastery-for-parent';
import { AriaError } from '@/lib/aria/errors';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/mastery/list-course-mastery-for-parent', () => ({
  listAriaCourseMasteryForParent: jest.fn(),
}));
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }),
}));

function request(courseKey?: string) {
  const url = courseKey
    ? `http://localhost/api/parent/children/student-1/aria/mastery?courseKey=${courseKey}`
    : 'http://localhost/api/parent/children/student-1/aria/mastery';
  return new Request(url);
}

function context(studentId = 'student-1') {
  return { params: Promise.resolve({ studentId }) };
}

describe('GET /api/parent/children/[studentId]/aria/mastery', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const response = await GET(request('eds-maths-premiere') as never, context());
    expect(response.status).toBe(401);
    expect(listAriaCourseMasteryForParent).not.toHaveBeenCalled();
  });

  it('returns 401 when the session role is not PARENT', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    const response = await GET(request('eds-maths-premiere') as never, context());
    expect(response.status).toBe(401);
    expect(listAriaCourseMasteryForParent).not.toHaveBeenCalled();
  });

  it('rejects a missing courseKey without calling the application layer', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'PARENT', id: 'parent-1' } });
    const response = await GET(request() as never, context());
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'BAD_REQUEST' } });
    expect(listAriaCourseMasteryForParent).not.toHaveBeenCalled();
  });

  it('uses only the authenticated actor and the URL studentId, and returns the skill list', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'PARENT', id: 'parent-1' } });
    (listAriaCourseMasteryForParent as jest.Mock).mockResolvedValueOnce([
      { skillId: 'ALG_SUITE_ARITH', skillLabel: 'Suites arithmétiques', level: 'DEVELOPING', activityId: 'activity-1' },
    ]);
    const response = await GET(request('eds-maths-premiere') as never, context('student-42'));
    expect(response.status).toBe(200);
    expect(listAriaCourseMasteryForParent).toHaveBeenCalledWith({
      actor: { userId: 'parent-1', role: 'PARENT' },
      studentId: 'student-42',
      courseKey: 'eds-maths-premiere',
    });
    await expect(response.json()).resolves.toEqual({
      studentId: 'student-42',
      courseKey: 'eds-maths-premiere',
      skills: [{ skillId: 'ALG_SUITE_ARITH', skillLabel: 'Suites arithmétiques', level: 'DEVELOPING', activityId: 'activity-1' }],
    });
  });

  it('maps an authorization failure from the application layer to its stable public denial (e.g. a different family’s child)', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'PARENT', id: 'parent-1' } });
    (listAriaCourseMasteryForParent as jest.Mock).mockRejectedValueOnce(
      new AriaError('NOT_ENROLLED', 403, 'private detail should not leak'),
    );
    const response = await GET(request('eds-maths-premiere') as never, context());
    expect(response.status).toBe(403);
    const body = await response.text();
    expect(body).toContain('NOT_ENROLLED');
    expect(body).not.toContain('private detail');
  });
});
