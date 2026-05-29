jest.mock('@/lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('@/lib/telegram/client', () => ({
  telegramSendMessage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/rate-limit', () => ({
  guardRateLimit: jest.fn().mockReturnValue(null),
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/app/api/stages/[stageSlug]/inscrire/route';
import { guardRateLimitAsync } from '@/lib/rate-limit';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
  (guardRateLimitAsync as jest.Mock).mockResolvedValue(null);
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
  firstName: 'Ahmed',
  lastName: 'Ben Ali',
  email: 'ahmed@example.com',
  phone: '+216 22 111 222',
  level: 'Terminale',
  parentFirstName: 'Karim',
  parentLastName: 'Ben Ali',
  parentEmail: 'parent@example.com',
  parentPhone: '+216 22 333 444',
  notes: 'Besoin de suivi maths',
};

const publicStage = {
  id: 'stage-1',
  slug: 'printemps-2026',
  title: 'Stage Printemps',
  capacity: 12,
  priceAmount: 650,
};

describe('POST /api/stages/[stageSlug]/inscrire security', () => {
  it('refuse un payload avec champs sensibles extra', async () => {
    const res = await POST(makeRequest({
      ...validBody,
      price: 1,
      richStatus: 'CONFIRMED',
      paymentStatus: 'COMPLETED',
      activationToken: 'raw-token',
      academyId: 'other-stage',
    }), { params });

    expect(res.status).toBe(400);
    expect(prisma.stageReservation.create).not.toHaveBeenCalled();
  });

  it('applique le rate limit avant création de réservation', async () => {
    (guardRateLimitAsync as jest.Mock).mockResolvedValueOnce(
      NextResponse.json({ error: 'rate limited' }, { status: 429 })
    );

    const res = await POST(makeRequest(validBody), { params });

    expect(res.status).toBe(429);
    expect(prisma.stage.findUnique).not.toHaveBeenCalled();
    expect(prisma.stageReservation.create).not.toHaveBeenCalled();
  });

  it('retourne une réponse publique minimale sans id interne ni token', async () => {
    prisma.stage.findUnique.mockResolvedValue(publicStage);
    prisma.stageReservation.findFirst.mockResolvedValue(null);
    prisma.stageReservation.count.mockResolvedValue(0);
    prisma.stageReservation.create.mockResolvedValue({
      id: 'reservation-secret-id',
      richStatus: 'PENDING',
      activationToken: 'raw-token',
      notes: 'internal note',
    });

    const res = await POST(makeRequest(validBody), { params });
    const body = await res.json();
    const serialized = JSON.stringify(body);

    expect(res.status).toBe(201);
    expect(serialized).not.toContain('reservation-secret-id');
    expect(serialized).not.toContain('activationToken');
    expect(serialized).not.toContain('internal note');
    expect(body.reservation).toEqual({ status: 'PENDING' });
  });
});
