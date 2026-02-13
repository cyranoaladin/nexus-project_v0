import { GET, POST, DELETE } from '@/app/api/coaches/availability/route';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    coachAvailability: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
    sessionBooking: { findMany: jest.fn() },
  },
}));

function makeRequest(body?: any, url?: string) {
  return {
    json: async () => body,
    url: url || 'http://localhost:3000/api/coaches/availability',
  } as any;
}

describe('coaches availability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST returns 403 when not coach', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });

    const response = await POST(makeRequest({ type: 'weekly', schedule: [] }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain('Only coaches');
  });

  it('POST weekly creates slots', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'coach-1', role: 'COACH' },
    });
    (prisma.coachAvailability.createMany as jest.Mock).mockResolvedValue({});

    const response = await POST(makeRequest({
      type: 'weekly',
      schedule: [{ dayOfWeek: 1, slots: [{ startTime: '10:00', endTime: '11:00', isAvailable: true }] }],
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('GET returns 401 when unauthenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest(undefined, 'http://localhost:3000/api/coaches/availability'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('DELETE returns 400 when missing id', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'coach-1', role: 'COACH' },
    });

    const response = await DELETE(makeRequest(undefined, 'http://localhost:3000/api/coaches/availability'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Availability ID is required');
  });
});
