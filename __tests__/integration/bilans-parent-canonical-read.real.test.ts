/**
 * P0-C Parent Canonical status/report access against an isolated PostgreSQL database.
 * No production flag is read: the validated pack resolver is injected explicitly.
 */

jest.unmock('@/lib/prisma');

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { NextRequest } from 'next/server';

import {
  createGetParentChildReportsHandler,
  createGetParentReportHandler,
} from '@/lib/bilans/api/parent-reports';
import { createGetAttemptReportHandler } from '@/lib/bilans/api/get-report';
import { loadBilanPack } from '@/lib/bilans/catalog/load-pack';
import {
  audienceArtifactChecksum,
  materializationGlobalChecksum,
} from '@/lib/bilans/core/report-artifact-integrity';
import { BILAN_PRINT_BRAND_VERSION } from '@/lib/bilans/render/brand';
import { prisma } from '@/lib/prisma';

const PREFIX = 'p0c-parent-read-';
const NOW = new Date('2026-08-04T09:00:00.000Z');
const PACK_PATH = 'data/bilans/banks/entree-seconde-maths-v1.json';
const pack = loadBilanPack(PACK_PATH);
const packChecksum = createHash('sha256').update(readFileSync(PACK_PATH)).digest('hex');
const resolvePack = () => ({ pack }) as never;

type Family = Readonly<{
  parentUserId: string;
  studentIds: readonly string[];
}>;

function assertIsolatedDatabase(): void {
  const target = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
  expect(target).toMatch(/(?:localhost|127\.0\.0\.1)/);
  expect(target).toMatch(/nexus_(?:p0c_parent_test|test|e2e|bilan_runtime_test)/);
  expect(target).not.toMatch(/nexus_prod|production/i);
}

function session(parentUserId: string) {
  return { user: { id: parentUserId, role: 'PARENT' } } as never;
}

function listRequest(studentId: string): NextRequest {
  return new NextRequest(`http://localhost/api/parent/children/${studentId}/bilans`);
}

function reportRequest(studentId: string, attemptId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/parent/children/${studentId}/bilans/${attemptId}/report?format=html`,
  );
}

function listContext(studentId: string) {
  return { params: Promise.resolve({ studentId }) };
}

function reportContext(studentId: string, attemptId: string) {
  return { params: Promise.resolve({ studentId, attemptId }) };
}

async function resetFixtures(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "canonical_report_audience_artifacts",
      "canonical_report_materializations",
      "canonical_report_reviews",
      "canonical_report_revisions",
      "canonical_report_artifacts",
      "canonical_evidence_items",
      "canonical_score_snapshots",
      "canonical_job_outbox",
      "canonical_api_idempotency_keys",
      "canonical_assessment_attempts",
      "canonical_parent_student_links"
    CASCADE
  `);
  await prisma.student.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
  await prisma.coachProfile.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
  await prisma.parentProfile.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

async function createFamily(suffix: string, childCount: number): Promise<Family> {
  const parent = await prisma.user.create({
    data: {
      email: `${PREFIX}parent-${suffix}@example.test`,
      role: 'PARENT',
      activatedAt: NOW,
      parentProfile: { create: {} },
    },
    include: { parentProfile: true },
  });
  const studentIds: string[] = [];
  for (let index = 0; index < childCount; index += 1) {
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}student-${suffix}-${index}@example.test`,
        role: 'ELEVE',
        activatedAt: NOW,
      },
    });
    const student = await prisma.student.create({
      data: {
        userId: user.id,
        parentId: parent.parentProfile!.id,
        gradeLevel: 'SECONDE',
      },
    });
    await prisma.parentStudentLink.create({
      data: {
        parentUserId: parent.id,
        studentId: student.id,
        state: 'VERIFIED',
        consentedAt: NOW,
        verifiedAt: NOW,
        expiresAt: new Date('2027-08-04T09:00:00.000Z'),
      },
    });
    studentIds.push(student.id);
  }
  return { parentUserId: parent.id, studentIds };
}

async function createAttempt(studentId: string, suffix: string, status: 'SUBMITTED' | 'REPORT_PENDING_REVIEW' | 'PUBLISHED') {
  return prisma.canonicalAssessmentAttempt.create({
    data: {
      studentId,
      status,
      seed: `${PREFIX}${suffix}-seed`,
      startedAt: NOW,
      expiresAt: new Date('2026-08-04T12:00:00.000Z'),
      revision: 1,
      subject: 'MATHEMATIQUES',
      gradeLevel: 'SECONDE',
      answers: {},
      submittedAt: NOW,
      curriculumId: 'seconde.maths',
      curriculumVersion: '1',
      assessmentPackId: pack.slug,
      assessmentPackVersion: String(pack.version),
      assessmentPackChecksum: packChecksum,
      scoringPolicyId: 'facts',
      scoringPolicyVersion: '1.0.1',
    },
  });
}

function audienceArtifacts() {
  return (['ELEVE', 'PARENTS', 'NEXUS'] as const).map((audience) => {
    const marker = audience === 'ELEVE'
      ? '__STUDENT_CHANNEL__'
      : audience === 'PARENTS'
        ? '__PARENT_CHANNEL__'
        : '__NEXUS_CHANNEL__';
    const html = `<html><body>${marker}</body></html>`;
    const pdf = Buffer.from(`%PDF-1.4 ${marker}`);
    const pdfStatus = 'READY' as const;
    return {
      audience,
      html,
      pdf,
      pdfStatus,
      checksum: audienceArtifactChecksum({ audience, html, pdf, pdfStatus }),
    };
  });
}

async function createRevision(studentId: string, coachId: string, suffix: string, published: boolean) {
  const attempt = await createAttempt(
    studentId,
    suffix,
    published ? 'PUBLISHED' : 'REPORT_PENDING_REVIEW',
  );
  const score = await prisma.scoreSnapshot.create({
    data: {
      assessmentAttemptId: attempt.id,
      scoringPolicyId: 'facts',
      scoringPolicyVersion: '1.0.1',
      scoringPolicyChecksum: 'fixture-score-checksum',
      score: 50,
      result: { marker: '__INTERNAL_CHANNEL__' },
    },
  });
  const artifact = await prisma.reportArtifact.create({
    data: {
      studentId,
      assessmentAttemptId: attempt.id,
      status: 'PENDING_REVIEW',
    },
  });
  const revision = await prisma.reportRevision.create({
    data: {
      reportArtifactId: artifact.id,
      scoreSnapshotId: score.id,
      status: published ? 'COACH_VALIDATED' : 'PENDING_REVIEW',
      reportPackId: 'fixture-report',
      reportPackVersion: '1',
      corpusManifestId: 'disabled',
      corpusManifestVersion: '1',
      promptRevision: 'deterministic-v1',
      contextChecksum: `${suffix}-context`,
      content: { verifier: '__VERIFIER_CHANNEL__' },
      validationFailures: [],
    },
  });
  if (published) {
    await prisma.reportReview.create({
      data: {
        reportRevisionId: revision.id,
        coachId,
        decision: 'APPROVED',
        motif: 'Fixture synthétique P0-C.',
        reviewedAt: NOW,
      },
    });
    const audiences = audienceArtifacts();
    await prisma.reportMaterialization.create({
      data: {
        revisionId: revision.id,
        brandVersion: BILAN_PRINT_BRAND_VERSION,
        globalChecksum: materializationGlobalChecksum(BILAN_PRINT_BRAND_VERSION, audiences),
        materializedAt: NOW,
        audienceArtifacts: {
          create: audiences.map((entry) => ({ ...entry, pdf: Uint8Array.from(entry.pdf) })),
        },
      },
    });
    await prisma.reportArtifact.update({
      where: { id: artifact.id },
      data: {
        status: 'PUBLISHED',
        currentPublishedRevisionId: revision.id,
        publishedAt: NOW,
      },
    });
  }
  return { attempt, artifact, revision };
}

async function counts() {
  const [attempts, artifacts, revisions, materializations, audienceRows, jobs, idempotency] = await Promise.all([
    prisma.canonicalAssessmentAttempt.count(),
    prisma.reportArtifact.count(),
    prisma.reportRevision.count(),
    prisma.reportMaterialization.count(),
    prisma.reportAudienceArtifact.count(),
    prisma.jobOutbox.count(),
    prisma.canonicalApiIdempotencyKey.count(),
  ]);
  return { attempts, artifacts, revisions, materializations, audienceRows, jobs, idempotency };
}

function listHandler(parentUserId: string) {
  return createGetParentChildReportsHandler({
    prisma: prisma as never,
    authenticate: async () => session(parentUserId),
    resolvePack,
    now: () => NOW,
  });
}

function reportHandler(parentUserId: string) {
  const authenticate = async () => session(parentUserId);
  return createGetParentReportHandler({
    prisma: prisma as never,
    authenticate,
    resolvePack,
    now: () => NOW,
    serveReport: createGetAttemptReportHandler({
      prisma,
      authenticate,
      resolvePack,
      now: () => NOW,
    }),
  });
}

describe('P0-C Parent Canonical read path — PostgreSQL réel isolé', () => {
  let familyA: Family;
  let familyB: Family;
  let publishedA1: Awaited<ReturnType<typeof createRevision>>;
  let draftA2: Awaited<ReturnType<typeof createRevision>>;
  let attemptB1: Awaited<ReturnType<typeof createAttempt>>;
  let coachId: string;

  beforeAll(async () => {
    assertIsolatedDatabase();
    await resetFixtures();
    familyA = await createFamily('a', 2);
    familyB = await createFamily('b', 1);
    const coachUser = await prisma.user.create({
      data: { email: `${PREFIX}coach@example.test`, role: 'COACH', activatedAt: NOW },
    });
    coachId = (await prisma.coachProfile.create({
      data: { userId: coachUser.id, pseudonym: `${PREFIX}coach` },
    })).id;
    publishedA1 = await createRevision(familyA.studentIds[0], coachId, 'a1-published', true);
    draftA2 = await createRevision(familyA.studentIds[1], coachId, 'a2-draft', false);
    attemptB1 = await createAttempt(familyB.studentIds[0], 'b1-submitted', 'SUBMITTED');
  });

  afterAll(async () => {
    await resetFixtures();
    await prisma.$disconnect();
  });

  test('lists both owned children, refuses cross-family substitution and performs no write', async () => {
    const before = await counts();
    const [a1, a2, deniedAtoB, deniedBtoA] = await Promise.all([
      listHandler(familyA.parentUserId)(listRequest(familyA.studentIds[0]), listContext(familyA.studentIds[0])),
      listHandler(familyA.parentUserId)(listRequest(familyA.studentIds[1]), listContext(familyA.studentIds[1])),
      listHandler(familyA.parentUserId)(listRequest(familyB.studentIds[0]), listContext(familyB.studentIds[0])),
      listHandler(familyB.parentUserId)(listRequest(familyA.studentIds[0]), listContext(familyA.studentIds[0])),
    ]);

    expect(a1.status).toBe(200);
    expect(a2.status).toBe(200);
    expect((await a1.json()).bilans).toEqual([expect.objectContaining({
      attemptId: publishedA1.attempt.id,
      status: 'PUBLISHED',
      reportAvailable: true,
    })]);
    expect((await a2.json()).bilans).toEqual([expect.objectContaining({
      attemptId: draftA2.attempt.id,
      status: 'REPORT_PENDING_REVIEW',
      reportAvailable: false,
    })]);
    expect(deniedAtoB.status).toBe(404);
    expect(deniedBtoA.status).toBe(404);
    expect(await counts()).toEqual(before);
  });

  test('serves only PARENTS after publication and refuses drafts, foreign families and substituted attempts', async () => {
    const before = await counts();
    const published = await reportHandler(familyA.parentUserId)(
      reportRequest(familyA.studentIds[0], publishedA1.attempt.id),
      reportContext(familyA.studentIds[0], publishedA1.attempt.id),
    );
    const draft = await reportHandler(familyA.parentUserId)(
      reportRequest(familyA.studentIds[1], draftA2.attempt.id),
      reportContext(familyA.studentIds[1], draftA2.attempt.id),
    );
    const crossFamily = await reportHandler(familyB.parentUserId)(
      reportRequest(familyA.studentIds[0], publishedA1.attempt.id),
      reportContext(familyA.studentIds[0], publishedA1.attempt.id),
    );
    const substituted = await reportHandler(familyA.parentUserId)(
      reportRequest(familyA.studentIds[0], attemptB1.id),
      reportContext(familyA.studentIds[0], attemptB1.id),
    );
    const html = await published.text();

    expect(published.status).toBe(200);
    expect(html).toContain('__PARENT_CHANNEL__');
    expect(html).not.toMatch(/__STUDENT_CHANNEL__|__NEXUS_CHANNEL__|__VERIFIER_CHANNEL__|__INTERNAL_CHANNEL__/);
    expect(published.headers.get('cache-control')).toContain('private, no-store, max-age=0');
    expect(published.headers.get('pragma')).toBe('no-cache');
    expect(published.headers.get('expires')).toBe('0');
    expect(draft.status).toBe(404);
    expect(crossFamily.status).toBe(404);
    expect(substituted.status).toBe(404);
    expect(await counts()).toEqual(before);
  });

  test('keeps concurrent reads coherent and read-only', async () => {
    const before = await counts();
    const responses = await Promise.all(Array.from({ length: 12 }, () => reportHandler(familyA.parentUserId)(
      reportRequest(familyA.studentIds[0], publishedA1.attempt.id),
      reportContext(familyA.studentIds[0], publishedA1.attempt.id),
    )));
    const bodies = await Promise.all(responses.map((response) => response.text()));

    expect(responses.every(({ status }) => status === 200)).toBe(true);
    expect(new Set(bodies)).toEqual(new Set(['<html><body>__PARENT_CHANNEL__</body></html>']));
    expect(await counts()).toEqual(before);
  });

  test('never exposes a draft while publication is uncommitted', async () => {
    const audiences = audienceArtifacts();
    let transactionReady!: () => void;
    let releaseTransaction!: () => void;
    const ready = new Promise<void>((resolve) => { transactionReady = resolve; });
    const release = new Promise<void>((resolve) => { releaseTransaction = resolve; });

    const publication = prisma.$transaction(async (transaction) => {
      await transaction.reportReview.create({
        data: {
          reportRevisionId: draftA2.revision.id,
          coachId,
          decision: 'APPROVED',
          motif: 'Publication concurrente synthétique P0-C.',
          reviewedAt: NOW,
        },
      });
      await transaction.reportRevision.update({
        where: { id: draftA2.revision.id },
        data: { status: 'COACH_VALIDATED' },
      });
      await transaction.canonicalAssessmentAttempt.update({
        where: { id: draftA2.attempt.id },
        data: { status: 'COACH_VALIDATED' },
      });
      await transaction.reportMaterialization.create({
        data: {
          revisionId: draftA2.revision.id,
          brandVersion: BILAN_PRINT_BRAND_VERSION,
          globalChecksum: materializationGlobalChecksum(BILAN_PRINT_BRAND_VERSION, audiences),
          materializedAt: NOW,
          audienceArtifacts: {
            create: audiences.map((entry) => ({ ...entry, pdf: Uint8Array.from(entry.pdf) })),
          },
        },
      });
      await transaction.reportArtifact.update({
        where: { id: draftA2.artifact.id },
        data: {
          status: 'PUBLISHED',
          currentPublishedRevisionId: draftA2.revision.id,
          publishedAt: NOW,
        },
      });
      await transaction.canonicalAssessmentAttempt.update({
        where: { id: draftA2.attempt.id },
        data: { status: 'PUBLISHED' },
      });
      transactionReady();
      await release;
    });

    await ready;
    const during = await reportHandler(familyA.parentUserId)(
      reportRequest(familyA.studentIds[1], draftA2.attempt.id),
      reportContext(familyA.studentIds[1], draftA2.attempt.id),
    );
    expect(during.status).toBe(404);

    releaseTransaction();
    await publication;
    const after = await reportHandler(familyA.parentUserId)(
      reportRequest(familyA.studentIds[1], draftA2.attempt.id),
      reportContext(familyA.studentIds[1], draftA2.attempt.id),
    );
    expect(after.status).toBe(200);
    expect(await after.text()).toBe('<html><body>__PARENT_CHANNEL__</body></html>');
  });
});
