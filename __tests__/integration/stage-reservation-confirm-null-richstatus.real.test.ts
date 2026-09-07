/**
 * Regression (PostgreSQL réel) — CAS de confirmation cassé par richStatus NULL.
 *
 * `StageReservation.richStatus` est nullable, sans défaut BDD. La route de
 * confirmation protège contre la double confirmation via un CAS :
 *
 *   updateMany({ where: { id, richStatus: { not: 'CONFIRMED' } }, ... })
 *
 * En logique SQL à trois valeurs, `richStatus <> 'CONFIRMED'` vaut NULL (pas
 * TRUE) quand `richStatus IS NULL` : `updateMany` ne matche alors aucune
 * ligne, et la route répond à tort 409 "Déjà confirmée" dès la toute
 * première tentative, bloquant définitivement la réservation. Un mock
 * Prisma ne peut pas reproduire ce bug (un mock `updateMany` n'exécute pas
 * de SQL) — ce test doit tourner contre un vrai Postgres.
 */

import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';

assertDisposablePostgresUrl(process.env.DATABASE_URL ?? '');

jest.unmock('@/lib/prisma');
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/email/outbox-scheduler', () => ({
  kickEmailOutboxDrain: jest.fn(),
}));

import { POST } from '@/app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.Mock;

const PREFIX = `stage-confirm-null-${Date.now()}`;

function makeRequest(stageSlug: string, reservationId: string, body: Record<string, unknown>) {
  return new NextRequest(
    `http://localhost:3000/api/stages/${stageSlug}/reservations/${reservationId}/confirm`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

function params(stageSlug: string, reservationId: string) {
  return { params: Promise.resolve({ stageSlug, reservationId }) };
}

async function cleanup() {
  await prisma.stageReservation.deleteMany({ where: { academyId: `${PREFIX}-academy` } });
  await prisma.stage.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.student.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
  await prisma.parentProfile.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

describe('POST confirm reservation — CAS null-safe sur richStatus (PostgreSQL réel)', () => {
  beforeAll(async () => {
    await cleanup();
    mockAuth.mockResolvedValue({
      user: { id: 'assistante-1', role: 'ASSISTANTE', email: `${PREFIX}-assistante@nexus.test` },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('confirme avec succès une réservation dont richStatus est NULL (jamais initialisé)', async () => {
    const stage = await prisma.stage.create({
      data: {
        slug: `${PREFIX}-stage`,
        title: 'Stage test CAS null-safe',
        startDate: new Date('2026-08-17'),
        endDate: new Date('2026-08-21'),
        priceAmount: 0,
      },
    });

    const parentUser = await prisma.user.create({
      data: { email: `${PREFIX}-parent@nexus-internal.local`, role: 'PARENT' },
    });
    const parentProfile = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
    const studentUser = await prisma.user.create({
      data: {
        email: `${PREFIX}-student@nexus-internal.local`,
        role: 'ELEVE',
        activatedAt: null,
      },
    });
    const student = await prisma.student.create({
      data: {
        userId: studentUser.id,
        parentId: parentProfile.id,
        gradeLevel: 'PREMIERE',
      },
    });

    const reservation = await prisma.stageReservation.create({
      data: {
        stageId: stage.id,
        parentName: 'Parent Test',
        studentName: 'Eleve Test',
        email: `${PREFIX}-parent@nexus-internal.local`,
        phone: '55000003',
        classe: 'Premiere',
        academyId: `${PREFIX}-academy`,
        academyTitle: 'Stage test',
        price: 0,
        status: 'PENDING',
        richStatus: null,
      },
    });
    expect(reservation.richStatus).toBeNull();

    const response = await POST(
      makeRequest(stage.slug, reservation.id, { studentId: student.id }),
      params(stage.slug, reservation.id),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const updated = await prisma.stageReservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(updated.richStatus).toBe('CONFIRMED');
    expect(updated.status).toBe('CONFIRMED');
    expect(updated.studentId).toBe(student.id);
  });
});
