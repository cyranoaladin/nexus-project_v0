import { auth } from '@/auth';
import { GET } from '@/app/api/aria/practice/activities/route';
import { listAriaPracticeActivitiesForActor } from '@/lib/aria/application/practice/list-activities';
import { AriaError } from '@/lib/aria/errors';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/practice/list-activities', () => ({
  listAriaPracticeActivitiesForActor: jest.fn(),
}));
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }),
}));

function request(courseKey?: string) {
  const url = courseKey
    ? `http://localhost/api/aria/practice/activities?courseKey=${courseKey}`
    : 'http://localhost/api/aria/practice/activities';
  return new Request(url);
}

describe('GET /api/aria/practice/activities', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const response = await GET(request('eds-maths-premiere') as never);
    expect(response.status).toBe(401);
    expect(listAriaPracticeActivitiesForActor).not.toHaveBeenCalled();
  });

  it('returns 401 when the session role is not ELEVE', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'COACH', id: 'user-1' } });
    const response = await GET(request('eds-maths-premiere') as never);
    expect(response.status).toBe(401);
    expect(listAriaPracticeActivitiesForActor).not.toHaveBeenCalled();
  });

  it('rejects a missing courseKey without calling the application layer', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    const response = await GET(request() as never);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'BAD_REQUEST' },
    });
    expect(listAriaPracticeActivitiesForActor).not.toHaveBeenCalled();
  });

  it('uses only the authenticated actor and returns the listed activities', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (listAriaPracticeActivitiesForActor as jest.Mock).mockResolvedValueOnce([
      { activityId: 'activity-1', courseKey: 'eds-maths-premiere' },
    ]);
    const response = await GET(request('eds-maths-premiere') as never);
    expect(response.status).toBe(200);
    expect(listAriaPracticeActivitiesForActor).toHaveBeenCalledWith({
      actor: { userId: 'user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
    await expect(response.json()).resolves.toEqual({
      courseKey: 'eds-maths-premiere',
      activities: [{ activityId: 'activity-1', courseKey: 'eds-maths-premiere' }],
    });
  });

  it('maps an authorization failure from the application layer to its stable public denial', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (listAriaPracticeActivitiesForActor as jest.Mock).mockRejectedValueOnce(
      new AriaError('NOT_ENTITLED', 403, 'private detail should not leak'),
    );
    const response = await GET(request('eds-maths-premiere') as never);
    expect(response.status).toBe(403);
    const body = await response.text();
    expect(body).toContain('NOT_ENTITLED');
    expect(body).not.toContain('private detail');
  });
});
