import { auth } from '@/auth';
import { POST } from '@/app/api/assistante/aria/workshops/attendees/[attendeeId]/attendance/route';
import { markAriaWorkshopAttendance } from '@/lib/aria/application/workshop/mark-attendance';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/workshop/mark-attendance', () => ({
  markAriaWorkshopAttendance: jest.fn(),
}));
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }),
}));

function request(body: unknown) {
  return new Request('http://localhost/api/assistante/aria/workshops/attendees/attendee-1/attendance', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function context(attendeeId = 'attendee-1') {
  return { params: Promise.resolve({ attendeeId }) };
}

describe('POST /api/assistante/aria/workshops/attendees/[attendeeId]/attendance', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when the session role is not ASSISTANTE', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'COACH', id: 'user-1' } });
    const response = await POST(request({ status: 'ATTENDED' }) as never, context());
    expect(response.status).toBe(401);
    expect(markAriaWorkshopAttendance).not.toHaveBeenCalled();
  });

  it('rejects an invalid status without calling the application layer', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ASSISTANTE', id: 'staff-1' } });
    const response = await POST(request({ status: 'MAYBE' }) as never, context());
    expect(response.status).toBe(400);
    expect(markAriaWorkshopAttendance).not.toHaveBeenCalled();
  });

  it('marks the real attendee from the URL with the real requested status', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ASSISTANTE', id: 'staff-1' } });
    (markAriaWorkshopAttendance as jest.Mock).mockResolvedValueOnce({ status: 'ATTENDED' });
    const response = await POST(request({ status: 'ATTENDED' }) as never, context('attendee-42'));
    expect(response.status).toBe(200);
    expect(markAriaWorkshopAttendance).toHaveBeenCalledWith({
      actor: { userId: 'staff-1', role: 'ASSISTANTE' },
      attendeeId: 'attendee-42',
      status: 'ATTENDED',
    });
  });
});
