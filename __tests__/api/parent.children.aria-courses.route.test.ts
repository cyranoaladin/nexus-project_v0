import { auth } from '@/auth';
import { GET } from '@/app/api/parent/children/[studentId]/aria/courses/route';
import { listAriaCoursesForParentChild } from '@/lib/aria/application/mastery/list-courses-for-parent';
import { AriaError } from '@/lib/aria/errors';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/mastery/list-courses-for-parent', () => ({
  listAriaCoursesForParentChild: jest.fn(),
}));
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }),
}));

function request() {
  return new Request('http://localhost/api/parent/children/student-1/aria/courses');
}

function context(studentId = 'student-1') {
  return { params: Promise.resolve({ studentId }) };
}

describe('GET /api/parent/children/[studentId]/aria/courses', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const response = await GET(request() as never, context());
    expect(response.status).toBe(401);
    expect(listAriaCoursesForParentChild).not.toHaveBeenCalled();
  });

  it('returns 401 when the session role is not PARENT', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    const response = await GET(request() as never, context());
    expect(response.status).toBe(401);
    expect(listAriaCoursesForParentChild).not.toHaveBeenCalled();
  });

  it('uses only the authenticated actor and the URL studentId, and returns the real course list', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'PARENT', id: 'parent-1' } });
    (listAriaCoursesForParentChild as jest.Mock).mockResolvedValueOnce([
      { courseKey: 'eds-maths-premiere', label: 'Mathématiques' },
    ]);
    const response = await GET(request() as never, context('student-42'));
    expect(response.status).toBe(200);
    expect(listAriaCoursesForParentChild).toHaveBeenCalledWith({
      actor: { userId: 'parent-1', role: 'PARENT' },
      studentId: 'student-42',
    });
    await expect(response.json()).resolves.toEqual({
      studentId: 'student-42',
      courses: [{ courseKey: 'eds-maths-premiere', label: 'Mathématiques' }],
    });
  });

  it('maps an authorization failure from the application layer to its stable public denial (e.g. a different family’s child)', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'PARENT', id: 'parent-1' } });
    (listAriaCoursesForParentChild as jest.Mock).mockRejectedValueOnce(
      new AriaError('NOT_ENROLLED', 403, 'private detail should not leak'),
    );
    const response = await GET(request() as never, context());
    expect(response.status).toBe(403);
    const body = await response.text();
    expect(body).toContain('NOT_ENROLLED');
    expect(body).not.toContain('private detail');
  });
});
