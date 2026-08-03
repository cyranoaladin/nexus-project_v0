jest.unmock('@/lib/prisma');

import { prisma } from '@/lib/prisma';
import { withParentStudentConsentTransaction } from '@/lib/bilans/parent-student-consent';

const TEST_PREFIX = `parent-consent-concurrency-${Date.now()}-`;
const NOW = new Date('2026-08-03T12:00:00.000Z');

describe('parent-student consent concurrency — PostgreSQL réel isolé', () => {
  let parentUserId: string;
  let studentUserId: string;
  let studentId: string;

  beforeAll(async () => {
    const parentUser = await prisma.user.create({
      data: { email: `${TEST_PREFIX}parent@example.test`, role: 'PARENT' },
    });
    parentUserId = parentUser.id;
    const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
    const studentUser = await prisma.user.create({
      data: { email: `${TEST_PREFIX}student@example.test`, role: 'ELEVE' },
    });
    studentUserId = studentUser.id;
    const student = await prisma.student.create({
      data: { userId: studentUser.id, parentId: parent.id, gradeLevel: 'SECONDE' },
    });
    studentId = student.id;
  });

  afterAll(async () => {
    if (studentId !== undefined) {
      await prisma.parentStudentLink.deleteMany({ where: { studentId } });
      await prisma.student.deleteMany({ where: { id: studentId } });
    }
    if (parentUserId !== undefined) {
      await prisma.parentProfile.deleteMany({ where: { userId: parentUserId } });
    }
    const userIds = [parentUserId, studentUserId].filter((id): id is string => id !== undefined);
    if (userIds.length > 0) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it('serializes two independent preparations into one active pending link and no verified link', async () => {
    const prepare = () => withParentStudentConsentTransaction(prisma, (context) => context.preparePending({
      parentUserId,
      studentId,
      now: NOW,
    }));

    const [first, second] = await Promise.all([prepare(), prepare()]);
    const active = await prisma.parentStudentLink.findMany({
      where: {
        parentUserId,
        studentId,
        state: { in: ['PENDING_PARENT_CONSENT', 'VERIFIED'] },
      },
      orderBy: { id: 'asc' },
    });

    expect(first.id).toBe(second.id);
    expect(active).toHaveLength(1);
    expect(active[0]?.state).toBe('PENDING_PARENT_CONSENT');
    expect(active.some(({ state }) => state === 'VERIFIED')).toBe(false);
  });
});
