import { PUT, DELETE } from '@/app/api/assistant/coaches/[id]/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import bcrypt from 'bcryptjs';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    coachProfile: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    sessionBooking: { count: jest.fn() },
    $transaction: jest.fn(),
  },
}));

function makeRequest(body?: any) {
  return {
    json: async () => body,
  } as any;
}

const validPayload = {
  firstName: 'Coach',
  lastName: 'One',
  email: 'c@test.com',
  password: 'pw',
  pseudonym: 'CoachX',
  tag: 'Math',
  description: 'Long description',
  philosophy: 'Long philosophy',
  expertise: 'Long expertise',
  subjects: ['MATHEMATIQUES'],
  availableOnline: true,
  availableInPerson: true,
};

describe('assistant coaches id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('PUT returns 401 when not assistant', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await PUT(makeRequest(validPayload), { params: Promise.resolve({ id: 'coach-1' }) });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('PUT updates coach when valid', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({
      userId: 'coach-1',
      pseudonym: 'CoachX',
      user: { email: 'old@test.com' },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = {
        user: { update: jest.fn().mockResolvedValue({ id: 'coach-1', firstName: 'Coach', lastName: 'One', email: 'c@test.com' }) },
        coachProfile: { update: jest.fn().mockResolvedValue({ pseudonym: 'CoachX' }) },
      };
      return cb(tx);
    });

    const response = await PUT(makeRequest(validPayload), { params: Promise.resolve({ id: 'coach-1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.coach.id).toBe('coach-1');
  });

  it('DELETE returns 404 when coach missing', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: 'coach-1' }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Coach non trouvé');
  });

  it('DELETE blocks when coach has sessions', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({
      userId: 'coach-1',
      user: {},
    });
    (prisma.sessionBooking.count as jest.Mock).mockResolvedValue(2);

    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: 'coach-1' }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Impossible de supprimer');
  });

  it('DELETE removes coach when no sessions', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({
      userId: 'coach-1',
      user: {},
    });
    (prisma.sessionBooking.count as jest.Mock).mockResolvedValue(0);
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = {
        coachProfile: { delete: jest.fn().mockResolvedValue({}) },
        user: { delete: jest.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    });

    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: 'coach-1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
