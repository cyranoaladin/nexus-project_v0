/**
 * DELETE /api/admin/users — real PostgreSQL integration (jest.config.db.js).
 *
 * Proves, against a real database (not the global @/lib/prisma jest mock),
 * that migration 20260913200000_restrict_account_delete_cascades actually
 * changes route behavior: deleting a user with real history (here, an
 * active Subscription on their Student row) now fails with a clear 409
 * instead of silently cascade-deleting billing history, and deleting a
 * genuinely empty account still succeeds.
 *
 *   DATABASE_URL=postgresql://... npm run test:db -- admin-users-delete-restrict
 */
import { PrismaClient, UserRole, GradeLevel, SubscriptionStatus } from '@prisma/client';

jest.mock('@/lib/prisma', () => {
  // A plain top-level `import` can't be used here: jest.mock() factories are
  // hoisted above imports, so the real (non-Node/"browser"-field) Prisma
  // client must be required synchronously inside the factory itself.
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
const RUN_ID = `t${Date.now().toString(36)}`;
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

afterAll(async () => {
  await realPrisma.subscription.deleteMany({ where: { student: { user: { id: { startsWith: RUN_ID } } } } });
  await realPrisma.student.deleteMany({ where: { user: { id: { startsWith: RUN_ID } } } });
  await realPrisma.parentProfile.deleteMany({ where: { user: { id: { startsWith: RUN_ID } } } });
  await realPrisma.user.deleteMany({ where: { id: { startsWith: RUN_ID } } });
  await realPrisma.$disconnect();
});

describe('DELETE /api/admin/users — Restrict foreign keys (real DB)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue({ user: { id: `${RUN_ID}-admin`, role: 'ADMIN' } });
  });

  it('returns 409 and does not delete a user with a real Subscription', async () => {
    const admin = await createUser(UserRole.ADMIN, 'admin');
    const studentUser = await createUser(UserRole.ELEVE, 'student-billed');
    const parentUser = await createUser(UserRole.ADMIN, 'parent-billed');
    const parentProfile = await realPrisma.parentProfile.create({
      data: { id: `${RUN_ID}-pp-billed`, userId: parentUser.id },
    });
    const student = await realPrisma.student.create({
      data: {
        id: `${RUN_ID}-student-billed`,
        userId: studentUser.id,
        parentId: parentProfile.id,
        gradeLevel: GradeLevel.TERMINALE,
      },
    });
    await realPrisma.subscription.create({
      data: {
        id: `${RUN_ID}-sub-billed`,
        studentId: student.id,
        planName: 'ACCES_PLATEFORME',
        monthlyPrice: 100,
        creditsPerMonth: 4,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date(),
      },
    });
    mockRequireRole.mockResolvedValue({ user: { id: admin.id, role: 'ADMIN' } });

    const res = await DELETE(deleteRequest(studentUser.id));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('CONFLICT');
    // The frontend (app/dashboard/admin/users/page.tsx) surfaces
    // `body.message`, not `body.error` — this must be a specific,
    // human-readable French explanation, never raw Prisma/Postgres text.
    expect(body.message).toContain('historique d\'abonnement');
    expect(body.message).not.toMatch(/Prisma|P2003|constraint/i);
    await expect(realPrisma.user.findUniqueOrThrow({ where: { id: studentUser.id } })).resolves.toBeTruthy();
  });

  it('returns 409 and does not delete a PARENT user who still has a Student (DELETE-3: migration 20260913210000)', async () => {
    // Before that migration, students_parentId_fkey was ON DELETE CASCADE:
    // deleting the parent's own user row cascaded User->ParentProfile->
    // Student, silently destroying the Student row itself (and everything
    // CASCADE-linked off it) without ever touching any of the 11 Restrict
    // constraints from 20260913200000, none of which fire on this path.
    const admin = await createUser(UserRole.ADMIN, 'admin3');
    const parentUser = await createUser(UserRole.ADMIN, 'parent-with-child');
    const parentProfile = await realPrisma.parentProfile.create({
      data: { id: `${RUN_ID}-pp-with-child`, userId: parentUser.id },
    });
    const studentUser = await createUser(UserRole.ELEVE, 'child-of-parent');
    await realPrisma.student.create({
      data: {
        id: `${RUN_ID}-student-of-parent`,
        userId: studentUser.id,
        parentId: parentProfile.id,
        gradeLevel: GradeLevel.TERMINALE,
      },
    });
    mockRequireRole.mockResolvedValue({ user: { id: admin.id, role: 'ADMIN' } });

    const res = await DELETE(deleteRequest(parentUser.id));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('CONFLICT');
    expect(body.message).toContain('comptes élève rattachés');
    expect(body.message).not.toMatch(/Prisma|P2003|constraint/i);
    await expect(realPrisma.user.findUniqueOrThrow({ where: { id: parentUser.id } })).resolves.toBeTruthy();
    await expect(realPrisma.student.findUniqueOrThrow({ where: { id: `${RUN_ID}-student-of-parent` } })).resolves.toBeTruthy();
  });

  it('deletes a genuinely empty user (no history) successfully', async () => {
    const admin = await createUser(UserRole.ADMIN, 'admin2');
    const empty = await createUser(UserRole.ELEVE, 'empty');
    mockRequireRole.mockResolvedValue({ user: { id: admin.id, role: 'ADMIN' } });

    const res = await DELETE(deleteRequest(empty.id));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    await expect(realPrisma.user.findUnique({ where: { id: empty.id } })).resolves.toBeNull();
  });
});
