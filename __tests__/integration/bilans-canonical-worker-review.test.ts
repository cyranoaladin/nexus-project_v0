jest.unmock('@/lib/prisma');

import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';

import { createGetAttemptReportHandler } from '@/lib/bilans/api/get-report';
import {
  publishReportRevision,
  rejectReportRevision,
  validateReportRevision,
} from '@/lib/bilans/core/report-service';
import { processScoreAttemptJob } from '@/lib/bilans/worker/score-job';
import { processGenerateReportJob } from '@/lib/bilans/worker/generate-report-job';
import { drainGenerateReportJobs } from '@/lib/bilans/worker/drain-outbox';
import { MockBilanLlmTransport } from '@/lib/bilans/llm/mock-transport';
import { prisma } from '@/lib/prisma';
import { renderDeterministicBilanHtml } from '@/lib/bilans/render/html';
import { BILAN_PDF_ENGINE_VERSION } from '@/lib/bilans/render/pdf';
import {
  CANONICAL_WORKER_ANSWERS,
  CANONICAL_WORKER_ENABLED_PACK,
} from '@/__tests__/bilans/fixtures/canonical-worker';

const PREFIX = `a86-${Date.now()}-`;
const NOW = new Date('2026-08-02T15:00:00.000Z');
const logger = { info: jest.fn(), error: jest.fn() };
const renderAudience = async (...args: Parameters<typeof renderDeterministicBilanHtml>) => ({
  status: 'AVAILABLE' as const,
  html: renderDeterministicBilanHtml(...args),
  pdf: Buffer.from(`%PDF-1.4 ${args[1]}`),
  engineVersion: BILAN_PDF_ENGINE_VERSION,
});

describe('A86 deterministic worker and internal review service', () => {
  let studentId: string;
  let studentUserId: string;
  let parentUserId: string;
  let reviewerId: string;
  let attemptA: string;
  let attemptB: string;

  async function seedAttempt(suffix: string) {
    const attempt = await prisma.canonicalAssessmentAttempt.create({
      data: {
        studentId,
        status: 'SUBMITTED',
        seed: `${PREFIX}${suffix}-seed`,
        startedAt: new Date('2026-08-02T14:40:00.000Z'),
        expiresAt: new Date('2026-08-03T15:00:00.000Z'),
        revision: 2,
        subject: 'MATHEMATIQUES',
        gradeLevel: 'TERMINALE',
        answers: CANONICAL_WORKER_ANSWERS,
        submittedAt: new Date('2026-08-02T14:55:00.000Z'),
        curriculumId: 'terminale.maths',
        curriculumVersion: '1',
        assessmentPackId: CANONICAL_WORKER_ENABLED_PACK.pack.slug,
        assessmentPackVersion: String(CANONICAL_WORKER_ENABLED_PACK.pack.version),
        assessmentPackChecksum: CANONICAL_WORKER_ENABLED_PACK.checksum,
        scoringPolicyId: 'facts',
        scoringPolicyVersion: '1.0.1',
      },
    });
    const job = await prisma.jobOutbox.create({
      data: {
        jobType: 'SCORE_ATTEMPT',
        aggregateType: 'CanonicalAssessmentAttempt',
        aggregateId: attempt.id,
        sourceEventKey: `${attempt.id}.submitted`,
        idempotencyKey: `${attempt.id}.score`,
        payload: {
          attemptId: attempt.id,
          packSlug: CANONICAL_WORKER_ENABLED_PACK.pack.slug,
          packVersion: CANONICAL_WORKER_ENABLED_PACK.pack.version,
        },
      },
    });
    return { attempt, job };
  }

  beforeAll(async () => {
    const parentUser = await prisma.user.create({ data: { email: `${PREFIX}parent@example.test`, role: 'PARENT' } });
    parentUserId = parentUser.id;
    const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
    const studentUser = await prisma.user.create({ data: { email: `${PREFIX}student@example.test`, role: 'ELEVE' } });
    studentUserId = studentUser.id;
    const student = await prisma.student.create({ data: { userId: studentUser.id, parentId: parent.id, gradeLevel: 'TERMINALE' } });
    studentId = student.id;
    await prisma.parentStudentLink.create({
      data: { parentUserId, studentId, state: 'VERIFIED', verifiedAt: NOW, consentedAt: NOW },
    });
    const assistanteUser = await prisma.user.create({ data: { email: `${PREFIX}assistante@example.test`, role: 'ASSISTANTE' } });
    reviewerId = assistanteUser.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "canonical_report_reviews", "canonical_report_revisions", "canonical_report_artifacts",
        "canonical_evidence_items", "canonical_score_snapshots", "canonical_job_outbox",
        "canonical_assessment_attempts", "canonical_parent_student_links" CASCADE
    `);
    await prisma.student.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
    await prisma.parentProfile.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  const dependencies = {
    prisma,
    resolvePack: () => CANONICAL_WORKER_ENABLED_PACK,
    now: () => NOW,
    logger,
  };
  const generateReportDependencies = {
    ...dependencies,
    buildTransport: () => new MockBilanLlmTransport(),
  };

  async function runGenerateReportJob(attemptId: string) {
    const job = await prisma.jobOutbox.findUniqueOrThrow({
      where: { idempotencyKey: `${attemptId}.generate-report` },
    });
    return processGenerateReportJob(job.id, generateReportDependencies);
  }

  test('same answers produce byte-identical artifacts without network and replay is idempotent', async () => {
    const seededA = await seedAttempt('det-a');
    const seededB = await seedAttempt('det-b');
    attemptA = seededA.attempt.id;
    attemptB = seededB.attempt.id;
    const fetchSpy = jest.spyOn(global, 'fetch');
    try {
      await processScoreAttemptJob(seededA.job.id, dependencies);
      await processScoreAttemptJob(seededB.job.id, dependencies);
      await processScoreAttemptJob(seededA.job.id, dependencies);
      await runGenerateReportJob(attemptA);
      await runGenerateReportJob(attemptB);
      await runGenerateReportJob(attemptA);
    } finally {
      fetchSpy.mockRestore();
    }

    const [artifactA, artifactB] = await Promise.all([
      prisma.reportRevision.findFirstOrThrow({ where: { reportArtifact: { assessmentAttemptId: attemptA } } }),
      prisma.reportRevision.findFirstOrThrow({ where: { reportArtifact: { assessmentAttemptId: attemptB } } }),
    ]);
    const withoutAttemptIdentity = (content: unknown) => JSON.stringify(content, (key, value) => (
      key === 'contextChecksum' || key === 'displayName' ? undefined : value
    ));
    expect(withoutAttemptIdentity(artifactA.content)).toBe(withoutAttemptIdentity(artifactB.content));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await prisma.scoreSnapshot.count({ where: { assessmentAttemptId: attemptA } })).toBe(1);
    expect(await prisma.reportRevision.count({ where: { reportArtifact: { assessmentAttemptId: attemptA } } })).toBe(1);
    expect(await prisma.evidenceItem.count({ where: { scoreSnapshot: { assessmentAttemptId: attemptA } } })).toBe(12);
    expect((await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({ where: { id: attemptA } })).status)
      .toBe('REPORT_PENDING_REVIEW');
    expect(await prisma.reportMaterialization.count({
      where: { revision: { reportArtifact: { assessmentAttemptId: { in: [attemptA, attemptB] } } } },
    })).toBe(0);
  });

  test.each([
    ['scoring', { computeFacts: () => { throw new Error('injected'); } }, 'A86_SCORING_FAILED'],
    ['rendering', { buildReports: () => { throw new Error('injected'); } }, 'A86_RENDER_FAILED'],
  ])('fails closed on injected %s failure', async (_label, injected, code) => {
    const seeded = await seedAttempt(`fail-${_label}`);
    await expect(processScoreAttemptJob(seeded.job.id, { ...dependencies, ...injected } as never)).rejects.toThrow(code);
    const [job, attempt] = await Promise.all([
      prisma.jobOutbox.findUniqueOrThrow({ where: { id: seeded.job.id } }),
      prisma.canonicalAssessmentAttempt.findUniqueOrThrow({ where: { id: seeded.attempt.id } }),
    ]);
    expect(job).toMatchObject({ status: 'FAILED', lastError: code });
    expect(attempt.status).toBe('SUBMITTED');
    expect(await prisma.scoreSnapshot.count({ where: { assessmentAttemptId: attempt.id } })).toBe(0);
    expect(await prisma.reportArtifact.count({ where: { assessmentAttemptId: attempt.id } })).toBe(0);
  });

  test('never publishes an invented report on LLM failure, then recovers on the next drain', async () => {
    const seeded = await seedAttempt('llm-fail');
    await processScoreAttemptJob(seeded.job.id, dependencies);
    const generateJob = await prisma.jobOutbox.findUniqueOrThrow({
      where: { idempotencyKey: `${seeded.attempt.id}.generate-report` },
    });

    const throwingTransport = { generate: async () => { throw new Error('network down'); } };
    await expect(processGenerateReportJob(generateJob.id, {
      ...dependencies,
      buildTransport: () => throwingTransport,
    })).rejects.toThrow('A88_NO_VALID_BUNDLE');

    expect(await prisma.reportRevision.count({ where: { reportArtifact: { assessmentAttemptId: seeded.attempt.id } } })).toBe(0);
    expect((await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({ where: { id: seeded.attempt.id } })).status)
      .toBe('REPORT_GENERATION_FAILED');
    expect((await prisma.jobOutbox.findUniqueOrThrow({ where: { id: generateJob.id } })))
      .toMatchObject({ status: 'FAILED', lastError: 'A88_NO_VALID_BUNDLE' });

    await drainGenerateReportJobs({ limit: 1, owner: 'a88-retry' }, {
      prisma,
      processJob: (jobId) => processGenerateReportJob(jobId, generateReportDependencies),
      logger,
    });

    expect((await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({ where: { id: seeded.attempt.id } })).status)
      .toBe('REPORT_PENDING_REVIEW');
    expect(await prisma.reportRevision.count({ where: { reportArtifact: { assessmentAttemptId: seeded.attempt.id } } })).toBe(1);
    expect((await prisma.jobOutbox.findUniqueOrThrow({ where: { id: generateJob.id } }))).toMatchObject({ status: 'COMPLETED' });
  });

  test('reviews then publishes explicitly and A85 serves only the authorized audience', async () => {
    const revision = await prisma.reportRevision.findFirstOrThrow({
      where: { reportArtifact: { assessmentAttemptId: attemptA } },
    });
    await validateReportRevision({ prisma, revisionId: revision.id, reviewerId, motif: 'Relecture synthétique A86.', reviewedAt: NOW });
    await publishReportRevision({ prisma, revisionId: revision.id, reviewerId, publishedAt: NOW, renderAudience });

    const handler = createGetAttemptReportHandler({
      prisma,
      authenticate: async () => ({ user: { id: studentUserId, role: 'ELEVE' } }) as never,
      resolvePack: () => CANONICAL_WORKER_ENABLED_PACK,
      now: () => NOW,
    });
    const response = await handler(
      new NextRequest(`http://localhost/api/bilans/attempts/${attemptA}/report`),
      { params: Promise.resolve({ id: attemptA }) },
    );
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).not.toMatch(/globalScore|coverage|calibrationIndex/);
    expect(await prisma.reportMaterialization.count({ where: { revisionId: revision.id } })).toBe(1);
    expect(await prisma.reportAudienceArtifact.count({
      where: { materialization: { revisionId: revision.id } },
    })).toBe(3);
    const beforeReplay = await prisma.reportMaterialization.findUniqueOrThrow({ where: { revisionId: revision.id } });
    await expect(publishReportRevision({ prisma, revisionId: revision.id, reviewerId, publishedAt: NOW, renderAudience }))
      .rejects.toThrow('REPORT_ALREADY_MATERIALIZED');
    expect(await prisma.reportMaterialization.findUniqueOrThrow({ where: { revisionId: revision.id } }))
      .toEqual(beforeReplay);
    await expect(prisma.reportMaterialization.update({
      where: { revisionId: revision.id },
      data: { globalChecksum: 'tampered' },
    })).rejects.toThrow(/insert-only/);
    expect(await prisma.reportMaterialization.findUniqueOrThrow({ where: { revisionId: revision.id } }))
      .toEqual(beforeReplay);
    await expect(prisma.reportMaterialization.create({
      data: {
        revisionId: revision.id,
        brandVersion: 'duplicate',
        globalChecksum: 'duplicate',
        materializedAt: NOW,
      },
    })).rejects.toMatchObject({ code: 'P2002' });
    const review = await prisma.reportReview.findFirstOrThrow({ where: { reportRevisionId: revision.id } });
    expect(review).toMatchObject({ reviewerId, reviewedAt: NOW, motif: 'Relecture synthétique A86.' });
  });

  test('rejects publication when validationFailures is non-empty, including after a coach action attempt', async () => {
    const attempt = await prisma.canonicalAssessmentAttempt.create({
      data: {
        studentId, status: 'REPORT_PENDING_REVIEW', seed: `${PREFIX}blocked-seed`,
        startedAt: NOW, expiresAt: new Date('2026-08-03T15:00:00.000Z'), revision: 2,
        subject: 'MATHEMATIQUES', gradeLevel: 'TERMINALE', answers: CANONICAL_WORKER_ANSWERS,
        submittedAt: NOW, curriculumId: 'terminale.maths', curriculumVersion: '1',
        assessmentPackId: CANONICAL_WORKER_ENABLED_PACK.pack.slug, assessmentPackVersion: '1',
        assessmentPackChecksum: CANONICAL_WORKER_ENABLED_PACK.checksum,
        scoringPolicyId: 'facts', scoringPolicyVersion: '1.0.1',
      },
    });
    const score = await prisma.scoreSnapshot.create({
      data: { assessmentAttemptId: attempt.id, scoringPolicyId: 'facts', scoringPolicyVersion: '1.0.1', scoringPolicyChecksum: 'c'.repeat(64), score: 0, result: {} },
    });
    const artifact = await prisma.reportArtifact.create({ data: { studentId, assessmentAttemptId: attempt.id, status: 'PENDING_REVIEW' } });
    const revision = await prisma.reportRevision.create({
      data: {
        reportArtifactId: artifact.id, scoreSnapshotId: score.id, status: 'PENDING_REVIEW',
        reportPackId: 'deterministic', reportPackVersion: '1', corpusManifestId: 'disabled',
        corpusManifestVersion: '1', promptRevision: 'none', contextChecksum: 'd'.repeat(64),
        content: {}, validationFailures: ['STRUCTURE_INVALID'],
      },
    });
    await expect(validateReportRevision({ prisma, revisionId: revision.id, reviewerId, motif: 'Ne doit pas passer.', reviewedAt: NOW }))
      .rejects.toThrow('REPORT_VALIDATION_FAILURES');
    await expect(publishReportRevision({ prisma, revisionId: revision.id, reviewerId, publishedAt: NOW }))
      .rejects.toThrow('REPORT_NOT_COACH_VALIDATED');
    expect((await prisma.reportArtifact.findUniqueOrThrow({ where: { id: artifact.id } })).status).not.toBe('PUBLISHED');
  });

  test('records a coach rejection and never publishes it', async () => {
    const revision = await prisma.reportRevision.findFirstOrThrow({
      where: { reportArtifact: { assessmentAttemptId: attemptB } },
    });
    await rejectReportRevision({ prisma, revisionId: revision.id, reviewerId, motif: 'Motif de rejet synthétique.', reviewedAt: NOW });
    expect((await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({ where: { id: attemptB } })).status).toBe('COACH_REJECTED');
    expect((await prisma.reportRevision.findUniqueOrThrow({ where: { id: revision.id } })).status).toBe('REJECTED');
    await expect(publishReportRevision({ prisma, revisionId: revision.id, reviewerId, publishedAt: NOW }))
      .rejects.toThrow('REPORT_NOT_COACH_VALIDATED');
  });
});
