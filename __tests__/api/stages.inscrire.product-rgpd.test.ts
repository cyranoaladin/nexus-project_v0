jest.mock('@/lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('@/lib/telegram/client', () => ({
  telegramSendMessage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/rate-limit', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/stages/[stageSlug]/inscrire/route';
import { prisma } from '@/lib/prisma';

const params = Promise.resolve({ stageSlug: 'prerentree-2026' });

const validPayload = {
  firstName: 'Aya',
  lastName: 'Ben Ali',
  email: 'aya@example.com',
  phone: '+216 99 19 28 29',
  level: 'Terminale',
  parentFirstName: 'Karim',
  parentLastName: 'Ben Ali',
  parentEmail: 'parent@example.com',
  parentPhone: '+216 22 333 444',
  notes: 'Besoin de suivi maths',
  stageTermsAccepted: true,
  dataProcessingAccepted: true,
};

function request(body: unknown) {
  return new NextRequest('http://localhost:3000/api/stages/prerentree-2026/inscrire', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockOpenStage() {
  (prisma.stage.findUnique as jest.Mock).mockResolvedValue({
    id: 'stage-1',
    slug: 'prerentree-2026',
    title: 'Pré-rentrée 2026',
    capacity: 12,
    priceAmount: 650,
    isVisible: true,
    isOpen: true,
  });
  (prisma.stageReservation.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.stageReservation.count as jest.Mock).mockResolvedValue(0);
  (prisma.stageReservation.create as jest.Mock).mockResolvedValue({
    id: 'reservation-secret-id',
    richStatus: 'PENDING',
  });
}

describe('/api/stages/[stageSlug]/inscrire product/RGPD decision', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires explicit stage and data-processing consent before DB access', async () => {
    const response = await POST(request({
      ...validPayload,
      dataProcessingAccepted: false,
    }), { params });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
    expect(prisma.stage.findUnique).not.toHaveBeenCalled();
    expect(prisma.stageReservation.create).not.toHaveBeenCalled();
  });

  it('creates a public stage lead without returning internal identifiers when consent is explicit', async () => {
    mockOpenStage();

    const response = await POST(request(validPayload), { params });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      reservation: { status: 'PENDING' },
      message: 'Inscription enregistrée.',
    });
    expect(JSON.stringify(body)).not.toContain('reservation-secret-id');
    expect(prisma.stageReservation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        notes: expect.stringContaining('Consentement données: oui'),
      }),
    }));
  });
});
