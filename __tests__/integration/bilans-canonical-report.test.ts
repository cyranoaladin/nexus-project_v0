jest.unmock('@/lib/prisma');

import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import {
  audienceArtifactChecksum,
  materializationGlobalChecksum,
} from '@/lib/bilans/core/report-materialization';
import { BILAN_PRINT_BRAND_VERSION } from '@/lib/bilans/render/brand';

const TEST_PREFIX = `a85-report-${Date.now()}-`;
const NOW = new Date('2026-08-02T12:00:00.000Z');
const PACK = {
  slug: 'fixture-non-publiable-v0',
  version: 1,
} as const;

type TestRole = 'ADMIN' | 'ASSISTANTE' | 'COACH' | 'PARENT' | 'ELEVE';

function request(attemptId: string, audience?: string, format?: 'html' | 'pdf'): NextRequest {
  const url = new URL(`http://localhost/api/bilans/attempts/${attemptId}/report`);
  if (audience !== undefined) url.searchParams.set('audience', audience);
  if (format !== undefined) url.searchParams.set('format', format);
  return new NextRequest(url);
}

function context(attemptId: string) {
  return { params: Promise.resolve({ id: attemptId }) };
}

function session(userId: string, role: TestRole) {
  return { user: { id: userId, role, email: `${TEST_PREFIX}${role.toLowerCase()}@example.test` } } as never;
}

const publicReport = (audience: 'ELEVE' | 'PARENTS') => ({
  status: 'REPORT_PENDING_REVIEW',
  audience,
  templateVersion: 'nexus-bilan-facts-v1',
  contextChecksum: `${audience.toLowerCase()}-checksum`,
  content: {
    narrative: { summary: audience === 'ELEVE' ? 'Priorité qualitative élève.' : 'Priorité qualitative parents.' },
    domains: [{ id: 'analyse', profile: 'A_RENFORCER' }],
  },
});

const reportBundle = {
  ELEVE: publicReport('ELEVE'),
  PARENTS: publicReport('PARENTS'),
  NEXUS: {
    status: 'REPORT_PENDING_REVIEW',
    audience: 'NEXUS',
    templateVersion: 'nexus-bilan-facts-v1',
    contextChecksum: 'nexus-checksum',
    content: {
      narrative: { summary: 'Priorité interne.' },
      domains: [{ id: 'analyse', profile: 'A_RENFORCER' }],
      internalFacts: { globalScore: 62, coverage: 1, calibrationIndex: 0.2, domainScores: [] },
    },
  },
};

describe('GET /api/bilans/attempts/[id]/report — PostgreSQL réel isolé', () => {
  let studentUserId: string;
  let verifiedParentUserId: string;
  let legacyParentUserId: string;
  let assignedCoachUserId: string;
  let unassignedCoachUserId: string;
  let adminUserId: string;
  let assistanteUserId: string;
  let publishedAttemptId: string;
  let failedAttemptId: string;
  let unsafeAttemptId: string;
  let unavailableAttemptId: string;

  async function createAttempt(studentId: string, suffix: string) {
    return prisma.canonicalAssessmentAttempt.create({
      data: {
        studentId,
        status: 'PUBLISHED',
        seed: `${TEST_PREFIX}${suffix}-seed`,
        startedAt: NOW,
        expiresAt: new Date('2026-08-03T12:00:00.000Z'),
        revision: 1,
        subject: 'MATHEMATIQUES',
        gradeLevel: 'TERMINALE',
        answers: {},
        submittedAt: NOW,
        curriculumId: 'terminale.maths',
        curriculumVersion: '1',
        assessmentPackId: PACK.slug,
        assessmentPackVersion: String(PACK.version),
        assessmentPackChecksum: 'fixture-checksum',
        scoringPolicyId: 'facts',
        scoringPolicyVersion: '1.0.1',
      },
    });
  }

  async function seedPublishedReport(
    studentId: string,
    coachId: string,
    suffix: string,
    content: object,
    pdfAvailable = true,
  ) {
    const attempt = await createAttempt(studentId, suffix);
    const score = await prisma.scoreSnapshot.create({
      data: {
        assessmentAttemptId: attempt.id,
        scoringPolicyId: 'facts',
        scoringPolicyVersion: '1.0.1',
        scoringPolicyChecksum: 'fixture-score-checksum',
        score: 62,
        result: {},
      },
    });
    const artifact = await prisma.reportArtifact.create({
      data: { studentId, assessmentAttemptId: attempt.id },
    });
    const revision = await prisma.reportRevision.create({
      data: {
        reportArtifactId: artifact.id,
        scoreSnapshotId: score.id,
        status: 'PENDING_REVIEW',
        reportPackId: 'fixture-report',
        reportPackVersion: '1',
        corpusManifestId: 'disabled',
        corpusManifestVersion: '1',
        promptRevision: 'deterministic-v1',
        contextChecksum: `${suffix}-context-checksum`,
        content,
        validationFailures: [],
      },
    });
    await prisma.reportReview.create({
      data: {
        reportRevisionId: revision.id,
        coachId,
        decision: 'APPROVED',
        motif: 'Fixture synthétique A85.7.',
      },
    });
    await prisma.reportRevision.update({
      where: { id: revision.id },
      data: { status: 'COACH_VALIDATED' },
    });
    const audienceArtifacts = (['ELEVE', 'PARENTS', 'NEXUS'] as const).map((audience) => {
      const html = `<html><body>${JSON.stringify((content as Record<string, unknown>)[audience])}</body></html>`;
      const pdf = pdfAvailable ? Buffer.from(`%PDF-1.4 ${audience}`) : null;
      const pdfStatus = pdfAvailable ? 'READY' as const : 'UNAVAILABLE' as const;
      return {
        audience,
        html,
        pdf,
        pdfStatus,
        checksum: audienceArtifactChecksum({ audience, html, pdf, pdfStatus }),
      };
    });
    await prisma.reportMaterialization.create({
      data: {
        revisionId: revision.id,
        brandVersion: BILAN_PRINT_BRAND_VERSION,
        globalChecksum: materializationGlobalChecksum(BILAN_PRINT_BRAND_VERSION, audienceArtifacts),
        materializedAt: NOW,
        audienceArtifacts: {
          create: audienceArtifacts.map((entry) => ({
            ...entry,
            pdf: entry.pdf === null ? null : Uint8Array.from(entry.pdf),
          })),
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
    return attempt.id;
  }

  beforeAll(async () => {
    const legacyParentUser = await prisma.user.create({
      data: { email: `${TEST_PREFIX}legacy-parent@example.test`, role: 'PARENT' },
    });
    legacyParentUserId = legacyParentUser.id;
    const legacyParent = await prisma.parentProfile.create({ data: { userId: legacyParentUser.id } });

    const studentUser = await prisma.user.create({
      data: { email: `${TEST_PREFIX}student@example.test`, role: 'ELEVE' },
    });
    studentUserId = studentUser.id;
    const student = await prisma.student.create({
      data: { userId: studentUser.id, parentId: legacyParent.id, gradeLevel: 'TERMINALE' },
    });

    const verifiedParent = await prisma.user.create({
      data: { email: `${TEST_PREFIX}verified-parent@example.test`, role: 'PARENT' },
    });
    verifiedParentUserId = verifiedParent.id;
    await prisma.parentProfile.create({ data: { userId: verifiedParent.id } });
    await prisma.parentStudentLink.create({
      data: {
        parentUserId: verifiedParent.id,
        studentId: student.id,
        state: 'VERIFIED',
        consentedAt: NOW,
        verifiedAt: NOW,
        expiresAt: new Date('2027-08-02T12:00:00.000Z'),
      },
    });

    const assignedCoachUser = await prisma.user.create({
      data: { email: `${TEST_PREFIX}assigned-coach@example.test`, role: 'COACH' },
    });
    assignedCoachUserId = assignedCoachUser.id;
    const assignedCoach = await prisma.coachProfile.create({
      data: { userId: assignedCoachUser.id, pseudonym: `${TEST_PREFIX}assigned` },
    });
    await prisma.coachStudentAssignment.create({
      data: { coachId: assignedCoach.id, studentId: student.id, status: 'ACTIVE', startsAt: NOW },
    });

    const unassignedCoachUser = await prisma.user.create({
      data: { email: `${TEST_PREFIX}unassigned-coach@example.test`, role: 'COACH' },
    });
    unassignedCoachUserId = unassignedCoachUser.id;
    await prisma.coachProfile.create({
      data: { userId: unassignedCoachUser.id, pseudonym: `${TEST_PREFIX}unassigned` },
    });

    const admin = await prisma.user.create({
      data: { email: `${TEST_PREFIX}admin@example.test`, role: 'ADMIN' },
    });
    adminUserId = admin.id;
    const assistante = await prisma.user.create({
      data: { email: `${TEST_PREFIX}assistante@example.test`, role: 'ASSISTANTE' },
    });
    assistanteUserId = assistante.id;

    publishedAttemptId = await seedPublishedReport(student.id, assignedCoach.id, 'published', reportBundle);
    unavailableAttemptId = await seedPublishedReport(
      student.id,
      assignedCoach.id,
      'pdf-unavailable',
      reportBundle,
      false,
    );
    unsafeAttemptId = await seedPublishedReport(student.id, assignedCoach.id, 'unsafe', {
      ...reportBundle,
      PARENTS: {
        ...reportBundle.PARENTS,
        content: { ...reportBundle.PARENTS.content, globalScore: 100 },
      },
    });

    const failedAttempt = await createAttempt(student.id, 'failed');
    failedAttemptId = failedAttempt.id;
    const failedScore = await prisma.scoreSnapshot.create({
      data: {
        assessmentAttemptId: failedAttempt.id,
        scoringPolicyId: 'facts',
        scoringPolicyVersion: '1.0.1',
        scoringPolicyChecksum: 'fixture-score-checksum',
        score: 30,
        result: {},
      },
    });
    const failedArtifact = await prisma.reportArtifact.create({
      data: { studentId: student.id, assessmentAttemptId: failedAttempt.id, status: 'PENDING_REVIEW' },
    });
    await prisma.reportRevision.create({
      data: {
        reportArtifactId: failedArtifact.id,
        scoreSnapshotId: failedScore.id,
        status: 'PENDING_REVIEW',
        reportPackId: 'fixture-report',
        reportPackVersion: '1',
        corpusManifestId: 'disabled',
        corpusManifestVersion: '1',
        promptRevision: 'deterministic-v1',
        contextChecksum: 'failed-context-checksum',
        content: reportBundle,
        validationFailures: ['V2: chiffre interdit'],
      },
    });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "canonical_report_reviews",
        "canonical_report_artifacts",
        "canonical_report_revisions",
        "canonical_score_snapshots",
        "canonical_assessment_attempts",
        "canonical_parent_student_links"
      CASCADE
    `);
    await prisma.coachStudentAssignment.deleteMany({
      where: { coach: { user: { email: { startsWith: TEST_PREFIX } } } },
    });
    await prisma.student.deleteMany({ where: { user: { email: { startsWith: TEST_PREFIX } } } });
    await prisma.coachProfile.deleteMany({ where: { user: { email: { startsWith: TEST_PREFIX } } } });
    await prisma.parentProfile.deleteMany({ where: { user: { email: { startsWith: TEST_PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } });
    await prisma.$disconnect();
  });

  function handlerFor(userId: string, role: TestRole) {
    const { createGetAttemptReportHandler } = require('@/lib/bilans/api/get-report') as typeof import('@/lib/bilans/api/get-report');
    return createGetAttemptReportHandler({
      prisma,
      authenticate: async () => session(userId, role),
      resolvePack: () => ({ pack: PACK }) as never,
      now: () => NOW,
    });
  }

  test('derives ELEVE from the session and ignores an audience query parameter', async () => {
    const response = await handlerFor(studentUserId, 'ELEVE')(
      request(publishedAttemptId, 'NEXUS'),
      context(publishedAttemptId),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(body).toContain('Priorité qualitative élève.');
    expect(body).not.toMatch(/internalFacts|globalScore|domainScores/);
  });

  test('returns PARENTS only through a current verified ParentStudentLink', async () => {
    const response = await handlerFor(verifiedParentUserId, 'PARENT')(
      request(publishedAttemptId),
      context(publishedAttemptId),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Priorité qualitative parents.');
  });

  test('does not reuse the legacy Student.parent relation as a parent fallback', async () => {
    const response = await handlerFor(legacyParentUserId, 'PARENT')(
      request(publishedAttemptId),
      context(publishedAttemptId),
    );
    expect(response.status).toBe(404);
  });

  test('returns NEXUS only to an assigned coach or an administrator', async () => {
    const coachResponse = await handlerFor(assignedCoachUserId, 'COACH')(
      request(publishedAttemptId),
      context(publishedAttemptId),
    );
    const adminResponse = await handlerFor(adminUserId, 'ADMIN')(
      request(publishedAttemptId),
      context(publishedAttemptId),
    );

    expect(coachResponse.status).toBe(200);
    expect(await coachResponse.text()).toContain('Priorité interne.');
    expect(adminResponse.status).toBe(200);
    expect(await adminResponse.text()).toContain('Priorité interne.');
  });

  test('serves the stored PDF through the renderer-free read path', async () => {
    const response = await handlerFor(studentUserId, 'ELEVE')(
      request(publishedAttemptId, undefined, 'pdf'),
      context(publishedAttemptId),
    );
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF');
  });

  test('serves HTML but reports PDF unavailability explicitly', async () => {
    const html = await handlerFor(studentUserId, 'ELEVE')(
      request(unavailableAttemptId, undefined, 'html'),
      context(unavailableAttemptId),
    );
    const pdf = await handlerFor(studentUserId, 'ELEVE')(
      request(unavailableAttemptId, undefined, 'pdf'),
      context(unavailableAttemptId),
    );
    expect(html.status).toBe(200);
    expect(await html.text()).toContain('Priorité qualitative élève.');
    expect(pdf.status).toBe(409);
    expect(await pdf.json()).toEqual({ error: { code: 'REPORT_PDF_UNAVAILABLE' } });
  });

  test.each([
    ['unassigned coach', () => handlerFor(unassignedCoachUserId, 'COACH')],
    ['assistante', () => handlerFor(assistanteUserId, 'ASSISTANTE')],
  ])('returns 404 to an unauthorized %s', async (_label, getHandler) => {
    const response = await getHandler()(request(publishedAttemptId), context(publishedAttemptId));
    expect(response.status).toBe(404);
  });

  test('returns 404 when the current report has validation failures', async () => {
    const response = await handlerFor(studentUserId, 'ELEVE')(
      request(failedAttemptId),
      context(failedAttemptId),
    );
    expect(response.status).toBe(404);
  });

  test('fails closed if a public audience payload contains a raw score', async () => {
    const response = await handlerFor(verifiedParentUserId, 'PARENT')(
      request(unsafeAttemptId),
      context(unsafeAttemptId),
    );
    expect(response.status).toBe(404);
  });

  test('returns 404 when the pack feature flag resolver is off', async () => {
    const { createGetAttemptReportHandler } = require('@/lib/bilans/api/get-report') as typeof import('@/lib/bilans/api/get-report');
    const handler = createGetAttemptReportHandler({
      prisma,
      authenticate: async () => session(studentUserId, 'ELEVE'),
      resolvePack: () => null,
      now: () => NOW,
    });
    const response = await handler(request(publishedAttemptId), context(publishedAttemptId));
    expect(response.status).toBe(404);
  });
});
