/**
 * DELETE /api/assistante/coaches/manage/[id] — real PostgreSQL integration
 * (jest.config.db.js).
 *
 * Before migration 20260913200000_restrict_account_delete_cascades, this
 * route had a manual pre-flight guard covering ONLY SessionBooking; a coach
 * with a CoachStudentAssignment (academic assignment history) but zero
 * SessionBooking rows would pass that guard and then be silently
 * cascade-deleted along with that assignment history. This proves the
 * route now surfaces that case as a 409 instead, and that a genuinely
 * unassigned coach can still be deleted.
 *
 *   DATABASE_URL=postgresql://... npm run test:db -- coach-manage-delete-restrict
 */
import { cleanupDisposableTestFixture } from '../helpers/real-db-fixture-cleanup';
import { GradeLevel, UserRole } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

jest.mock('@/lib/prisma', () => {
  // A plain top-level `import` can't be used here: jest.mock() factories are
  // hoisted above imports, so the real (non-Node/"browser"-field) Prisma
  // client must be required synchronously inside the factory itself.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require('@prisma/client');
  return { prisma: new PrismaClient() };
});
jest.mock('@/auth', () => ({ auth: jest.fn() }));

import { DELETE } from '@/app/api/assistante/coaches/manage/[id]/route';
import { auth } from '@/auth';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.Mock;
const RUN_ID = `t${Date.now().toString(36)}`;
const realPrisma: PrismaClient = jest.requireMock('@/lib/prisma').prisma;

function deleteRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/assistante/coaches/manage/x', { method: 'DELETE' });
}

async function createUser(suffix: string, role: UserRole = UserRole.COACH) {
  return realPrisma.user.create({
    data: {
      id: `${RUN_ID}-u-${suffix}`,
      email: `${RUN_ID}-${suffix}@example.test`,
      password: 'x',
      firstName: 'Test',
      lastName: suffix,
      role,
    },
  });
}

afterAll(async () => {
  await realPrisma.eafPreparationReport.deleteMany({ where: { coach: { user: { id: { startsWith: RUN_ID } } } } });
  await realPrisma.coachStudentAssignment.deleteMany({ where: { coach: { user: { id: { startsWith: RUN_ID } } } } });
  // Order comes from the live schema via the canonical fixture cleanup,
  // so this teardown no longer hand-maintains which relations are RESTRICT.
  const fixtureUserIds = (await realPrisma.user.findMany({
    where: { id: { startsWith: RUN_ID } },
    select: { id: true },
  })).map((user) => user.id);
  if (fixtureUserIds.length > 0) {
    await cleanupDisposableTestFixture(realPrisma, { userIds: fixtureUserIds });
  }
  await realPrisma.$disconnect();
});

describe('DELETE /api/assistante/coaches/manage/[id] — Restrict foreign keys (real DB)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 409 and does not delete a coach with an academic assignment (no session bookings)', async () => {
    const staff = await createUser('assistante', UserRole.ASSISTANTE);
    mockAuth.mockResolvedValue({ user: { id: staff.id, role: 'ASSISTANTE' } });

    const coachUser = await createUser('coach-assigned');
    const coach = await realPrisma.coachProfile.create({
      data: {
        id: `${RUN_ID}-coach-assigned`,
        userId: coachUser.id,
        pseudonym: `${RUN_ID}-pseudo-assigned`,
        subjects: [],
      },
    });
    const studentUser = await createUser('student-assigned', UserRole.ELEVE);
    const parentUser = await createUser('parent-assigned', UserRole.ADMIN);
    const parentProfile = await realPrisma.parentProfile.create({
      data: { id: `${RUN_ID}-pp-assigned`, userId: parentUser.id },
    });
    const student = await realPrisma.student.create({
      data: {
        id: `${RUN_ID}-student-assigned`,
        userId: studentUser.id,
        parentId: parentProfile.id,
        gradeLevel: GradeLevel.TERMINALE,
      },
    });
    await realPrisma.coachStudentAssignment.create({
      data: { id: `${RUN_ID}-assign`, coachId: coach.id, studentId: student.id },
    });

    const res = await DELETE(deleteRequest(), { params: Promise.resolve({ id: coachUser.id }) });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('CONFLICT');
    // The frontend (app/dashboard/assistante/coaches/page.tsx) surfaces
    // `body.message`, not `body.error` — this must be a specific,
    // human-readable French explanation, never raw Prisma/Postgres text.
    expect(body.message).toContain('affectations élève-coach');
    expect(body.message).not.toMatch(/Prisma|P2003|constraint/i);
    await expect(realPrisma.user.findUniqueOrThrow({ where: { id: coachUser.id } })).resolves.toBeTruthy();
  });

  it('returns 409 and does not delete a coach with an EAF preparation report on file, even with zero assignments or bookings (DELETE-4: migration 20260913220000)', async () => {
    // Before that migration, eaf_preparation_reports_coachId_fkey was ON
    // DELETE CASCADE: this route's `tx.coachProfile.delete(...)` call
    // deletes the CoachProfile directly, independent of any
    // SessionBooking/CoachStudentAssignment cascade — a coach with prior
    // report history but no current assignments would pass every existing
    // guard and then silently lose that report.
    const staff = await createUser('assistante3', UserRole.ASSISTANTE);
    mockAuth.mockResolvedValue({ user: { id: staff.id, role: 'ASSISTANTE' } });

    const coachUser = await createUser('coach-reported');
    const coach = await realPrisma.coachProfile.create({
      data: {
        id: `${RUN_ID}-coach-reported`,
        userId: coachUser.id,
        pseudonym: `${RUN_ID}-pseudo-reported`,
        subjects: [],
      },
    });
    const studentUser = await createUser('student-reported', UserRole.ELEVE);
    const parentUser = await createUser('parent-reported', UserRole.ADMIN);
    const parentProfile = await realPrisma.parentProfile.create({
      data: { id: `${RUN_ID}-pp-reported`, userId: parentUser.id },
    });
    const student = await realPrisma.student.create({
      data: {
        id: `${RUN_ID}-student-reported`,
        userId: studentUser.id,
        parentId: parentProfile.id,
        gradeLevel: GradeLevel.TERMINALE,
      },
    });
    await realPrisma.eafPreparationReport.create({
      data: { id: `${RUN_ID}-eaf-reported`, studentId: student.id, coachId: coach.id },
    });

    const res = await DELETE(deleteRequest(), { params: Promise.resolve({ id: coachUser.id }) });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('CONFLICT');
    expect(body.message).toContain('rapport de préparation EAF');
    expect(body.message).not.toMatch(/Prisma|P2003|constraint/i);
    await expect(realPrisma.coachProfile.findUniqueOrThrow({ where: { id: coach.id } })).resolves.toBeTruthy();
  });

  it('deletes a genuinely unassigned coach successfully', async () => {
    const staff = await createUser('assistante2', UserRole.ASSISTANTE);
    mockAuth.mockResolvedValue({ user: { id: staff.id, role: 'ASSISTANTE' } });

    const coachUser = await createUser('coach-empty');
    await realPrisma.coachProfile.create({
      data: {
        id: `${RUN_ID}-coach-empty`,
        userId: coachUser.id,
        pseudonym: `${RUN_ID}-pseudo-empty`,
        subjects: [],
      },
    });

    const res = await DELETE(deleteRequest(), { params: Promise.resolve({ id: coachUser.id }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    await expect(realPrisma.user.findUnique({ where: { id: coachUser.id } })).resolves.toBeNull();
  });
});
