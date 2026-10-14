/** @jest-environment node */
import { randomUUID, randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { Pool } from 'pg';
import { prisma } from '@/lib/prisma';
import { generateAndPersistAriaPeriodicBilan } from '@/lib/aria/bilans/periodic/generate-and-persist-periodic-bilan';
import { prismaLearningEvidenceRepository } from '@/lib/aria/infrastructure/prisma/learning-evidence-repository';
import { seedAriaRealDbFixture, cleanupAriaRealDbFixture, type AriaRealDbFixtureIds } from '../helpers/aria-real-db';
import { delayFinalV1Verification } from '../helpers/delay-v1-final-authority';
import { ariaHttpCookie } from '../core-v2/helpers/aria-http-cookie';
jest.mock('@/lib/guards', () => ({ ...jest.requireActual('@/lib/guards'), requireAnyRole: jest.fn() }));
import { requireAnyRole } from '@/lib/guards';
import { POST as generateRoute } from '@/app/api/aria/bilans/periodic/route';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.AUTH_SECRET ??= randomBytes(32).toString('base64url');
const courseKey = 'eds-maths-premiere';
const inputBase = { courseKey, periodStart: new Date('2026-09-01'), periodEnd: new Date('2026-10-01') };
const generate = generateAndPersistAriaPeriodicBilan;
describe('periodic bilan uses the current V1 issuer scope', () => {
  let pool: Pool; let child: AriaRealDbFixtureIds; let coachId: string; let coachUserId: string;
  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL });
    child = await seedAriaRealDbFixture(pool, courseKey);
    coachUserId = randomUUID(); coachId = randomUUID();
    await prisma.user.create({ data: { id: coachUserId, role: 'COACH', email: `bilan-coach-${coachUserId}@invalid.test` } });
    await prisma.coachProfile.create({ data: { id: coachId, userId: coachUserId, pseudonym: `bilan-${coachId}`, subjects: [] } });
    await prismaLearningEvidenceRepository.create({ studentId: child.student, courseKey, skillId: 'ALG_SUITE_ARITH', curriculumVersion: '2026-v1',
      source: 'PRACTICE_ATTEMPT', sourceRefId: randomUUID(), observedAt: new Date('2026-09-15'),
      outcome: { outcome: 'CORRECT', activityAttemptId: randomUUID() } });
  });
  beforeEach(async () => {
    await prisma.bilan.deleteMany({ where: { studentId: child.student } });
    await prisma.coachStudentAssignment.deleteMany({ where: { coachId } });
    await prisma.coachProfile.update({ where: { id: coachId }, data: { subjects: ['MATHEMATIQUES'] } });
  });
  afterAll(async () => {
    await prisma.bilan.deleteMany({ where: { studentId: child.student } });
    await prisma.coachStudentAssignment.deleteMany({ where: { coachId } });
    await prisma.coachProfile.delete({ where: { id: coachId } });
    await prisma.user.delete({ where: { id: coachUserId } });
    await cleanupAriaRealDbFixture(pool, child); await pool.end();
  });
  test.each(['absent', 'ended', 'suspended', 'future', 'elapsed', 'unresolved', 'ambiguous', 'another-course'] as const)('refuses %s scope before any revealing read or mutation', async shape => {
    if (shape !== 'absent') await prisma.coachStudentAssignment.create({ data: { coachId, studentId: child.student,
      status: shape === 'ended' ? 'ENDED' : shape === 'suspended' ? 'SUSPENDED' : 'ACTIVE',
      startsAt: shape === 'future' ? new Date('2099-01-01') : new Date('2026-01-01'),
      endsAt: shape === 'elapsed' ? new Date('2026-02-01') : null,
      academicCourseKeys: [shape === 'another-course' ? 'eds-nsi-premiere' : courseKey],
      courseScopeState: shape === 'unresolved' ? 'BACKFILL_UNRESOLVED' : shape === 'ambiguous' ? 'BACKFILL_AMBIGUOUS' : 'STAFF_VERIFIED' } });
    const before = await prisma.bilan.count();
    const reads = jest.spyOn(prisma.student, 'findUnique');
    const evidence = jest.spyOn(prismaLearningEvidenceRepository, 'listForStudent');
    try {
      await expect(prisma.$transaction(async tx => {
        const read = jest.spyOn(tx.student, 'findUnique');
        const evidenceRead = jest.spyOn(tx.learningEvidence, 'findMany');
        try { return await generate({ ...inputBase, studentId: child.student, actor: { userId: coachUserId, role: 'COACH' } }, tx); }
        finally { expect(read).not.toHaveBeenCalled(); expect(evidenceRead).not.toHaveBeenCalled(); read.mockRestore(); evidenceRead.mockRestore(); }
      })).rejects.toMatchObject({ code: 'NOT_ENTITLED', status: 403 });
      expect(reads).not.toHaveBeenCalled(); expect(evidence).not.toHaveBeenCalled();
      expect(await prisma.bilan.count()).toBe(before);
    } finally { reads.mockRestore(); evidence.mockRestore(); }
  });
  test('an unknown student uses the same refusal as an unrelated student', async () => {
    await expect(prisma.$transaction(tx => generate({ ...inputBase, studentId: randomUUID(),
      actor: { userId: coachUserId, role: 'COACH' } }, tx))).rejects.toMatchObject({ code: 'NOT_ENTITLED', status: 403 });
  });
  test.each(['STAFF_VERIFIED', 'BACKFILL_AUTO'] as const)('permits a current explicitly scoped %s assignment without any Core membership', async courseScopeState => {
    await prisma.coachStudentAssignment.create({ data: { coachId, studentId: child.student, status: 'ACTIVE',
      startsAt: new Date('2026-01-01'), academicCourseKeys: [courseKey], courseScopeState } });
    const result = await prisma.$transaction(tx => generate({ ...inputBase, studentId: child.student,
      actor: { userId: coachUserId, role: 'COACH' } }, tx));
    expect(result).toMatchObject({ report: { totalAttemptsInPeriod: 1 } });
    expect(await prisma.bilan.count({ where: { studentId: child.student, isPublished: false } })).toBe(1);
  });
  test('an assignment expiring while the insert awaits is rolled back before commit', async () => {
    const expires = new Date(Date.now() + 1000);
    await prisma.coachStudentAssignment.create({ data: { coachId, studentId: child.student, status: 'ACTIVE',
      startsAt: new Date('2026-01-01'), endsAt: expires, academicCourseKeys: [courseKey], courseScopeState: 'STAFF_VERIFIED' } });
    await expect(prisma.$transaction(async tx => {
      const create = tx.bilan.create.bind(tx.bilan);
      // Le test ne lit que la ligne retournée : un Promise suffit à la place du Prisma__BilanClient chaînable.
      const delayedCreate = (async (args: Parameters<typeof create>[0]) => {
        const row = await create(args);
        await new Promise(resolve => setTimeout(resolve, Math.max(1, expires.getTime() - Date.now() + 30)));
        return row;
      }) as unknown as typeof tx.bilan.create;
      const inserted = jest.spyOn(tx.bilan, 'create').mockImplementation(delayedCreate);
      try { return await generate({ ...inputBase, studentId: child.student, actor: { userId: coachUserId, role: 'COACH' } }, tx); }
      finally { inserted.mockRestore(); }
    })).rejects.toMatchObject({ code: 'NOT_ENTITLED', status: 403 });
    expect(await prisma.bilan.count({ where: { studentId: child.student } })).toBe(0);
  });
  test('a removed coach capability refuses before reading the pupil or evidence despite an active explicit assignment', async () => {
    await prisma.coachStudentAssignment.create({ data: { coachId, studentId: child.student, status: 'ACTIVE',
      startsAt: new Date('2026-01-01'), academicCourseKeys: [courseKey], courseScopeState: 'STAFF_VERIFIED' } });
    await prisma.coachProfile.update({ where: { id: coachId }, data: { subjects: ['NSI'] } });
    const assignment = await prisma.coachStudentAssignment.findFirstOrThrow({ where: { coachId } });
    await expect(prisma.$transaction(async tx => {
      const read = jest.spyOn(tx.student, 'findUnique'); const evidence = jest.spyOn(tx.learningEvidence, 'findMany');
      try { return await generate({ ...inputBase, studentId: child.student, actor: { userId: coachUserId, role: 'COACH' } }, tx); }
      finally { expect(read).not.toHaveBeenCalled(); expect(evidence).not.toHaveBeenCalled(); read.mockRestore(); evidence.mockRestore(); }
    })).rejects.toMatchObject({ code: 'NOT_ENTITLED', status: 403 });
    expect(await prisma.coachStudentAssignment.findUnique({ where: { id: assignment.id } })).toEqual(assignment);
    expect(await prisma.bilan.count({ where: { studentId: child.student } })).toBe(0);
  });
  test('an assignment expiring during the final HTTP identity read leaves no bilan draft', async () => {
    await prisma.user.update({ where: { id: coachUserId }, data: { activatedAt: new Date() } });
    jest.mocked(requireAnyRole).mockResolvedValue({ user: { id: coachUserId, role: 'COACH', email: `bilan-coach-${coachUserId}@invalid.test`, authority: 'V1' },
      expires: '2099-01-01' });
    const expires = new Date(Date.now() + 1000);
    await prisma.coachStudentAssignment.create({ data: { coachId, studentId: child.student, status: 'ACTIVE',
      startsAt: new Date('2026-01-01'), endsAt: expires, academicCourseKeys: [courseKey], courseScopeState: 'STAFF_VERIFIED' } });
    const delayed = delayFinalV1Verification(prisma, expires, async tx => (await tx.bilan.count({ where: { studentId: child.student } })) === 1);
    try {
      const response = await generateRoute(new NextRequest('http://localhost:3000/api/aria/bilans/periodic', {
        method: 'POST', headers: await ariaHttpCookie(coachUserId), body: JSON.stringify({ ...inputBase, studentId: child.student,
          periodStart: inputBase.periodStart.toISOString(), periodEnd: inputBase.periodEnd.toISOString() }) }));
      expect(response.status).toBe(403); expect(delayed.didWait()).toBe(true);
      expect(await prisma.bilan.count({ where: { studentId: child.student } })).toBe(0);
    } finally { delayed.restore(); }
  });
});
