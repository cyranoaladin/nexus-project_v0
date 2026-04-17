jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { auth } from '@/auth';
import { NextRequest } from 'next/server';

import { GET as listStages, POST as createStage } from '@/app/api/admin/stages/route';
import { GET as getStage, PATCH as patchStage, DELETE as deleteStage } from '@/app/api/admin/stages/[stageId]/route';
import { GET as listSessions, POST as createSession } from '@/app/api/admin/stages/[stageId]/sessions/route';
import { GET as listCoaches, POST as assignCoach, DELETE as unassignCoach } from '@/app/api/admin/stages/[stageId]/coaches/route';

const mockAuth = auth as jest.Mock;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function makeRequest(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init);
}

function adminSession(role: string = 'ADMIN') {
  return {
    user: {
      id: 'user-admin',
      email: 'admin@nexus.test',
      role,
    },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  };
}

describe('GET /api/admin/stages', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const res = await listStages(makeRequest('http://localhost:3000/api/admin/stages'));

    expect(res.status).toBe(401);
  });

  it('returns 200 for ASSISTANTE with kpis and reservation counts', async () => {
    mockAuth.mockResolvedValue(adminSession('ASSISTANTE'));
    prisma.stage.findMany.mockResolvedValue([
      {
        id: 'stage-1',
        slug: 'printemps-2026',
        title: 'Printemps 2026',
        startDate: new Date('2026-04-21T08:00:00.000Z'),
        endDate: new Date('2026-04-25T17:00:00.000Z'),
        capacity: 12,
        priceAmount: 650,
        isOpen: true,
        isVisible: true,
        bilans: [{ isPublished: true }, { isPublished: false }],
        reservations: [
          { richStatus: 'CONFIRMED', status: 'CONFIRMED' },
          { richStatus: 'PENDING', status: 'PENDING' },
          { richStatus: 'WAITLISTED', status: 'PENDING' },
        ],
      },
    ]);

    const res = await listStages(makeRequest('http://localhost:3000/api/admin/stages'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.kpis.activeStages).toBe(1);
    expect(body.kpis.totalInscrits).toBe(1);
    expect(body.stages[0].reservationCounts.CONFIRMED).toBe(1);
    expect(body.stages[0].reservationCounts.WAITLISTED).toBe(1);
  });
});

describe('POST /api/admin/stages', () => {
  const validBody = {
    slug: 'stage-printemps',
    title: 'Stage Printemps',
    subtitle: 'Révisions intensives',
    description: 'Description',
    type: 'INTENSIF',
    subject: ['MATHEMATIQUES'],
    level: ['Terminale'],
    startDate: '2026-04-20T08:00:00.000Z',
    endDate: '2026-04-25T17:00:00.000Z',
    capacity: 12,
    priceAmount: 650,
    priceCurrency: 'TND',
    location: 'Tunis',
    isVisible: true,
    isOpen: true,
  };

  it('returns 403 for ASSISTANTE', async () => {
    mockAuth.mockResolvedValue(adminSession('ASSISTANTE'));

    const res = await createStage(makeRequest('http://localhost:3000/api/admin/stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    }));

    expect(res.status).toBe(403);
  });

  it('returns 409 when slug already exists', async () => {
    mockAuth.mockResolvedValue(adminSession());
    prisma.stage.findUnique.mockResolvedValue({ id: 'stage-1', slug: 'stage-printemps' });

    const res = await createStage(makeRequest('http://localhost:3000/api/admin/stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    }));

    expect(res.status).toBe(409);
  });

  it('creates a stage for ADMIN', async () => {
    mockAuth.mockResolvedValue(adminSession());
    prisma.stage.findUnique.mockResolvedValue(null);
    prisma.stage.create.mockResolvedValue({ id: 'stage-1', ...validBody });

    const res = await createStage(makeRequest('http://localhost:3000/api/admin/stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.stage.slug).toBe('stage-printemps');
  });
});

describe('GET/PATCH/DELETE /api/admin/stages/[stageId]', () => {
  const params = Promise.resolve({ stageId: 'stage-1' });

  it('returns full stage detail', async () => {
    mockAuth.mockResolvedValue(adminSession());
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      title: 'Stage détail',
      sessions: [],
      coaches: [],
      documents: [],
      bilans: [],
    });

    const res = await getStage(makeRequest('http://localhost:3000/api/admin/stages/stage-1'), { params });

    expect(res.status).toBe(200);
  });

  it('updates a stage with partial payload', async () => {
    mockAuth.mockResolvedValue(adminSession());
    prisma.stage.findUnique.mockResolvedValue({ id: 'stage-1', slug: 'old-slug' });
    prisma.stage.update.mockResolvedValue({ id: 'stage-1', slug: 'old-slug', title: 'Nouveau titre' });

    const res = await patchStage(makeRequest('http://localhost:3000/api/admin/stages/stage-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nouveau titre' }),
    }), { params });

    expect(res.status).toBe(200);
  });

  it('returns 409 when deleting a stage with confirmed reservations', async () => {
    mockAuth.mockResolvedValue(adminSession());
    prisma.stageReservation.count.mockResolvedValue(2);

    const res = await deleteStage(makeRequest('http://localhost:3000/api/admin/stages/stage-1', {
      method: 'DELETE',
    }), { params });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('inscrits confirmés');
  });
});

describe('GET/POST /api/admin/stages/[stageId]/sessions', () => {
  const params = Promise.resolve({ stageId: 'stage-1' });

  it('lists sessions for ADMIN', async () => {
    mockAuth.mockResolvedValue(adminSession());
    prisma.stageSession.findMany.mockResolvedValue([{ id: 'session-1' }]);

    const res = await listSessions(makeRequest('http://localhost:3000/api/admin/stages/stage-1/sessions'), { params });

    expect(res.status).toBe(200);
  });

  it('rejects invalid session chronology', async () => {
    mockAuth.mockResolvedValue(adminSession('ASSISTANTE'));

    const res = await createSession(makeRequest('http://localhost:3000/api/admin/stages/stage-1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Séance',
        subject: 'MATHEMATIQUES',
        startAt: '2026-04-21T10:00:00.000Z',
        endAt: '2026-04-21T09:00:00.000Z',
      }),
    }), { params });

    expect(res.status).toBe(400);
  });
});

describe('GET/POST/DELETE /api/admin/stages/[stageId]/coaches', () => {
  const params = Promise.resolve({ stageId: 'stage-1' });

  it('lists assigned coaches', async () => {
    mockAuth.mockResolvedValue(adminSession());
    prisma.stageCoach.findMany.mockResolvedValue([{ id: 'assignment-1' }]);

    const res = await listCoaches(makeRequest('http://localhost:3000/api/admin/stages/stage-1/coaches'), { params });

    expect(res.status).toBe(200);
  });

  it('assigns a coach', async () => {
    mockAuth.mockResolvedValue(adminSession());
    prisma.stage.findUnique.mockResolvedValue({ id: 'stage-1' });
    prisma.coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
    prisma.stageCoach.findUnique.mockResolvedValue(null);
    prisma.stageCoach.create.mockResolvedValue({ id: 'assignment-1', coachId: 'coach-1' });

    const res = await assignCoach(makeRequest('http://localhost:3000/api/admin/stages/stage-1/coaches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId: 'coach-1', role: 'Lead' }),
    }), { params });

    expect(res.status).toBe(201);
  });

  it('unassigns a coach', async () => {
    mockAuth.mockResolvedValue(adminSession());
    prisma.stageCoach.deleteMany.mockResolvedValue({ count: 1 });

    const res = await unassignCoach(makeRequest('http://localhost:3000/api/admin/stages/stage-1/coaches', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId: 'coach-1' }),
    }), { params });

    expect(res.status).toBe(200);
  });
});
