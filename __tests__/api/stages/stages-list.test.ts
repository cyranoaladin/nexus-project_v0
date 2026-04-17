import { NextRequest } from 'next/server';

import { GET as getStages } from '@/app/api/stages/route';
import { GET as getStageDetail } from '@/app/api/stages/[stageSlug]/route';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function listRequest(query = '') {
  return new NextRequest(`http://localhost:3000/api/stages${query}`);
}

function detailRequest() {
  return new NextRequest('http://localhost:3000/api/stages/printemps-2026');
}

function stageRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'stage-1',
    slug: 'printemps-2026',
    title: 'Printemps 2026',
    subtitle: 'Révisions intensives',
    description: 'Description',
    type: 'INTENSIF',
    subject: ['MATHEMATIQUES'],
    level: ['Terminale'],
    startDate: new Date('2026-04-21T08:00:00.000Z'),
    endDate: new Date('2026-04-25T17:00:00.000Z'),
    capacity: 12,
    priceAmount: 650,
    priceCurrency: 'TND',
    location: 'Tunis',
    isVisible: true,
    isOpen: true,
    reservations: [
      { richStatus: 'CONFIRMED', status: 'CONFIRMED' },
      { richStatus: 'PENDING', status: 'PENDING' },
    ],
    sessions: [
      {
        id: 'session-1',
        title: 'Bloc 1',
        subject: 'MATHEMATIQUES',
        startAt: new Date('2026-04-21T08:00:00.000Z'),
        endAt: new Date('2026-04-21T10:00:00.000Z'),
        location: 'Salle A',
        description: 'Fonctions',
        coach: {
          pseudonym: 'Helios',
          title: 'Agrégé',
          description: 'Coach de maths',
          subjects: ['MATHEMATIQUES'],
        },
        documents: [],
      },
    ],
    coaches: [
      {
        id: 'assignment-1',
        role: 'Lead',
        coach: {
          id: 'coach-1',
          pseudonym: 'Helios',
          title: 'Agrégé',
          tag: 'Maths',
          description: 'Coach de maths',
          expertise: 'Mathématiques',
          subjects: ['MATHEMATIQUES'],
        },
      },
    ],
    bilans: [],
    ...overrides,
  };
}

describe('GET /api/stages', () => {
  it('retourne 200 avec liste des stages visibles', async () => {
    prisma.stage.findMany.mockResolvedValue([stageRecord()]);

    const res = await getStages(listRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stages).toHaveLength(1);
    expect(body.stages[0].slug).toBe('printemps-2026');
  });

  it('filtre par open=true', async () => {
    prisma.stage.findMany.mockResolvedValue([stageRecord()]);

    await getStages(listRequest('?open=true'));

    expect(prisma.stage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isOpen: true,
        }),
      })
    );
  });

  it('filtre par level', async () => {
    prisma.stage.findMany.mockResolvedValue([stageRecord()]);

    await getStages(listRequest('?level=Terminale'));

    expect(prisma.stage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          level: { has: 'Terminale' },
        }),
      })
    );
  });

  it('filtre par subject', async () => {
    prisma.stage.findMany.mockResolvedValue([stageRecord()]);

    await getStages(listRequest('?subject=MATHEMATIQUES'));

    expect(prisma.stage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subject: { has: 'MATHEMATIQUES' },
        }),
      })
    );
  });

  it('retourne _count des réservations dans chaque stage', async () => {
    prisma.stage.findMany.mockResolvedValue([stageRecord()]);

    const res = await getStages(listRequest());
    const body = await res.json();

    expect(body.stages[0]._count.reservations).toBe(2);
  });

  it('ne retourne pas les stages isVisible=false', async () => {
    prisma.stage.findMany.mockResolvedValue([]);

    const res = await getStages(listRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stages).toEqual([]);
    expect(prisma.stage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isVisible: true,
        }),
      })
    );
  });
});

describe('GET /api/stages/[slug]', () => {
  const params = Promise.resolve({ stageSlug: 'printemps-2026' });

  it('retourne 200 avec détail complet du stage', async () => {
    prisma.stage.findFirst.mockResolvedValue(stageRecord());

    const res = await getStageDetail(detailRequest(), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stage.title).toBe('Printemps 2026');
  });

  it('retourne 404 si slug inexistant', async () => {
    prisma.stage.findFirst.mockResolvedValue(null);

    const res = await getStageDetail(detailRequest(), { params });

    expect(res.status).toBe(404);
  });

  it('retourne 404 si isVisible=false', async () => {
    prisma.stage.findFirst.mockResolvedValue(null);

    const res = await getStageDetail(detailRequest(), { params });

    expect(res.status).toBe(404);
  });

  it('inclut les sessions ordonnées par startAt', async () => {
    prisma.stage.findFirst.mockResolvedValue(stageRecord());

    const res = await getStageDetail(detailRequest(), { params });
    const body = await res.json();

    expect(body.stage.sessions[0].startAt).toBe('2026-04-21T08:00:00.000Z');
    expect(prisma.stage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          sessions: expect.objectContaining({
            orderBy: { startAt: 'asc' },
          }),
        }),
      })
    );
  });

  it('inclut les coaches avec pseudonyme', async () => {
    prisma.stage.findFirst.mockResolvedValue(stageRecord());

    const res = await getStageDetail(detailRequest(), { params });
    const body = await res.json();

    expect(body.stage.coaches[0].coach.pseudonym).toBe('Helios');
  });
});
