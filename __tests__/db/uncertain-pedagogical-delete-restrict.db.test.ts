/**
 * DELETE /api/admin/users — real PostgreSQL integration (jest.config.db.js).
 *
 * Proves migration 20260914000000_restrict_uncertain_pedagogical_and_grant_cascades
 * actually changes behavior for 6 relations that were either never explicitly
 * reviewed for delete-cascade safety (entitlements, maths_progress,
 * nsi_practice_progress, eam_progress) or were reviewed but, on
 * re-examination for #273, found to carry real irreplaceable pedagogical/
 * grant history rather than disposable derived data (projection_history,
 * survival_progress) — see that migration's own comment for the full
 * reasoning per relation.
 *
 *   DATABASE_URL=postgresql://... npm run test:db -- uncertain-pedagogical-delete-restrict
 */
import { cleanupDisposableTestFixture } from '../helpers/real-db-fixture-cleanup';
import { PrismaClient, UserRole, GradeLevel, MathsLevel, AcademicTrack } from '@prisma/client';

jest.mock('@/lib/prisma', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require('@prisma/client');
  return { prisma: new PrismaClient() };
});
jest.mock('@/lib/guards', () => {
  const actual = jest.requireActual('@/lib/guards');
  return { ...actual, requireRole: jest.fn() };
});
jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn(() => Promise.resolve(null)),
}));

import { DELETE } from '@/app/api/admin/users/route';
import { requireRole } from '@/lib/guards';
import { NextRequest } from 'next/server';

const mockRequireRole = requireRole as jest.Mock;
const RUN_ID = `t${Date.now().toString(36)}up`;
const realPrisma: PrismaClient = jest.requireMock('@/lib/prisma').prisma;

function deleteRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/admin/users?id=${id}`, { method: 'DELETE' });
}

async function createUser(role: UserRole, suffix: string) {
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

async function createStudent(userId: string, suffix: string) {
  const parentUser = await createUser(UserRole.ADMIN, `parent-of-${suffix}`);
  const parentProfile = await realPrisma.parentProfile.create({
    data: { id: `${RUN_ID}-pp-${suffix}`, userId: parentUser.id },
  });
  return realPrisma.student.create({
    data: { id: `${RUN_ID}-student-${suffix}`, userId, parentId: parentProfile.id, gradeLevel: GradeLevel.TERMINALE },
  });
}

afterAll(async () => {
  await realPrisma.entitlement.deleteMany({ where: { userId: { startsWith: RUN_ID } } });
  await realPrisma.mathsProgress.deleteMany({ where: { userId: { startsWith: RUN_ID } } });
  await realPrisma.nsiPracticeProgress.deleteMany({ where: { userId: { startsWith: RUN_ID } } });
  await realPrisma.eamProgress.deleteMany({ where: { userId: { startsWith: RUN_ID } } });
  await realPrisma.projectionHistory.deleteMany({ where: { student: { user: { id: { startsWith: RUN_ID } } } } });
  await realPrisma.survivalProgress.deleteMany({ where: { student: { user: { id: { startsWith: RUN_ID } } } } });
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

describe('DELETE /api/admin/users — uncertain-pedagogical/grant Restrict foreign keys (real DB)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function expectRestricted(userId: string, expectedMessageFragment: string) {
    const admin = await createUser(UserRole.ADMIN, `admin-${userId.slice(-6)}`);
    mockRequireRole.mockResolvedValue({ user: { id: admin.id, role: 'ADMIN' } });

    const res = await DELETE(deleteRequest(userId));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('CONFLICT');
    expect(body.message).toContain(expectedMessageFragment);
    expect(body.message).not.toMatch(/Prisma|P2003|constraint/i);
    await expect(realPrisma.user.findUniqueOrThrow({ where: { id: userId } })).resolves.toBeTruthy();
  }

  it('returns 409 and does not delete a user with a real Entitlement', async () => {
    const user = await createUser(UserRole.ELEVE, 'entitled');
    await realPrisma.entitlement.create({
      data: { id: `${RUN_ID}-ent-1`, userId: user.id, productCode: 'ARIA_ACCESS', label: 'Test grant' },
    });
    await expectRestricted(user.id, 'droits d\'accès');
  });

  it('returns 409 and does not delete a user with real MathsProgress', async () => {
    const user = await createUser(UserRole.ELEVE, 'maths');
    await realPrisma.mathsProgress.create({
      data: { id: `${RUN_ID}-mp-1`, userId: user.id, level: MathsLevel.TERMINALE, track: AcademicTrack.EDS_GENERALE },
    });
    await expectRestricted(user.id, 'mathématiques');
  });

  it('returns 409 and does not delete a user with real NsiPracticeProgress', async () => {
    const user = await createUser(UserRole.ELEVE, 'nsi');
    await realPrisma.nsiPracticeProgress.create({
      data: { id: `${RUN_ID}-nsi-1`, userId: user.id, data: {} },
    });
    await expectRestricted(user.id, 'NSI');
  });

  it('returns 409 and does not delete a user with real EamProgress', async () => {
    const user = await createUser(UserRole.ELEVE, 'eam');
    await realPrisma.eamProgress.create({ data: { userId: user.id } });
    await expectRestricted(user.id, 'EAF');
  });

  it('returns 409 and does not delete a STUDENT user with real ProjectionHistory', async () => {
    const user = await createUser(UserRole.ELEVE, 'projection');
    const student = await createStudent(user.id, 'projection');
    await realPrisma.projectionHistory.create({
      data: {
        id: `${RUN_ID}-proj-1`,
        studentId: student.id,
        ssnProjected: 12,
        confidenceIndex: 0.5,
        modelVersion: 'test_v1',
      },
    });
    await expectRestricted(user.id, 'projections de notes');
  });

  it('returns 409 and does not delete a STUDENT user with real SurvivalProgress', async () => {
    const user = await createUser(UserRole.ELEVE, 'survival');
    const student = await createStudent(user.id, 'survival');
    await realPrisma.survivalProgress.create({
      data: {
        id: `${RUN_ID}-surv-1`,
        studentId: student.id,
        examDate: new Date('2027-06-01'),
        reflexesState: {},
        phrasesState: {},
        rituals: {},
      },
    });
    await expectRestricted(user.id, 'mode révision');
  });

  it('still deletes a genuinely empty user (no history in any of the 6 new relations)', async () => {
    const admin = await createUser(UserRole.ADMIN, 'admin-empty-uncertain');
    const empty = await createUser(UserRole.ELEVE, 'empty-uncertain');
    mockRequireRole.mockResolvedValue({ user: { id: admin.id, role: 'ADMIN' } });

    const res = await DELETE(deleteRequest(empty.id));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    await expect(realPrisma.user.findUnique({ where: { id: empty.id } })).resolves.toBeNull();
  });
});
