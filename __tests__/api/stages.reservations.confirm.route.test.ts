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

function makeRequest() {
  return new NextRequest(
    'http://localhost:3000/api/stages/printemps-2026/reservations/res-1/confirm',
    { method: 'POST' },
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

describe('POST /api/stages/[stageSlug]/reservations/[reservationId]/confirm — role scoping P0', () => {
  it('refuses to attach a student activation token to an existing non-ELEVE account (e.g. PARENT)', async () => {
    prisma.stageReservation.findFirst.mockResolvedValue(pendingReservation());
    // The reservation email already belongs to an existing PARENT account.
    prisma.user.findUnique.mockResolvedValue({
      id: 'parent-user-1',
      email: 'shared@example.com',
      role: 'PARENT',
      student: null,
    });

    const response = await POST(makeRequest(), params());

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    // Must never overwrite the existing account's activation state.
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('still confirms normally when no account exists yet (creates a fresh ELEVE account)', async () => {
    prisma.stageReservation.findFirst.mockResolvedValue(pendingReservation());
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue({
      id: 'system-parent-user',
      email: 'parent-technique@nexusreussite.academy',
      parentProfile: { id: 'system-parent-profile' },
    });
    prisma.user.create.mockResolvedValue({
      id: 'new-student-user',
      email: 'shared@example.com',
      role: 'ELEVE',
      student: { id: 'student-entity-1' },
    });
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.stageReservation.update.mockResolvedValue({});
    prisma.user.update.mockResolvedValue({});

    const response = await POST(makeRequest(), params());

    expect(response.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'new-student-user' } }),
    );
  });

  it('still confirms normally for an existing ELEVE account with the same email', async () => {
    prisma.stageReservation.findFirst.mockResolvedValue(pendingReservation());
    prisma.user.findUnique.mockResolvedValue({
      id: 'existing-eleve-user',
      email: 'shared@example.com',
      role: 'ELEVE',
      student: { id: 'student-entity-1' },
    });
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.stageReservation.update.mockResolvedValue({});
    prisma.user.update.mockResolvedValue({});

    const response = await POST(makeRequest(), params());

    expect(response.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'existing-eleve-user' } }),
    );
  });
});
