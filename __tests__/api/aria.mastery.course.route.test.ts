import { auth } from '@/auth';
import { GET } from '@/app/api/aria/mastery/course/route';
import { listAriaCourseMasteryForActor } from '@/lib/aria/application/mastery/list-course-mastery';
import { AriaError } from '@/lib/aria/errors';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/mastery/list-course-mastery', () => ({
  listAriaCourseMasteryForActor: jest.fn(),
}));
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }),
}));

function request(courseKey?: string) {
  const url = courseKey
    ? `http://localhost/api/aria/mastery/course?courseKey=${courseKey}`
    : 'http://localhost/api/aria/mastery/course';
  return new Request(url);
}

describe('GET /api/aria/mastery/course', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const response = await GET(request('eds-maths-premiere') as never);
    expect(response.status).toBe(401);
    expect(listAriaCourseMasteryForActor).not.toHaveBeenCalled();
  });

  it('returns 401 when the session role is not ELEVE', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'COACH', id: 'user-1' } });
    const response = await GET(request('eds-maths-premiere') as never);
    expect(response.status).toBe(401);
    expect(listAriaCourseMasteryForActor).not.toHaveBeenCalled();
  });

  it('rejects a missing courseKey without calling the application layer', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    const response = await GET(request() as never);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'BAD_REQUEST' } });
    expect(listAriaCourseMasteryForActor).not.toHaveBeenCalled();
  });

  it('uses only the authenticated actor and returns the skill list', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (listAriaCourseMasteryForActor as jest.Mock).mockResolvedValueOnce([
      { skillId: 'ALG_SUITE_ARITH', skillLabel: 'Suites arithmétiques', level: 'DEVELOPING', activityId: 'activity-1' },
    ]);
    const response = await GET(request('eds-maths-premiere') as never);
    expect(response.status).toBe(200);
    expect(listAriaCourseMasteryForActor).toHaveBeenCalledWith({
      actor: { userId: 'user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
    await expect(response.json()).resolves.toEqual({
      courseKey: 'eds-maths-premiere',
      skills: [{ skillId: 'ALG_SUITE_ARITH', skillLabel: 'Suites arithmétiques', level: 'DEVELOPING', activityId: 'activity-1' }],
    });
  });

  it('maps an authorization failure from the application layer to its stable public denial', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (listAriaCourseMasteryForActor as jest.Mock).mockRejectedValueOnce(
      new AriaError('NOT_ENTITLED', 403, 'private detail should not leak'),
    );
    const response = await GET(request('eds-maths-premiere') as never);
    expect(response.status).toBe(403);
    const body = await response.text();
    expect(body).toContain('NOT_ENTITLED');
    expect(body).not.toContain('private detail');
  });
});
