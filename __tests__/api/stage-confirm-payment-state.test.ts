/** @jest-environment node */
jest.mock('@/lib/guards', () => ({ requireAnyRole: jest.fn(async () => ({ user: { id: 'synthetic-staff', role: 'ASSISTANTE' } })) }));
jest.mock('@/lib/email/outbox', () => ({ enqueueEmailIntent: jest.fn(async () => ({ id: 'synthetic-job' })) }));
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));
jest.mock('@/lib/prisma', () => {
  const db = { stageReservation: { findFirst: jest.fn(), updateMany: jest.fn() }, student: { findUnique: jest.fn() }, user: { update: jest.fn() } };
  return { prisma: { ...db, $transaction: jest.fn(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)) } };
});
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route';
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(prisma.stageReservation.updateMany).mockResolvedValue({ count: 1 });
  jest.mocked(prisma.student.findUnique).mockResolvedValue({ id: 'synthetic-student', userId: 'synthetic-student-user',
    user: { firstName: 'Synthetic', email: 'canonical@synthetic.test', activatedAt: new Date('2026-10-01T00:00:00Z') } } as never);
});
test.each([null, 'PENDING', 'FAILED', 'COMPLETED'])('academic confirmation never fabricates or overwrites source payment state %s', async paymentStatus => {
  jest.mocked(prisma.stageReservation.findFirst).mockResolvedValue({ id: 'synthetic-reservation', email: 'contact@synthetic.test',
    parentName: 'Synthetic', richStatus: 'PENDING', paymentStatus, stage: { title: 'Synthetic stage' } } as never);
  const response = await POST(new NextRequest('https://nexusreussite.academy/api/stages/synthetic-stage/reservations/synthetic-reservation/confirm',
    { method: 'POST', body: JSON.stringify({ studentId: 'synthetic-student' }) }),
    { params: Promise.resolve({ stageSlug: 'synthetic-stage', reservationId: 'synthetic-reservation' }) });
  expect(response.status).toBe(200);
  const update = jest.mocked(prisma.stageReservation.updateMany).mock.calls[0][0];
  expect(update?.data).not.toHaveProperty('paymentStatus');
  expect(update?.data).toEqual(expect.objectContaining({ richStatus: 'CONFIRMED', studentId: 'synthetic-student' }));
});
