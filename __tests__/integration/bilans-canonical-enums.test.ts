jest.unmock('@/lib/prisma');

import { prisma } from '@/lib/prisma';

const PREFIX = `a89-enums-${Date.now()}-`;

describe('A89 Canonical subject and grade enums', () => {
  let attemptId: string | undefined;
  let studentId: string | undefined;
  let userId: string | undefined;
  let parentUserId: string | undefined;

  afterAll(async () => {
    if (attemptId !== undefined) {
      await prisma.canonicalAssessmentAttempt.deleteMany({ where: { id: attemptId } });
    }
    if (studentId !== undefined) await prisma.student.deleteMany({ where: { id: studentId } });
    if (parentUserId !== undefined) {
      await prisma.user.deleteMany({ where: { id: parentUserId } });
    }
    if (userId !== undefined) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test('persists a QUATRIEME attempt using MATHS_EXPERTES', async () => {
    const user = await prisma.user.create({
      data: { email: `${PREFIX}student@example.test`, role: 'ELEVE' },
    });
    userId = user.id;
    const parentUser = await prisma.user.create({
      data: { email: `${PREFIX}parent@example.test`, role: 'PARENT' },
    });
    parentUserId = parentUser.id;
    const parent = await prisma.parentProfile.create({
      data: { userId: parentUser.id },
    });
    const student = await prisma.student.create({
      data: {
        userId: user.id,
        parentId: parent.id,
        gradeLevel: 'QUATRIEME',
        academicTrack: 'COLLEGE',
      },
    });
    studentId = student.id;

    const attempt = await prisma.canonicalAssessmentAttempt.create({
      data: {
        studentId: student.id,
        status: 'DRAFT',
        seed: `${PREFIX}seed`,
        startedAt: new Date('2026-08-02T10:00:00.000Z'),
        expiresAt: new Date('2026-08-02T10:30:00.000Z'),
        subject: 'MATHS_EXPERTES',
        gradeLevel: 'QUATRIEME',
        answers: {},
        curriculumId: 'quatrieme.maths-expertes',
        curriculumVersion: '1',
        assessmentPackId: 'fixture-quatrieme-maths-expertes-v0',
        assessmentPackVersion: '1',
        assessmentPackChecksum: 'a'.repeat(64),
        scoringPolicyId: 'facts',
        scoringPolicyVersion: '1.0.1',
      },
    });
    attemptId = attempt.id;

    expect(attempt.subject).toBe('MATHS_EXPERTES');
    expect(attempt.gradeLevel).toBe('QUATRIEME');
  });
});
