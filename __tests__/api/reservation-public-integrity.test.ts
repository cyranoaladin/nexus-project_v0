/** @jest-environment node */
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: {
  stage: { findUnique: jest.fn() },
  stageReservation: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
} }));
jest.mock('@/lib/email', () => ({ sendStageBankTransferConfirmation: jest.fn() }));
jest.mock('@/lib/email/outbox', () => ({ enqueueEmailIntent: jest.fn() }));
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn(async () => null) }));
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/reservation/route';
const input = { parent: 'Synthetic Parent', email: 'synthetic@example.test', phone: '55000003', classe: 'Terminale',
  academyId: 'synthetic-stage', academyTitle: 'Client title', price: 1 };
const request = () => new NextRequest('http://localhost:3000/api/reservation', { method: 'POST', body: JSON.stringify(input) });
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(prisma.stage.findUnique).mockResolvedValue({ id: 'stage-id', slug: 'synthetic-stage', title: 'Canonical stage', priceAmount: 350, isVisible: true, isOpen: true } as never);
  jest.mocked(prisma.stageReservation.findUnique).mockResolvedValue(null);
  jest.mocked(prisma.stageReservation.create).mockResolvedValue({ id: 'synthetic-reservation' } as never);
});
test('cannot overwrite an existing reservation using only its email and academy', async () => {
  jest.mocked(prisma.stageReservation.findUnique).mockResolvedValue({ id: 'existing-private', status: 'CONFIRMED' } as never);
  const response = await POST(request());
  expect(response.status).toBe(201);
  expect(prisma.stageReservation.update).not.toHaveBeenCalled();
  expect(prisma.stageReservation.create).not.toHaveBeenCalled();
  expect(await response.json()).not.toHaveProperty('isUpdate');
});
test('binds price, title and stage identity to the server catalog', async () => {
  expect((await POST(request())).status).toBe(201);
  expect(jest.mocked(prisma.stageReservation.create).mock.calls[0][0].data).toMatchObject({ stageId: 'stage-id', academyTitle: 'Canonical stage', price: 350 });
});
test('unknown or closed catalog entries cannot create reservations', async () => {
  jest.mocked(prisma.stage.findUnique).mockResolvedValue(null);
  expect((await POST(request())).status).toBe(404);
  expect(prisma.stageReservation.create).not.toHaveBeenCalled();
  expect(prisma.stageReservation.findUnique).not.toHaveBeenCalled();
});
test('reads a bounded body even when content length is absent', async () => {
  const response = await POST(new NextRequest('http://localhost:3000/api/reservation', {
    method: 'POST', body: JSON.stringify({ ...input, padding: 'x'.repeat(8192) }),
  }));
  expect(response.status).toBe(413);
  expect(prisma.stage.findUnique).not.toHaveBeenCalled();
  expect(prisma.stageReservation.create).not.toHaveBeenCalled();
});
test('does not expose database conflict through concurrent duplicate submissions', async () => {
  jest.mocked(prisma.stageReservation.create).mockRejectedValueOnce({ code: 'P2002' });
  const response = await POST(request());
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ success: true, message: 'Demande reçue. Notre équipe vous contactera pour la suite.' });
  expect(prisma.stageReservation.update).not.toHaveBeenCalled();
});
test('catalog refusals carry a private cache policy', async () => {
  jest.mocked(prisma.stage.findUnique).mockResolvedValue(null);
  const response = await POST(request());
  expect(response.status).toBe(404);
  expect(response.headers.get('cache-control')).toContain('no-store');
});
