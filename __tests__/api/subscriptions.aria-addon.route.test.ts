import { auth } from '@/auth';
import { POST } from '@/app/api/subscriptions/aria-addon/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findFirst: jest.fn() },
  },
}));

function makeRequest(body?: any) {
  return {
    json: async () => body,
  } as any;
}

describe('POST /api/subscriptions/aria-addon', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not parent', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain('Accès');
  });

  it('returns 400 when addon invalid', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });

    const response = await POST(makeRequest({ studentId: 'student-1', addon: 'INVALID' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Add-on');
  });

  it('returns 404 when student not found', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ studentId: 'student-1', addon: 'MATIERE_SUPPLEMENTAIRE' }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain('Élève');
  });

  it('returns 400 when no active subscription', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({
      subscriptions: [],
    });

    const response = await POST(makeRequest({ studentId: 'student-1', addon: 'MATIERE_SUPPLEMENTAIRE' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Aucun abonnement');
  });
});
