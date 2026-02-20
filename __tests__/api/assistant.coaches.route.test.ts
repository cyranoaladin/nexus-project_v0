import { GET, POST } from '@/app/api/assistant/coaches/route';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    coachProfile: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

function makeRequest(body?: any) {
  return {
    json: async () => body,
  } as any;
}

describe('assistant coaches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET returns 401 when not assistant', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('GET returns formatted coaches', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.coachProfile.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'coach-1',
        userId: 'user-1',
        user: { firstName: 'Coach', lastName: 'One', email: 'c@test.com' },
        pseudonym: 'CoachX',
        tag: 'Math',
        description: 'Desc',
        philosophy: 'Phil',
        expertise: 'Expert',
        subjects: '[]',
        availableOnline: true,
        availableInPerson: true,
        sessions: [{ id: 's1' }],
        createdAt: new Date('2025-01-01'),
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].todaySessions).toBe(1);
  });

  it('POST validates required fields', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });

    const response = await POST(makeRequest({ firstName: 'A' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Missing required fields');
  });

  it('POST rejects existing email', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });

    const response = await POST(
      makeRequest({ firstName: 'A', lastName: 'B', email: 'c@test.com', password: 'pw', pseudonym: 'CoachX' })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Email already exists');
  });

  it('POST creates coach via transaction', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = {
        user: {
          create: jest.fn().mockResolvedValue({ id: 'user-1', firstName: 'A', lastName: 'B', email: 'c@test.com' }),
        },
        coachProfile: {
          create: jest.fn().mockResolvedValue({
            id: 'coach-1',
            pseudonym: 'CoachX',
            tag: 'Math',
            user: { firstName: 'A', lastName: 'B', email: 'c@test.com' },
          }),
        },
      };
      return cb(tx);
    });

    const response = await POST(
      makeRequest({
        firstName: 'A',
        lastName: 'B',
        email: 'c@test.com',
        password: 'pw',
        pseudonym: 'CoachX',
        tag: 'Math',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.coach.id).toBe('coach-1');
  });
});
