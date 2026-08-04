/**
 * P0-C closure against isolated PostgreSQL: legacy PDF, current-link authority and read-only access.
 */

jest.unmock('@/lib/prisma');

import { NextRequest } from 'next/server';

import { createGetLegacyParentBilanPdfHandler } from '@/lib/bilans/api/legacy-parent-pdf';
import { createGetParentChildReportsHandler } from '@/lib/bilans/api/parent-reports';
import { prisma } from '@/lib/prisma';

const PREFIX = 'p0c-closure-';
const NOW = new Date('2026-08-04T10:00:00.000Z');
const FUTURE = new Date('2027-08-04T10:00:00.000Z');

type LinkState = 'PENDING_PARENT_CONSENT' | 'VERIFIED' | 'REVOKED' | 'EXPIRED';
type Family = Readonly<{
  parentUserId: string;
  parentProfileId: string;
  studentId: string;
  studentEmail: string;
}>;

function assertIsolatedDatabase(): void {
  const target = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
  expect(target).toMatch(/(?:localhost|127\.0\.0\.1)/);
  expect(target).toMatch(/nexus_(?:p0c_parent_test|test|e2e|bilan_runtime_test)/);
  expect(target).not.toMatch(/nexus_prod|production/i);
}

function parentSession(parentUserId: string) {
  return { user: { id: parentUserId, role: 'PARENT' } } as never;
}

function expectPrivateNoStore(response: Response): void {
  expect(response.headers.get('cache-control')).toContain('private, no-store, max-age=0');
  expect(response.headers.get('pragma')).toBe('no-cache');
  expect(response.headers.get('expires')).toBe('0');
  expect(response.headers.get('etag')).toBeNull();
}

async function resetFixtures(): Promise<void> {
  await prisma.bilan.deleteMany({ where: { studentEmail: { startsWith: PREFIX } } });
  await prisma.parentStudentLink.deleteMany({
    where: { student: { user: { email: { startsWith: PREFIX } } } },
  });
  await prisma.student.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
  await prisma.parentProfile.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

async function createFamily(suffix: string): Promise<Family> {
  const parent = await prisma.user.create({
    data: {
      email: `${PREFIX}parent-${suffix}@example.test`,
      role: 'PARENT',
      activatedAt: NOW,
      parentProfile: { create: {} },
    },
    include: { parentProfile: true },
  });
  const studentEmail = `${PREFIX}student-${suffix}@example.test`;
  const studentUser = await prisma.user.create({
    data: { email: studentEmail, role: 'ELEVE', activatedAt: NOW },
  });
  const student = await prisma.student.create({
    data: {
      userId: studentUser.id,
      parentId: parent.parentProfile!.id,
      gradeLevel: 'SECONDE',
    },
  });
  return {
    parentUserId: parent.id,
    parentProfileId: parent.parentProfile!.id,
    studentId: student.id,
    studentEmail,
  };
}

async function createLink(
  family: Family,
  state: LinkState,
  updatedAt = NOW,
  overrides: Readonly<{ parentUserId?: string; studentId?: string; expiresAt?: Date | null }> = {},
) {
  return prisma.parentStudentLink.create({
    data: {
      parentUserId: overrides.parentUserId ?? family.parentUserId,
      studentId: overrides.studentId ?? family.studentId,
      state,
      requestedAt: updatedAt,
      consentedAt: state === 'VERIFIED' ? updatedAt : null,
      verifiedAt: state === 'VERIFIED' ? updatedAt : null,
      revokedAt: state === 'REVOKED' ? updatedAt : null,
      expiresAt: overrides.expiresAt === undefined
        ? state === 'EXPIRED' ? new Date('2026-08-03T10:00:00.000Z') : FUTURE
        : overrides.expiresAt,
      updatedAt,
    },
  });
}

async function createLegacyBilan(family: Family, suffix: string, published: boolean) {
  return prisma.bilan.create({
    data: {
      type: 'DIAGNOSTIC_PRE_STAGE',
      subject: 'MATHEMATIQUES',
      studentId: family.studentId,
      studentEmail: family.studentEmail,
      studentName: `Élève ${suffix}`,
      parentsMarkdown: `__PARENT_CHANNEL__ ${suffix}`,
      studentMarkdown: `__STUDENT_CHANNEL__ ${suffix}`,
      nexusMarkdown: `__NEXUS_CHANNEL__ ${suffix}`,
      analysisJson: { marker: `__INTERNAL_CHANNEL__ ${suffix}` },
      status: published ? 'COMPLETED' : 'GENERATING',
      isPublished: published,
      publishedAt: published ? NOW : null,
      ragCollections: [],
    },
  });
}

function legacyHandler(parentUserId: string | null) {
  return createGetLegacyParentBilanPdfHandler({
    prisma,
    authenticate: async () => parentUserId === null ? null : parentSession(parentUserId),
    renderPdf: async (data) => Buffer.from(`%PDF-${data.parentsMarkdown}`, 'utf8'),
    now: () => NOW,
    logger: { error: jest.fn() },
  });
}

function legacyRequest(bilanId: string) {
  return new NextRequest(`http://localhost/api/parent/bilans/${bilanId}/pdf`);
}

function legacyContext(bilanId: string) {
  return { params: Promise.resolve({ id: bilanId }) };
}

function listHandler(parentUserId: string, database = prisma) {
  return createGetParentChildReportsHandler({
    prisma: database as never,
    authenticate: async () => parentSession(parentUserId),
    resolvePack: () => ({ pack: { slug: 'fixture', version: 1, level: 'SECONDE', subject: 'MATHS' } }) as never,
    now: () => NOW,
  });
}

function listRequest(studentId: string) {
  return new NextRequest(`http://localhost/api/parent/children/${studentId}/bilans`);
}

function listContext(studentId: string) {
  return { params: Promise.resolve({ studentId }) };
}

async function readCounts() {
  const [bilans, students, links, attempts, outbox] = await Promise.all([
    prisma.bilan.count({ where: { studentEmail: { startsWith: PREFIX } } }),
    prisma.student.count({ where: { user: { email: { startsWith: PREFIX } } } }),
    prisma.parentStudentLink.count({ where: { student: { user: { email: { startsWith: PREFIX } } } } }),
    prisma.canonicalAssessmentAttempt.count({ where: { student: { user: { email: { startsWith: PREFIX } } } } }),
    prisma.jobOutbox.count(),
  ]);
  return { bilans, students, links, attempts, outbox };
}

describe('P0-C closure — PostgreSQL réel isolé', () => {
  let familyA: Family;
  let familyB: Family;
  let publishedA: Awaited<ReturnType<typeof createLegacyBilan>>;
  let draftA: Awaited<ReturnType<typeof createLegacyBilan>>;

  beforeAll(async () => {
    assertIsolatedDatabase();
    await resetFixtures();
    familyA = await createFamily('a');
    familyB = await createFamily('b');
    await createLink(familyA, 'VERIFIED');
    await createLink(familyB, 'VERIFIED');
    publishedA = await createLegacyBilan(familyA, 'published', true);
    draftA = await createLegacyBilan(familyA, 'draft', false);
  });

  afterAll(async () => {
    await resetFixtures();
    await prisma.$disconnect();
  });

  test('secures the direct legacy PDF route and returns only Parents data without writes', async () => {
    const before = await readCounts();
    const owner = await legacyHandler(familyA.parentUserId)(legacyRequest(publishedA.id), legacyContext(publishedA.id));
    const draft = await legacyHandler(familyA.parentUserId)(legacyRequest(draftA.id), legacyContext(draftA.id));
    const foreign = await legacyHandler(familyB.parentUserId)(legacyRequest(publishedA.id), legacyContext(publishedA.id));
    const anonymous = await legacyHandler(null)(legacyRequest(publishedA.id), legacyContext(publishedA.id));
    const body = Buffer.from(await owner.arrayBuffer()).toString('utf8');

    expect(owner.status).toBe(200);
    expect(owner.headers.get('content-type')).toBe('application/pdf');
    expect(body).toContain('%PDF-__PARENT_CHANNEL__');
    expect(body).not.toMatch(/__STUDENT_CHANNEL__|__NEXUS_CHANNEL__|__VERIFIER_CHANNEL__|__INTERNAL_CHANNEL__/);
    expect(draft.status).toBe(404);
    expect(foreign.status).toBe(404);
    expect(anonymous.status).toBe(401);
    for (const response of [owner, draft, foreign, anonymous]) expectPrivateNoStore(response);
    expect(await readCounts()).toEqual(before);
  });

  test.each<LinkState>(['PENDING_PARENT_CONSENT', 'REVOKED', 'EXPIRED'])(
    'makes current %s authoritative over matching legacy ownership',
    async (state) => {
      await prisma.parentStudentLink.deleteMany({ where: { parentUserId: familyA.parentUserId, studentId: familyA.studentId } });
      await createLink(familyA, state);
      const [list, legacy] = await Promise.all([
        listHandler(familyA.parentUserId)(listRequest(familyA.studentId), listContext(familyA.studentId)),
        legacyHandler(familyA.parentUserId)(legacyRequest(publishedA.id), legacyContext(publishedA.id)),
      ]);

      expect(list.status).toBe(404);
      expect(legacy.status).toBe(404);
      expectPrivateNoStore(list);
      expectPrivateNoStore(legacy);
    },
  );

  test('refuses absent, inconsistent and stale links without legacy fallback', async () => {
    await prisma.parentStudentLink.deleteMany({ where: { parentUserId: familyA.parentUserId, studentId: familyA.studentId } });
    const missing = await listHandler(familyA.parentUserId)(listRequest(familyA.studentId), listContext(familyA.studentId));

    await createLink(familyA, 'VERIFIED', new Date('2026-08-03T08:00:00.000Z'));
    await createLink(familyA, 'REVOKED', new Date('2026-08-04T09:00:00.000Z'));
    const newerRevoked = await listHandler(familyA.parentUserId)(listRequest(familyA.studentId), listContext(familyA.studentId));

    await prisma.parentStudentLink.deleteMany({ where: { parentUserId: familyA.parentUserId, studentId: familyA.studentId } });
    await prisma.parentStudentLink.create({
      data: {
        parentUserId: familyA.parentUserId,
        studentId: familyA.studentId,
        state: 'VERIFIED',
        requestedAt: NOW,
        verifiedAt: null,
        revokedAt: null,
        expiresAt: FUTURE,
      },
    });
    const malformed = await listHandler(familyA.parentUserId)(listRequest(familyA.studentId), listContext(familyA.studentId));

    expect(missing.status).toBe(404);
    expect(newerRevoked.status).toBe(404);
    expect(malformed.status).toBe(404);
    for (const response of [missing, newerRevoked, malformed]) expectPrivateNoStore(response);
  });

  test('observes a revocation committed while authorization is waiting', async () => {
    await prisma.parentStudentLink.deleteMany({ where: { parentUserId: familyA.parentUserId, studentId: familyA.studentId } });
    const link = await createLink(familyA, 'VERIFIED');
    let lookupStarted!: () => void;
    let releaseLookup!: () => void;
    const started = new Promise<void>((resolve) => { lookupStarted = resolve; });
    const release = new Promise<void>((resolve) => { releaseLookup = resolve; });
    const database = {
      student: prisma.student,
      canonicalAssessmentAttempt: prisma.canonicalAssessmentAttempt,
      parentStudentLink: {
        findFirst: async (args: unknown) => {
          lookupStarted();
          await release;
          return prisma.parentStudentLink.findFirst(args as never);
        },
      },
    };
    const pendingRead = listHandler(familyA.parentUserId, database as never)(
      listRequest(familyA.studentId),
      listContext(familyA.studentId),
    );

    await started;
    await prisma.parentStudentLink.update({
      where: { id: link.id },
      data: { state: 'REVOKED', revokedAt: NOW, revokedReason: 'P0C_CONCURRENT_TEST' },
    });
    releaseLookup();
    const response = await pendingRead;

    expect(response.status).toBe(404);
    expectPrivateNoStore(response);
  });
});
