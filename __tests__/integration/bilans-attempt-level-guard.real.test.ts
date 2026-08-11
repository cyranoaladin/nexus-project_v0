/**
 * P0-B attempt level guard against a real, isolated PostgreSQL database.
 * The enabled resolver is injected: no real feature flag or pack is modified.
 */

jest.unmock('@/lib/prisma');

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { NextRequest } from 'next/server';

import { createCreateAttemptHandler } from '@/lib/bilans/api/create-attempt';
import { loadBilanPack } from '@/lib/bilans/catalog/load-pack';
import { prisma } from '@/lib/prisma';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';

const PREFIX = 'p0b-level-guard-';
const PACK_PATH = 'data/bilans/banks/entree-seconde-maths-v1.json';
const pack = loadBilanPack(PACK_PATH);
const checksum = createHash('sha256').update(readFileSync(PACK_PATH)).digest('hex');

function safeTestDatabase(): void {
  const target = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
  assertDisposablePostgresUrl(target);
}

function request(key: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/bilans/attempts', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify({ packSlug: pack.slug }),
  });
}

async function cleanup(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { contains: PREFIX } },
    include: { student: true, parentProfile: true },
  });
  const userIds = users.map(({ id }) => id);
  const studentIds = users.flatMap(({ student }) => student ? [student.id] : []);
  if (userIds.length === 0) return;

  await prisma.canonicalApiIdempotencyKey.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.canonicalAssessmentAttempt.deleteMany({ where: { studentId: { in: studentIds } } });
  await prisma.parentStudentLink.deleteMany({
    where: { OR: [{ parentUserId: { in: userIds } }, { studentId: { in: studentIds } }] },
  });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.parentProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createStudent(suffix: string, gradeLevel: 'SECONDE' | 'PREMIERE') {
  const parent = await prisma.user.create({
    data: {
      email: `${PREFIX}parent-${suffix}@example.test`,
      role: 'PARENT',
      parentProfile: { create: {} },
    },
    include: { parentProfile: true },
  });
  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}student-${suffix}@example.test`,
      role: 'ELEVE',
      activatedAt: new Date(),
    },
  });
  const student = await prisma.student.create({
    data: {
      parentId: parent.parentProfile!.id,
      userId: user.id,
      grade: gradeLevel === 'SECONDE' ? 'Seconde' : 'Première',
      gradeLevel,
    },
  });
  return { user, student };
}

function handlerFor(userId: string) {
  return createCreateAttemptHandler({
    prisma,
    authenticate: async () => ({ user: { id: userId, role: 'ELEVE' } }) as never,
    resolvePack: () => ({
      pack,
      validatedPack: pack as never,
      checksum,
      path: PACK_PATH,
    }),
    now: () => new Date('2026-08-04T08:00:00.000Z'),
    generateSeed: () => 'isolated-postgresql-seed',
  });
}

describe('P0-B level guard — real PostgreSQL', () => {
  beforeAll(async () => {
    safeTestDatabase();
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  test('creates exactly once for the matching level and writes nothing for concurrent mismatches', async () => {
    const matching = await createStudent('matching', 'SECONDE');
    const mismatching = await createStudent('mismatching', 'PREMIERE');

    const matchingHandler = handlerFor(matching.user.id);
    const first = await matchingHandler(request('p0b-matching-request'));
    const replay = await matchingHandler(request('p0b-matching-request'));
    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(await prisma.canonicalAssessmentAttempt.count({
      where: { studentId: matching.student.id },
    })).toBe(1);

    const before = {
      attempts: await prisma.canonicalAssessmentAttempt.count({
        where: { studentId: mismatching.student.id },
      }),
      idempotency: await prisma.canonicalApiIdempotencyKey.count({
        where: { userId: mismatching.user.id },
      }),
      scores: await prisma.scoreSnapshot.count(),
      jobs: await prisma.jobOutbox.count(),
      reports: await prisma.reportArtifact.count(),
    };

    const mismatchingHandler = handlerFor(mismatching.user.id);
    const responses = await Promise.all([
      mismatchingHandler(request('p0b-mismatch-request-a')),
      mismatchingHandler(request('p0b-mismatch-request-b')),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([409, 409]);
    await expect(Promise.all(responses.map((response) => response.json()))).resolves.toEqual([
      { error: { code: 'STUDENT_PACK_LEVEL_MISMATCH' } },
      { error: { code: 'STUDENT_PACK_LEVEL_MISMATCH' } },
    ]);

    const after = {
      attempts: await prisma.canonicalAssessmentAttempt.count({
        where: { studentId: mismatching.student.id },
      }),
      idempotency: await prisma.canonicalApiIdempotencyKey.count({
        where: { userId: mismatching.user.id },
      }),
      scores: await prisma.scoreSnapshot.count(),
      jobs: await prisma.jobOutbox.count(),
      reports: await prisma.reportArtifact.count(),
    };
    expect(after).toEqual(before);
    expect(after.attempts).toBe(0);
    expect(after.idempotency).toBe(0);
  });
});
