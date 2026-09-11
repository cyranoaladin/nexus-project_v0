import { auth } from '@/auth';
import { GET } from '@/app/api/aria/mastery/route';
import { getAriaSkillMasteryForActor } from '@/lib/aria/application/mastery/get-mastery';
import { AriaError } from '@/lib/aria/errors';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/mastery/get-mastery', () => ({
  getAriaSkillMasteryForActor: jest.fn(),
}));
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }),
}));

function request(courseKey?: string, skillId?: string) {
  const params = new URLSearchParams();
  if (courseKey) params.set('courseKey', courseKey);
  if (skillId) params.set('skillId', skillId);
  const query = params.toString();
  return new Request(`http://localhost/api/aria/mastery${query ? `?${query}` : ''}`);
}

describe('GET /api/aria/mastery', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const response = await GET(request('eds-maths-premiere', 'ALG_SUITE_ARITH') as never);
    expect(response.status).toBe(401);
    expect(getAriaSkillMasteryForActor).not.toHaveBeenCalled();
  });

  it('returns 401 when the session role is not ELEVE', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'COACH', id: 'user-1' } });
    const response = await GET(request('eds-maths-premiere', 'ALG_SUITE_ARITH') as never);
    expect(response.status).toBe(401);
    expect(getAriaSkillMasteryForActor).not.toHaveBeenCalled();
  });

  it('rejects a missing courseKey without calling the application layer', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    const response = await GET(request(undefined, 'ALG_SUITE_ARITH') as never);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'BAD_REQUEST' } });
    expect(getAriaSkillMasteryForActor).not.toHaveBeenCalled();
  });

  it('rejects a missing skillId without calling the application layer', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    const response = await GET(request('eds-maths-premiere') as never);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'BAD_REQUEST' } });
    expect(getAriaSkillMasteryForActor).not.toHaveBeenCalled();
  });

  it('uses only the authenticated actor and returns the computed mastery', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (getAriaSkillMasteryForActor as jest.Mock).mockResolvedValueOnce({
      courseKey: 'eds-maths-premiere',
      skillId: 'ALG_SUITE_ARITH',
      level: 'PROFICIENT',
      attemptsConsidered: 2,
    });
    const response = await GET(request('eds-maths-premiere', 'ALG_SUITE_ARITH') as never);
    expect(response.status).toBe(200);
    expect(getAriaSkillMasteryForActor).toHaveBeenCalledWith({
      actor: { userId: 'user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      skillId: 'ALG_SUITE_ARITH',
    });
    await expect(response.json()).resolves.toEqual({
      courseKey: 'eds-maths-premiere',
      skillId: 'ALG_SUITE_ARITH',
      level: 'PROFICIENT',
      attemptsConsidered: 2,
    });
  });

  it('maps an authorization failure from the application layer to its stable public denial', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (getAriaSkillMasteryForActor as jest.Mock).mockRejectedValueOnce(
      new AriaError('NOT_ENTITLED', 403, 'private detail should not leak'),
    );
    const response = await GET(request('eds-maths-premiere', 'ALG_SUITE_ARITH') as never);
    expect(response.status).toBe(403);
    const body = await response.text();
    expect(body).toContain('NOT_ENTITLED');
    expect(body).not.toContain('private detail');
  });
});
