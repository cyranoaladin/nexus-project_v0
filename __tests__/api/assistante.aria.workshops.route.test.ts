import { auth } from '@/auth';
import { GET, POST } from '@/app/api/assistante/aria/workshops/route';
import { scheduleAriaWorkshopSession } from '@/lib/aria/application/workshop/schedule-workshop';
import { listAriaWorkshopsForStaff } from '@/lib/aria/application/workshop/list-workshops-for-staff';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/workshop/schedule-workshop', () => ({
  scheduleAriaWorkshopSession: jest.fn(),
}));
jest.mock('@/lib/aria/application/workshop/list-workshops-for-staff', () => ({
  listAriaWorkshopsForStaff: jest.fn(),
}));
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }),
}));

function postRequest(body: unknown) {
  return new Request('http://localhost/api/assistante/aria/workshops', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const VALID_BODY = {
  courseKey: 'eds-maths-premiere',
  title: 'Atelier révisions',
  scheduledDate: '2026-10-01T00:00:00.000Z',
  startTime: '14:00',
  endTime: '15:00',
  modality: 'ONLINE',
};

describe('POST /api/assistante/aria/workshops', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const response = await POST(postRequest(VALID_BODY) as never);
    expect(response.status).toBe(401);
    expect(scheduleAriaWorkshopSession).not.toHaveBeenCalled();
  });

  it('returns 401 when the session role is not ASSISTANTE', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    const response = await POST(postRequest(VALID_BODY) as never);
    expect(response.status).toBe(401);
  });

  it('rejects a malformed body without calling the application layer', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ASSISTANTE', id: 'staff-1' } });
    const response = await POST(postRequest({ courseKey: 'eds-maths-premiere' }) as never);
    expect(response.status).toBe(400);
    expect(scheduleAriaWorkshopSession).not.toHaveBeenCalled();
  });

  it('schedules a real workshop from a valid body', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ASSISTANTE', id: 'staff-1' } });
    (scheduleAriaWorkshopSession as jest.Mock).mockResolvedValueOnce({ id: 'w1', ...VALID_BODY, status: 'SCHEDULED' });
    const response = await POST(postRequest(VALID_BODY) as never);
    expect(response.status).toBe(200);
    expect(scheduleAriaWorkshopSession).toHaveBeenCalledWith(
      expect.objectContaining({ actor: { userId: 'staff-1', role: 'ASSISTANTE' }, courseKey: 'eds-maths-premiere' }),
    );
  });
});

describe('GET /api/assistante/aria/workshops', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when the session role is not ASSISTANTE', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'COACH', id: 'user-1' } });
    const response = await GET(new Request('http://localhost/api/assistante/aria/workshops') as never);
    expect(response.status).toBe(401);
    expect(listAriaWorkshopsForStaff).not.toHaveBeenCalled();
  });

  it('returns the real workshop roster for staff', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ASSISTANTE', id: 'staff-1' } });
    (listAriaWorkshopsForStaff as jest.Mock).mockResolvedValueOnce([]);
    const response = await GET(new Request('http://localhost/api/assistante/aria/workshops') as never);
    expect(response.status).toBe(200);
    expect(listAriaWorkshopsForStaff).toHaveBeenCalledWith({ actor: { userId: 'staff-1', role: 'ASSISTANTE' }, courseKey: undefined });
  });
});
