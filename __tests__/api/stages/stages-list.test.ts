import { NextRequest } from 'next/server';

import { GET as getStages } from '@/app/api/stages/route';
import { GET as getStageDetail } from '@/app/api/stages/[stageSlug]/route';
import { getPublicStageBySlug, listPublicStages } from '@/lib/stages/public';

const NOW = new Date('2026-08-13T12:00:00.000Z');

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
  return new NextRequest('http://localhost:3000/api/stages/automne-2026');
}

function stageRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'stage-1',
    slug: 'automne-2026',
    title: 'Automne 2026',
    subtitle: 'Révisions intensives',
    description: 'Description',
    type: 'INTENSIF',
    subject: ['MATHEMATIQUES'],
    level: ['Terminale'],
    startDate: new Date('2026-10-21T08:00:00.000Z'),
    endDate: new Date('2026-10-25T17:00:00.000Z'),
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
        startAt: new Date('2026-10-21T08:00:00.000Z'),
        endAt: new Date('2026-10-21T10:00:00.000Z'),
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
    expect(body.stages[0].slug).toBe('automne-2026');
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

  it('ne retourne aucune PII ou bilan nominatif dans le catalogue public', async () => {
    prisma.stage.findMany.mockResolvedValue([
      stageRecord({
        bilans: [
          {
            id: 'bilan-1',
            scoreGlobal: 17,
            isPublished: true,
            pdfUrl: '/private/bilan.pdf',
            publishedAt: new Date('2026-10-26T10:00:00.000Z'),
            createdAt: new Date('2026-10-25T10:00:00.000Z'),
            student: {
              user: {
                firstName: 'Ahmed',
                lastName: 'Ben Ali',
              },
            },
            coach: {
              pseudonym: 'Helios',
            },
          },
        ],
      }),
    ]);

    const res = await getStages(listRequest());
    const body = await res.json();
    const serialized = JSON.stringify(body);

    expect(res.status).toBe(200);
    expect(serialized).not.toContain('Ahmed');
    expect(serialized).not.toContain('Ben Ali');
    expect(serialized).not.toContain('pdfUrl');
    expect(serialized).not.toContain('/private/bilan.pdf');
    expect(serialized).not.toContain('email');
    expect(serialized).not.toContain('phone');
    expect(serialized).not.toContain('activationToken');
    expect(body.stages[0]).not.toHaveProperty('bilans');
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

describe('lectures publiques des stages actifs', () => {
  it("propage exactement l'horloge injectée à la liste", async () => {
    prisma.stage.findMany.mockResolvedValue([stageRecord()]);

    const stages = await listPublicStages(undefined, NOW);

    expect(stages).toHaveLength(1);
    expect(prisma.stage.findMany.mock.calls[0][0].where.endDate.gte).toBe(NOW);
  });

  it("propage exactement l'horloge injectée au détail", async () => {
    prisma.stage.findFirst.mockResolvedValue(stageRecord());

    const stage = await getPublicStageBySlug('automne-2026', NOW);

    expect(stage?.slug).toBe('automne-2026');
    expect(prisma.stage.findFirst.mock.calls[0][0].where.endDate.gte).toBe(NOW);
  });
});

describe('GET /api/stages/[slug]', () => {
  const params = Promise.resolve({ stageSlug: 'automne-2026' });

  it('retourne 200 avec détail complet du stage', async () => {
    prisma.stage.findFirst.mockResolvedValue(stageRecord());

    const res = await getStageDetail(detailRequest(), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stage.title).toBe('Automne 2026');
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

    expect(body.stage.sessions[0].startAt).toBe('2026-10-21T08:00:00.000Z');
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

  it('ne retourne pas de bilan nominatif dans le détail public', async () => {
    prisma.stage.findFirst.mockResolvedValue(stageRecord({
      bilans: [
        {
          id: 'bilan-1',
          scoreGlobal: 15,
          isPublished: true,
          pdfUrl: '/private/bilan.pdf',
          publishedAt: new Date('2026-10-26T10:00:00.000Z'),
          createdAt: new Date('2026-10-25T10:00:00.000Z'),
          student: {
            user: {
              firstName: 'Sara',
              lastName: 'Trabelsi',
            },
          },
          coach: {
            pseudonym: 'Helios',
          },
        },
      ],
    }));

    const res = await getStageDetail(detailRequest(), { params });
    const body = await res.json();
    const serialized = JSON.stringify(body);

    expect(res.status).toBe(200);
    expect(serialized).not.toContain('Sara');
    expect(serialized).not.toContain('Trabelsi');
    expect(serialized).not.toContain('pdfUrl');
    expect(serialized).not.toContain('/private/bilan.pdf');
    expect(body.stage).not.toHaveProperty('bilans');
  });
});
