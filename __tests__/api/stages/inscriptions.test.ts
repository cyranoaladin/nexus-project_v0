jest.mock('@/lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('@/lib/telegram/client', () => ({
  telegramSendMessage: jest.fn().mockResolvedValue({ ok: true }),
}));

import { NextRequest } from 'next/server';

import { POST } from '@/app/api/stages/[stageSlug]/inscrire/route';
import { sendMail } from '@/lib/email/mailer';
import { telegramSendMessage } from '@/lib/telegram/client';

const mockSendMail = sendMail as jest.Mock;
const mockTelegramSendMessage = telegramSendMessage as jest.Mock;

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

  it('retourne 404 si stage inexistant ou fermé', async () => {
    prisma.stage.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest(validBody), { params });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('fermées');
  });

  it('retourne 409 si doublon email pour ce stage', async () => {
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      slug: 'printemps-2026',
      isVisible: true,
      isOpen: true,
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
    });
    prisma.stageReservation.findFirst.mockResolvedValue(null);
    prisma.stageReservation.count.mockResolvedValue(5);
    prisma.stageReservation.create.mockResolvedValue({ id: 'res-1' });

    const res = await POST(makeRequest(validBody), { params });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.reservation).toEqual({ id: 'res-1', status: 'PENDING' });
    expect(prisma.stageReservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          richStatus: 'PENDING',
        }),
      })
    );
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
    });
    prisma.stageReservation.findFirst.mockResolvedValue(null);
    prisma.stageReservation.count.mockResolvedValue(6);
    prisma.stageReservation.create.mockResolvedValue({ id: 'res-2' });

    const res = await POST(makeRequest(validBody), { params });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.reservation).toEqual({ id: 'res-2', status: 'WAITLISTED' });
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
    });
    prisma.stageReservation.findFirst.mockResolvedValue(null);
    prisma.stageReservation.count.mockResolvedValue(0);
    prisma.stageReservation.create.mockResolvedValue({ id: 'res-3' });

    await POST(makeRequest(validBody), { params });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'aya@example.com',
        subject: expect.stringContaining('Printemps 2026'),
      })
    );
  });

  it('envoie une notification Telegram', async () => {
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      slug: 'printemps-2026',
      title: 'Printemps 2026',
      priceAmount: 650,
      capacity: 12,
      isVisible: true,
      isOpen: true,
    });
    prisma.stageReservation.findFirst.mockResolvedValue(null);
    prisma.stageReservation.count.mockResolvedValue(0);
    prisma.stageReservation.create.mockResolvedValue({ id: 'res-4' });

    await POST(makeRequest(validBody), { params });

    expect(mockTelegramSendMessage).toHaveBeenCalledWith(
      undefined,
      expect.stringContaining('Nouvelle inscription stage')
    );
  });

  it('retourne 201 avec { reservation: { id, status } }', async () => {
    prisma.stage.findUnique.mockResolvedValue({
      id: 'stage-1',
      slug: 'printemps-2026',
      title: 'Printemps 2026',
      priceAmount: 650,
      capacity: 12,
      isVisible: true,
      isOpen: true,
    });
    prisma.stageReservation.findFirst.mockResolvedValue(null);
    prisma.stageReservation.count.mockResolvedValue(1);
    prisma.stageReservation.create.mockResolvedValue({ id: 'res-5' });

    const res = await POST(makeRequest(validBody), { params });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({
      reservation: { id: 'res-5', status: 'PENDING' },
      message: 'Inscription enregistrée.',
    });
  });
});
