import { GET } from '@/app/api/coaches/available/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    coachProfile: { findMany: jest.fn() },
  },
}));

function makeRequest(url: string) {
  return { url } as any;
}

describe('GET /api/coaches/available', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not allowed', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest('http://localhost:3000/api/coaches/available'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns coaches list', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });
    (prisma.coachProfile.findMany as jest.Mock).mockResolvedValue([
      {
        userId: 'coach-1',
        user: {
          firstName: 'Coach',
          lastName: 'One',
          coachAvailabilities: [],
        },
        subjects: '["MATHEMATIQUES"]',
        description: 'Bio',
        philosophy: 'Phil',
        expertise: 'Exp',
      },
    ]);

    const response = await GET(makeRequest('http://localhost:3000/api/coaches/available?subject=MATHEMATIQUES'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.coaches).toHaveLength(1);
  });
});
