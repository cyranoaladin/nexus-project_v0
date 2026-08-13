jest.mock('@/lib/email/outbox', () => ({
  enqueueEmailIntent: jest.fn().mockResolvedValue({ id: 'job-1' }),
}));

jest.mock('@/lib/email/outbox-scheduler', () => ({
  kickEmailOutboxDrain: jest.fn(),
}));

import { NextRequest } from 'next/server';

import { POST } from '@/app/api/stages/[stageSlug]/inscrire/route';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';

const mockSendMail = enqueueEmailIntent as jest.Mock;
const mockKickEmailOutboxDrain = kickEmailOutboxDrain as jest.Mock;

const NOW = new Date('2026-08-13T12:00:00.000Z');
const FUTURE_STAGE_END_DATE = new Date('2026-10-25T17:00:00.000Z');

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/stages/printemps-2026/inscrire', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ stageSlug: 'printemps-2026' });

const validBody = {
  firstName: 'Aya',
  lastName: 'Ben Ali',
  email: 'aya@example.com',
  phone: '+21699192829',
  level: 'Terminale',
  stageTermsAccepted: true,
  dataProcessingAccepted: true,
};

describe('POST /api/stages/[slug]/inscrire', () => {
  it('retourne 400 si payload invalide (email manquant)', async () => {
    const res = await POST(makeRequest({
      firstName: 'Aya',
      lastName: 'Ben Ali',
      level: 'Terminale',
    }), { params });

    expect(res.status).toBe(400);
  });

  it('retourne 404 si un stage futur est fermé', async () => {
    const closedFutureStage = {
      id: 'stage-closed',
      slug: 'printemps-2026',
      isVisible: true,
      isOpen: false,
      endDate: FUTURE_STAGE_END_DATE,
    };
    prisma.stage.findUnique.mockImplementation(async ({ where }: { where: any }) => (
      where.isOpen === closedFutureStage.isOpen ? closedFutureStage : null
    ));

    const res = await POST(makeRequest(validBody), { params });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('fermées');
  });

  it("refuse atomiquement un stage visible et ouvert dont la date de fin est dépassée", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    const expiredStage = {
      id: 'stage-expired',
      slug: 'printemps-2026',
      title: 'Printemps 2026',
      priceAmount: 650,
      capacity: 12,
      isVisible: true,
      isOpen: true,
      endDate: new Date('2026-04-25T17:00:00.000Z'),
    };
    prisma.stage.findUnique.mockImplementation(async ({ where }: { where: any }) => {
      const lowerBound = where.endDate?.gte;
      return lowerBound instanceof Date && expiredStage.endDate >= lowerBound
        ? expiredStage
        : lowerBound
          ? null
          : expiredStage;
    });
    prisma.stageReservation.findFirst.mockResolvedValue(null);
    prisma.stageReservation.count.mockResolvedValue(0);
    prisma.stageReservation.create.mockResolvedValue({ id: 'must-not-be-created' });

    try {
      const res = await POST(makeRequest(validBody), { params });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(res.headers.get('location')).toBeNull();
      expect(body).toEqual({ error: 'Stage introuvable ou inscriptions fermées' });
      expect(prisma.stage.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.stage.findUnique).toHaveBeenCalledWith({
        where: {
          slug: 'printemps-2026',
          isVisible: true,
          isOpen: true,
          endDate: { gte: NOW },
        },
      });
      expect(prisma.stageReservation.findFirst).not.toHaveBeenCalled();
      expect(prisma.stageReservation.count).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.stageReservation.create).not.toHaveBeenCalled();
      expect(mockSendMail).not.toHaveBeenCalled();
      expect(mockKickEmailOutboxDrain).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('retourne 409 si doublon email pour ce stage', async () => {
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      slug: 'printemps-2026',
      isVisible: true,
      isOpen: true,
      endDate: FUTURE_STAGE_END_DATE,
    });
    prisma.stageReservation.findFirst.mockResolvedValue({ id: 'res-1' });

    const res = await POST(makeRequest(validBody), { params });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('Une inscription existe déjà');
  });

  it('crée une réservation PENDING si places disponibles', async () => {
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      slug: 'printemps-2026',
      title: 'Printemps 2026',
      priceAmount: 650,
      capacity: 12,
      isVisible: true,
      isOpen: true,
      endDate: FUTURE_STAGE_END_DATE,
    });
    prisma.stageReservation.findFirst.mockResolvedValue(null);
    prisma.stageReservation.count.mockResolvedValue(5);
    prisma.stageReservation.create.mockResolvedValue({ id: 'res-1' });

    const res = await POST(makeRequest(validBody), { params });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.reservation).toEqual({ status: 'PENDING' });
    expect(body.reservation).not.toHaveProperty('id');
    expect(prisma.stageReservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          richStatus: 'PENDING',
        }),
      })
    );
  });

  it('normalise les emails avant recherche, persistance et livraison', async () => {
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1', slug: 'printemps-2026', title: 'Printemps 2026',
      priceAmount: 650, capacity: 12, isVisible: true, isOpen: true,
      endDate: FUTURE_STAGE_END_DATE,
    });
    prisma.stageReservation.findFirst.mockResolvedValue(null);
    prisma.stageReservation.count.mockResolvedValue(0);
    prisma.stageReservation.create.mockResolvedValue({ id: 'res-normalized' });

    const response = await POST(makeRequest({
      ...validBody,
      email: '  AYA@EXAMPLE.COM  ',
      parentEmail: '  PARENT@EXAMPLE.COM  ',
    }), { params });

    expect(response.status).toBe(201);
    expect(prisma.stageReservation.findFirst).toHaveBeenCalledWith({
      where: { stageId: 'stage-1', email: 'aya@example.com' },
    });
    expect(prisma.stageReservation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: 'aya@example.com',
        notes: expect.stringContaining('Email parent: parent@example.com'),
      }),
    }));
    expect(mockSendMail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      to: 'aya@example.com',
    }));
  });

  it('crée une réservation WAITLISTED si capacité atteinte', async () => {
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      slug: 'printemps-2026',
      title: 'Printemps 2026',
      priceAmount: 650,
      capacity: 6,
      isVisible: true,
      isOpen: true,
      endDate: FUTURE_STAGE_END_DATE,
    });
    prisma.stageReservation.findFirst.mockResolvedValue(null);
    prisma.stageReservation.count.mockResolvedValue(6);
    prisma.stageReservation.create.mockResolvedValue({ id: 'res-2' });

    const res = await POST(makeRequest(validBody), { params });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.reservation).toEqual({ status: 'WAITLISTED' });
    expect(body.reservation).not.toHaveProperty('id');
  });

  it('envoie un email de confirmation', async () => {
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      slug: 'printemps-2026',
      title: 'Printemps 2026',
      priceAmount: 650,
      capacity: 12,
      isVisible: true,
      isOpen: true,
      endDate: FUTURE_STAGE_END_DATE,
    });
    prisma.stageReservation.findFirst.mockResolvedValue(null);
    prisma.stageReservation.count.mockResolvedValue(0);
    prisma.stageReservation.create.mockResolvedValue({ id: 'res-3' });

    await POST(makeRequest(validBody), { params });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        to: 'aya@example.com',
        subject: expect.stringContaining('Printemps 2026'),
      }),
    );
  });

  it('envoie une alerte interne à l\'équipe pour toute nouvelle inscription', async () => {
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      slug: 'printemps-2026',
      title: 'Printemps 2026',
      priceAmount: 650,
      capacity: 12,
      isVisible: true,
      isOpen: true,
      endDate: FUTURE_STAGE_END_DATE,
    });
    prisma.stageReservation.findFirst.mockResolvedValue(null);
    prisma.stageReservation.count.mockResolvedValue(0);
    prisma.stageReservation.create.mockResolvedValue({ id: 'res-4' });

    await POST(makeRequest(validBody), { params });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        subject: expect.stringContaining('Nouvelle inscription stage'),
      }),
    );
  });

  it('retourne 201 avec une réponse publique minimale sans id interne', async () => {
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      slug: 'printemps-2026',
      title: 'Printemps 2026',
      priceAmount: 650,
      capacity: 12,
      isVisible: true,
      isOpen: true,
      endDate: FUTURE_STAGE_END_DATE,
    });
    prisma.stageReservation.findFirst.mockResolvedValue(null);
    prisma.stageReservation.count.mockResolvedValue(1);
    prisma.stageReservation.create.mockResolvedValue({ id: 'res-5' });

    const res = await POST(makeRequest(validBody), { params });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({
      reservation: { status: 'PENDING' },
      message: 'Inscription enregistrée.',
    });
    expect(JSON.stringify(body)).not.toContain('res-5');
  });
});
