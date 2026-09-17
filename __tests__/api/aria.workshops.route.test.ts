import { auth } from '@/auth';
import { GET } from '@/app/api/aria/workshops/route';
import { listAriaWorkshopsForActor } from '@/lib/aria/application/workshop/list-workshops-for-student';
import { AriaError } from '@/lib/aria/errors';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/workshop/list-workshops-for-student', () => ({
  listAriaWorkshopsForActor: jest.fn(),
}));
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }),
}));

function request(courseKey?: string) {
  const url = courseKey
    ? `http://localhost/api/aria/workshops?courseKey=${courseKey}`
    : 'http://localhost/api/aria/workshops';
  return new Request(url);
}

describe('GET /api/aria/workshops', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const response = await GET(request('eds-maths-premiere') as never);
    expect(response.status).toBe(401);
    expect(listAriaWorkshopsForActor).not.toHaveBeenCalled();
  });

  it('returns 401 when the session role is not ELEVE', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'PARENT', id: 'user-1' } });
    const response = await GET(request('eds-maths-premiere') as never);
    expect(response.status).toBe(401);
  });

  it('rejects a missing courseKey without calling the application layer', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'student-1' } });
    const response = await GET(request() as never);
    expect(response.status).toBe(400);
    expect(listAriaWorkshopsForActor).not.toHaveBeenCalled();
  });

  it('returns the real workshop list for the authenticated actor', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'student-1' } });
    (listAriaWorkshopsForActor as jest.Mock).mockResolvedValueOnce([
      { id: 'w1', title: 'Atelier', scheduledDate: new Date('2026-10-01'), startTime: '14:00', endTime: '15:00', location: null, coachName: null, myAttendanceStatus: null },
    ]);
    const response = await GET(request('eds-maths-premiere') as never);
    expect(response.status).toBe(200);
    expect(listAriaWorkshopsForActor).toHaveBeenCalledWith({
      actor: { userId: 'student-1', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    });
  });

  it('maps an authorization failure to its stable public denial', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'student-1' } });
    (listAriaWorkshopsForActor as jest.Mock).mockRejectedValueOnce(
      new AriaError('NOT_ENTITLED', 403, 'private detail'),
    );
    const response = await GET(request('eds-maths-premiere') as never);
    expect(response.status).toBe(403);
    const body = await response.text();
    expect(body).toContain('NOT_ENTITLED');
    expect(body).not.toContain('private detail');
  });
});
