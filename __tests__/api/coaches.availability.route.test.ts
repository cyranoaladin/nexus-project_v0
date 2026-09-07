import { GET, POST, DELETE } from '@/app/api/coaches/availability/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    coachAvailability: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
    sessionBooking: { findMany: jest.fn() },
    $transaction: jest.fn(),
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
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });

    const response = await POST(makeRequest({ type: 'weekly', schedule: [] }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain('Only coaches');
  });

  it('POST weekly creates slots', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-1', role: 'COACH' },
    });
    (prisma.$transaction as jest.Mock).mockResolvedValue([{ count: 0 }, { count: 1 }]);

    const response = await POST(makeRequest({
      type: 'weekly',
      schedule: [{ dayOfWeek: 1, slots: [{ startTime: '10:00', endTime: '11:00', isAvailable: true }] }],
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  describe('atomic replace (delete + create in one transaction)', () => {
    it('weekly: bundles deleteMany and createMany inside a single prisma.$transaction call', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
      (prisma.$transaction as jest.Mock).mockResolvedValue([{ count: 2 }, { count: 1 }]);

      await POST(makeRequest({
        type: 'weekly',
        schedule: [{ dayOfWeek: 1, slots: [{ startTime: '10:00', endTime: '11:00', isAvailable: true }] }],
      }));

      // `prisma.coachAvailability.deleteMany(...)` / `createMany(...)` sont
      // TOUJOURS appelés pour construire les descripteurs d'opération Prisma
      // (PrismaPromise) — seule leur EXÉCUTION est différée jusqu'à
      // `$transaction`. La garantie testable ici est que les deux
      // descripteurs sont passés ENSEMBLE, en un seul appel `$transaction`.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const txArg = (prisma.$transaction as jest.Mock).mock.calls[0][0];
      expect(Array.isArray(txArg)).toBe(true);
      expect(txArg).toHaveLength(2);
    });

    it('specific date: bundles deleteMany and createMany inside a single prisma.$transaction call', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
      (prisma.$transaction as jest.Mock).mockResolvedValue([{ count: 0 }, { count: 1 }]);

      await POST(makeRequest({
        type: 'specific',
        date: '2026-03-10',
        slots: [{ startTime: '10:00', endTime: '11:00', isAvailable: true }],
      }));

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const txArg = (prisma.$transaction as jest.Mock).mock.calls[0][0];
      expect(Array.isArray(txArg)).toBe(true);
      expect(txArg).toHaveLength(2);
    });

    it('weekly: rolls back (never reports success) when the createMany half of the transaction fails', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
      // Un tableau `$transaction` est tout-ou-rien côté Prisma réel : si l'un
      // des deux échoue, AUCUN n'est committé — la ligne existante n'est
      // donc jamais perdue. Ce mock simule cet échec global.
      (prisma.$transaction as jest.Mock).mockRejectedValue(Object.assign(new Error('boom'), { code: 'P2002' }));

      const response = await POST(makeRequest({
        type: 'weekly',
        schedule: [{ dayOfWeek: 1, slots: [{ startTime: '10:00', endTime: '11:00', isAvailable: true }] }],
      }));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.success).not.toBe(true);
    });

    it('specific date: rolls back (never reports success) when the createMany half of the transaction fails', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
      (prisma.$transaction as jest.Mock).mockRejectedValue(Object.assign(new Error('boom'), { code: 'P2002' }));

      const response = await POST(makeRequest({
        type: 'specific',
        date: '2026-03-10',
        slots: [{ startTime: '10:00', endTime: '11:00', isAvailable: true }],
      }));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.success).not.toBe(true);
    });
  });

  it('GET returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest(undefined, 'http://localhost:3000/api/coaches/availability'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('DELETE returns 400 when missing id', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-1', role: 'COACH' },
    });

    const response = await DELETE(makeRequest(undefined, 'http://localhost:3000/api/coaches/availability'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Availability ID is required');
  });
});
