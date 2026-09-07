jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/email/outbox', () => ({
  enqueueEmailIntent: jest.fn().mockResolvedValue({ id: 'email-job-1' }),
}));
jest.mock('@/lib/email/outbox-scheduler', () => ({
  kickEmailOutboxDrain: jest.fn(),
}));

import { auth } from '@/auth';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';

const mockAuth = auth as jest.Mock;
let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
  process.env.NEXTAUTH_URL = 'https://nexusreussite.academy';
  mockAuth.mockResolvedValue({
    user: { id: 'assistante-1', role: 'ASSISTANTE', email: 'assistante@nexus.test' },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  });
});

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest(
    'http://localhost:3000/api/stages/printemps-2026/reservations/res-1/confirm',
    {
      method: 'POST',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    },
  );
}

function params() {
  return {
    params: Promise.resolve({ stageSlug: 'printemps-2026', reservationId: 'res-1' }),
  };
}

function pendingReservation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'res-1',
    email: 'shared@example.com',
    studentName: 'Eleve Test',
    parentName: 'Parent Test',
    classe: 'Terminale',
    richStatus: 'PENDING',
    stage: { title: 'Stage Printemps', slug: 'printemps-2026' },
    ...overrides,
  };
}

function pendingStudent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'student-1',
    userId: 'student-user-1',
    parentId: 'parent-profile-1',
    user: {
      id: 'student-user-1',
      firstName: 'Eleve',
      lastName: 'Test',
      role: 'ELEVE',
      activatedAt: null,
    },
    ...overrides,
  };
}

describe('POST /api/stages/[stageSlug]/reservations/[reservationId]/confirm — canonical Student.id required', () => {
  it('refuses confirmation without a studentId in the body', async () => {
    const response = await POST(makeRequest(), params());
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('STUDENT_LINK_REQUIRED');
    expect(prisma.stageReservation.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses confirmation with an empty studentId', async () => {
    const response = await POST(makeRequest({ studentId: '' }), params());
    expect(response.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses confirmation for a non-existent studentId', async () => {
    prisma.stageReservation.findFirst.mockResolvedValue(pendingReservation());
    prisma.student.findUnique.mockResolvedValue(null);

    const response = await POST(makeRequest({ studentId: 'no-such-student' }), params());
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('STUDENT_NOT_FOUND');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns 404 when the reservation itself does not exist', async () => {
    prisma.stageReservation.findFirst.mockResolvedValue(null);

    const response = await POST(makeRequest({ studentId: 'student-1' }), params());
    expect(response.status).toBe(404);
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
  });

  it('never creates a User, Student or touches the system-parent fallback', async () => {
    prisma.stageReservation.findFirst.mockResolvedValue(pendingReservation());
    prisma.student.findUnique.mockResolvedValue(pendingStudent());
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.stageReservation.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.update.mockResolvedValue({});

    await POST(makeRequest({ studentId: 'student-1' }), params());

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.student.create).not.toHaveBeenCalled();
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('confirms atomically: sets richStatus, studentId and paymentStatus in one CAS update, then enqueues one activation email', async () => {
    prisma.stageReservation.findFirst.mockResolvedValue(pendingReservation());
    prisma.student.findUnique.mockResolvedValue(pendingStudent());
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.stageReservation.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.update.mockResolvedValue({});

    const response = await POST(makeRequest({ studentId: 'student-1' }), params());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.stageReservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'res-1', OR: [{ richStatus: null }, { richStatus: { not: 'CONFIRMED' } }] },
        data: expect.objectContaining({
          richStatus: 'CONFIRMED',
          status: 'CONFIRMED',
          studentId: 'student-1',
          paymentStatus: 'COMPLETED',
        }),
      }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'student-user-1' } }),
    );
    expect(enqueueEmailIntent).toHaveBeenCalledTimes(1);
    expect(kickEmailOutboxDrain).toHaveBeenCalledTimes(1);
  });

  it('rolls back atomically and returns 409 without side effects when the CAS loses a race (already confirmed concurrently)', async () => {
    prisma.stageReservation.findFirst.mockResolvedValue(pendingReservation());
    prisma.student.findUnique.mockResolvedValue(pendingStudent());
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.stageReservation.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST(makeRequest({ studentId: 'student-1' }), params());
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('Déjà confirmée');
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(enqueueEmailIntent).not.toHaveBeenCalled();
    expect(kickEmailOutboxDrain).not.toHaveBeenCalled();
  });

  it('returns 409 immediately (fast path) when the reservation is already CONFIRMED, without opening a transaction', async () => {
    prisma.stageReservation.findFirst.mockResolvedValue(pendingReservation({ richStatus: 'CONFIRMED' }));

    const response = await POST(makeRequest({ studentId: 'student-1' }), params());

    expect(response.status).toBe(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not overwrite an already-activated student account: no fresh token, but the reservation still confirms and attaches once', async () => {
    prisma.stageReservation.findFirst.mockResolvedValue(pendingReservation());
    prisma.student.findUnique.mockResolvedValue(pendingStudent({
      user: {
        id: 'student-user-1',
        firstName: 'Eleve',
        lastName: 'Test',
        role: 'ELEVE',
        activatedAt: new Date('2026-01-15T00:00:00.000Z'),
      },
    }));
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.stageReservation.updateMany.mockResolvedValue({ count: 1 });

    const response = await POST(makeRequest({ studentId: 'student-1' }), params());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Réservation confirmée.');
    // Never wipes the real password / reissues a token for a live account.
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.stageReservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ activationToken: expect.anything() }),
      }),
    );
    expect(enqueueEmailIntent).toHaveBeenCalledTimes(1);
  });

  it('preserves payment state by only ever setting COMPLETED as part of the same atomic confirmation write (never a separate non-atomic write)', async () => {
    prisma.stageReservation.findFirst.mockResolvedValue(pendingReservation());
    prisma.student.findUnique.mockResolvedValue(pendingStudent());
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.stageReservation.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.update.mockResolvedValue({});

    await POST(makeRequest({ studentId: 'student-1' }), params());

    expect(prisma.stageReservation.update).not.toHaveBeenCalled();
    expect(prisma.stageReservation.updateMany).toHaveBeenCalledTimes(1);
  });
});
