jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { auth } from '@/auth';
import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';

import { GET as listStages, POST as createStage } from '@/app/api/admin/stages/route';
import { GET as getStage, PATCH as patchStage, DELETE as deleteStage } from '@/app/api/admin/stages/[stageId]/route';
import { GET as listSessions, POST as createSession } from '@/app/api/admin/stages/[stageId]/sessions/route';
import { GET as listCoaches, POST as assignCoach, DELETE as unassignCoach } from '@/app/api/admin/stages/[stageId]/coaches/route';

const mockAuth = auth as jest.Mock;
const NOW = new Date('2026-08-13T12:00:00.000Z');
const EXPIRED_STAGE_ERROR = 'Un stage terminé ne peut pas être ouvert aux inscriptions';
const CONCURRENT_STAGE_UPDATE_ERROR = 'Le stage a été modifié entre-temps. Veuillez réessayer.';

let prisma: any;

beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
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
    startDate: '2026-10-20T08:00:00.000Z',
    endDate: '2026-10-25T17:00:00.000Z',
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

  it('refuses an explicitly open expired stage before any database access', async () => {
    mockAuth.mockResolvedValue(adminSession());

    const res = await createStage(makeRequest('http://localhost:3000/api/admin/stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        startDate: '2026-04-20T08:00:00.000Z',
        endDate: '2026-04-25T17:00:00.000Z',
        isOpen: true,
      }),
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: EXPIRED_STAGE_ERROR });
    expect(prisma.stage.findUnique).not.toHaveBeenCalled();
    expect(prisma.stage.create).not.toHaveBeenCalled();
  });

  it('refuses an expired stage whose omitted isOpen defaults to open', async () => {
    mockAuth.mockResolvedValue(adminSession());
    const expiredBody: Partial<typeof validBody> = {
      ...validBody,
      startDate: '2026-04-20T08:00:00.000Z',
      endDate: '2026-04-25T17:00:00.000Z',
    };
    delete expiredBody.isOpen;

    const res = await createStage(makeRequest('http://localhost:3000/api/admin/stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expiredBody),
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: EXPIRED_STAGE_ERROR });
    expect(prisma.stage.findUnique).not.toHaveBeenCalled();
    expect(prisma.stage.create).not.toHaveBeenCalled();
  });

  it('allows creating an expired stage when it is closed', async () => {
    mockAuth.mockResolvedValue(adminSession());
    prisma.stage.findUnique.mockResolvedValue(null);
    prisma.stage.create.mockResolvedValue({
      id: 'stage-history',
      ...validBody,
      startDate: new Date('2026-04-20T08:00:00.000Z'),
      endDate: new Date('2026-04-25T17:00:00.000Z'),
      isOpen: false,
    });

    const res = await createStage(makeRequest('http://localhost:3000/api/admin/stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        startDate: '2026-04-20T08:00:00.000Z',
        endDate: '2026-04-25T17:00:00.000Z',
        isOpen: false,
      }),
    }));

    expect(res.status).toBe(201);
    expect(prisma.stage.create).toHaveBeenCalledTimes(1);
  });

  it('allows an open stage whose endDate equals now', async () => {
    mockAuth.mockResolvedValue(adminSession());
    prisma.stage.findUnique.mockResolvedValue(null);
    prisma.stage.create.mockResolvedValue({
      id: 'stage-boundary',
      ...validBody,
      startDate: new Date('2026-08-13T08:00:00.000Z'),
      endDate: NOW,
    });

    const res = await createStage(makeRequest('http://localhost:3000/api/admin/stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        startDate: '2026-08-13T08:00:00.000Z',
        endDate: NOW.toISOString(),
      }),
    }));

    expect(res.status).toBe(201);
    expect(prisma.stage.create).toHaveBeenCalledTimes(1);
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
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      slug: 'old-slug',
      endDate: new Date('2026-10-25T17:00:00.000Z'),
      isOpen: true,
    });
    prisma.stage.update.mockResolvedValue({ id: 'stage-1', slug: 'old-slug', title: 'Nouveau titre' });

    const res = await patchStage(makeRequest('http://localhost:3000/api/admin/stages/stage-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nouveau titre' }),
    }), { params });

    expect(res.status).toBe(200);
  });

  it('refuses reopening an expired stage before update', async () => {
    mockAuth.mockResolvedValue(adminSession());
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      slug: 'stage-history',
      endDate: new Date('2026-04-25T17:00:00.000Z'),
      isOpen: false,
    });

    const res = await patchStage(makeRequest('http://localhost:3000/api/admin/stages/stage-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isOpen: true }),
    }), { params });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: EXPIRED_STAGE_ERROR });
    expect(prisma.stage.update).not.toHaveBeenCalled();
  });

  it('refuses an unrelated patch while an expired stage is still open', async () => {
    mockAuth.mockResolvedValue(adminSession());
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      slug: 'stage-expired-open',
      endDate: new Date('2026-04-25T17:00:00.000Z'),
      isOpen: true,
    });

    const res = await patchStage(makeRequest('http://localhost:3000/api/admin/stages/stage-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Titre corrigé' }),
    }), { params });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: EXPIRED_STAGE_ERROR });
    expect(prisma.stage.update).not.toHaveBeenCalled();
  });

  it('refuses moving only endDate into the past while the stage remains open', async () => {
    mockAuth.mockResolvedValue(adminSession());
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      slug: 'stage-future',
      endDate: new Date('2026-10-25T17:00:00.000Z'),
      isOpen: true,
    });

    const res = await patchStage(makeRequest('http://localhost:3000/api/admin/stages/stage-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endDate: '2026-04-25T17:00:00.000Z' }),
    }), { params });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: EXPIRED_STAGE_ERROR });
    expect(prisma.stage.update).not.toHaveBeenCalled();
  });

  it('allows closing an expired stage', async () => {
    mockAuth.mockResolvedValue(adminSession());
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      slug: 'stage-expired-open',
      endDate: new Date('2026-04-25T17:00:00.000Z'),
      isOpen: true,
    });
    prisma.stage.update.mockResolvedValue({
      id: 'stage-1',
      slug: 'stage-expired-open',
      endDate: new Date('2026-04-25T17:00:00.000Z'),
      isOpen: false,
    });

    const res = await patchStage(makeRequest('http://localhost:3000/api/admin/stages/stage-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isOpen: false }),
    }), { params });

    expect(res.status).toBe(200);
    expect(prisma.stage.update).toHaveBeenCalledTimes(1);
  });

  it('allows changing visibility on an expired stage that remains closed', async () => {
    mockAuth.mockResolvedValue(adminSession());
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      slug: 'stage-history',
      endDate: new Date('2026-04-25T17:00:00.000Z'),
      isOpen: false,
    });
    prisma.stage.update.mockResolvedValue({
      id: 'stage-1',
      slug: 'stage-history',
      endDate: new Date('2026-04-25T17:00:00.000Z'),
      isOpen: false,
      isVisible: true,
    });

    const res = await patchStage(makeRequest('http://localhost:3000/api/admin/stages/stage-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isVisible: true }),
    }), { params });

    expect(res.status).toBe(200);
    expect(prisma.stage.update).toHaveBeenCalledTimes(1);
  });

  it('allows extending and reopening an expired closed stage atomically', async () => {
    mockAuth.mockResolvedValue(adminSession());
    const previousEndDate = new Date('2026-04-25T17:00:00.000Z');
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      slug: 'stage-history',
      endDate: previousEndDate,
      isOpen: false,
    });
    prisma.stage.update.mockResolvedValue({
      id: 'stage-1',
      slug: 'stage-history',
      endDate: new Date('2026-10-25T17:00:00.000Z'),
      isOpen: true,
    });

    const res = await patchStage(makeRequest('http://localhost:3000/api/admin/stages/stage-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endDate: '2026-10-25T17:00:00.000Z',
        isOpen: true,
      }),
    }), { params });

    expect(res.status).toBe(200);
    expect(prisma.stage.update).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'stage-1',
        endDate: previousEndDate,
        isOpen: false,
      },
    }));
  });

  it('returns 409 when optimistic stage state changed before update', async () => {
    mockAuth.mockResolvedValue(adminSession());
    const previousEndDate = new Date('2026-10-25T17:00:00.000Z');
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      slug: 'stage-future',
      endDate: previousEndDate,
      isOpen: false,
    });
    prisma.stage.update.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      'Record to update not found.',
      { code: 'P2025', clientVersion: '6.11.1' }
    ));

    const res = await patchStage(makeRequest('http://localhost:3000/api/admin/stages/stage-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isOpen: true }),
    }), { params });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: CONCURRENT_STAGE_UPDATE_ERROR });
    expect(prisma.stage.update).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'stage-1',
        endDate: previousEndDate,
        isOpen: false,
      },
    }));
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
    prisma.stage.findUnique.mockResolvedValue({ id: 'stage-1' });
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
    prisma.stage.findUnique.mockResolvedValue({ id: 'stage-1' });
    prisma.stageCoach.findMany.mockResolvedValue([{ id: 'assignment-1' }]);

    const res = await listCoaches(makeRequest('http://localhost:3000/api/admin/stages/stage-1/coaches'), { params });

    expect(res.status).toBe(200);
  });

  it('assigns a coach', async () => {
    mockAuth.mockResolvedValue(adminSession());
    prisma.stage.findUnique.mockResolvedValue({ id: 'stage-1' });
    prisma.coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
    prisma.stageCoach.findFirst.mockResolvedValue(null);
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
    prisma.stage.findUnique.mockResolvedValue({ id: 'stage-1' });
    prisma.stageCoach.deleteMany.mockResolvedValue({ count: 1 });

    const res = await unassignCoach(makeRequest('http://localhost:3000/api/admin/stages/stage-1/coaches', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId: 'coach-1' }),
    }), { params });

    expect(res.status).toBe(200);
  });
});
