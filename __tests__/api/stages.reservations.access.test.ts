jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { auth } from '@/auth';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/stages/[stageSlug]/reservations/route';

const mockAuth = auth as jest.Mock;
let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function makeRequest() {
  return new NextRequest('http://localhost:3000/api/stages/printemps-2026/reservations');
}

function session(role: string) {
  return {
    user: { id: `user-${role}`, role, email: `${role}@nexus.test` },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  };
}

const params = Promise.resolve({ stageSlug: 'printemps-2026' });

describe('GET /api/stages/[stageSlug]/reservations access', () => {
  it('refuse les requêtes non authentifiées', async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET(makeRequest(), { params });

    expect(res.status).toBe(401);
  });

  it.each(['PARENT', 'ELEVE', 'COACH'])('refuse le rôle %s', async (role) => {
    mockAuth.mockResolvedValue(session(role));

    const res = await GET(makeRequest(), { params });

    expect(res.status).toBe(403);
  });

  it('filtre par stageSlug et projette les réservations sans token ni notes internes', async () => {
    mockAuth.mockResolvedValue(session('ASSISTANTE'));
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      slug: 'printemps-2026',
      title: 'Stage Printemps',
      internalNotes: 'secret stage note',
    });
    prisma.stageReservation.findMany.mockResolvedValue([
      {
        id: 'res-1',
        parentName: 'Parent A',
        studentName: 'Student A',
        email: 'parent@example.com',
        phone: '+216 11 111 111',
        classe: 'Terminale',
        richStatus: 'PENDING',
        paymentStatus: 'PENDING',
        confirmedAt: null,
        createdAt: new Date('2026-05-01T10:00:00.000Z'),
        activationToken: 'raw-token',
        notes: 'internal reservation note',
        student: {
          id: 'student-1',
          user: {
            firstName: 'Student',
            lastName: 'A',
            email: 'student@example.com',
            password: 'hash',
          },
        },
      },
    ]);

    const res = await GET(makeRequest(), { params });
    const body = await res.json();
    const serialized = JSON.stringify(body);

    expect(res.status).toBe(200);
    expect(prisma.stageReservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stageId: 'stage-1' } })
    );
    expect(serialized).not.toContain('activationToken');
    expect(serialized).not.toContain('raw-token');
    expect(serialized).not.toContain('internal reservation note');
    expect(serialized).not.toContain('secret stage note');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('student@example.com');
    expect(body.stage).toEqual({ id: 'stage-1', slug: 'printemps-2026', title: 'Stage Printemps' });
  });
});
