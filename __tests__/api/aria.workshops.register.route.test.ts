import { auth } from '@/auth';
import { POST } from '@/app/api/aria/workshops/[workshopId]/register/route';
import { registerForAriaWorkshop } from '@/lib/aria/application/workshop/register-for-workshop';
import { AriaError } from '@/lib/aria/errors';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/workshop/register-for-workshop', () => ({
  registerForAriaWorkshop: jest.fn(),
}));
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }),
}));

function request() {
  return new Request('http://localhost/api/aria/workshops/workshop-1/register', { method: 'POST' });
}

function context(workshopId = 'workshop-1') {
  return { params: Promise.resolve({ workshopId }) };
}

describe('POST /api/aria/workshops/[workshopId]/register', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const response = await POST(request() as never, context());
    expect(response.status).toBe(401);
    expect(registerForAriaWorkshop).not.toHaveBeenCalled();
  });

  it('returns 401 when the session role is not ELEVE', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ASSISTANTE', id: 'user-1' } });
    const response = await POST(request() as never, context());
    expect(response.status).toBe(401);
  });

  it('registers the authenticated student for the real workshop from the URL', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'student-1' } });
    (registerForAriaWorkshop as jest.Mock).mockResolvedValueOnce({ status: 'REGISTERED' });
    const response = await POST(request() as never, context('workshop-42'));
    expect(response.status).toBe(200);
    expect(registerForAriaWorkshop).toHaveBeenCalledWith({
      actor: { userId: 'student-1', role: 'ELEVE' },
      workshopSessionId: 'workshop-42',
    });
  });

  it('maps a full-capacity rejection to its stable public denial', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'student-1' } });
    (registerForAriaWorkshop as jest.Mock).mockRejectedValueOnce(
      new AriaError('BAD_REQUEST', 409, 'Cet atelier est complet.'),
    );
    const response = await POST(request() as never, context());
    expect(response.status).toBe(400);
  });
});
