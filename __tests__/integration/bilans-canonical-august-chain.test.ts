jest.unmock('@/lib/prisma');

import { NextRequest } from 'next/server';
import type { Session } from 'next-auth';

import { prisma } from '@/lib/prisma';
import { createCreateAttemptHandler } from '@/lib/bilans/api/create-attempt';
import { createGetAttemptHandler } from '@/lib/bilans/api/get-attempt';
import { createGetAttemptReportHandler } from '@/lib/bilans/api/get-report';
import { createPatchAnswersHandler } from '@/lib/bilans/api/patch-answers';
import { createSubmitAttemptHandler } from '@/lib/bilans/api/submit-attempt';
import {
  loadCanonicalAttempt,
  saveCanonicalAnswer,
  submitCanonicalAttempt,
  type RunnerFetch,
} from '@/lib/bilans/passation/runner-protocol';
import { validateAndPublishPendingReport } from '@/lib/bilans/staff/review-service';
import { previewPendingReport } from '@/lib/bilans/staff/review-service';
import { publishReportRevision } from '@/lib/bilans/core/report-service';
import type { PublicationRenderer } from '@/lib/bilans/core/report-materialization';
import { renderDeterministicBilanHtml } from '@/lib/bilans/render/html';
import { BILAN_PDF_ENGINE_VERSION } from '@/lib/bilans/render/pdf';
import { drainGenerateReportJobs, drainScoreAttemptJobs } from '@/lib/bilans/worker/drain-outbox';
import { processScoreAttemptJob } from '@/lib/bilans/worker/score-job';
import { processGenerateReportJob } from '@/lib/bilans/worker/generate-report-job';
import { MockBilanLlmTransport } from '@/lib/bilans/llm/mock-transport';
import {
  CANONICAL_WORKER_ANSWERS,
  CANONICAL_WORKER_ENABLED_PACK,
} from '@/__tests__/bilans/fixtures/canonical-worker';

const PREFIX = `a87-chain-${Date.now()}-`;
const NOW = new Date('2026-08-17T08:00:00.000Z');
const renderAudience: PublicationRenderer = async (factSheet, audience, identity, options) => ({
  status: 'AVAILABLE' as const,
  html: renderDeterministicBilanHtml(factSheet, audience, identity, options?.humanIdentity),
  pdf: Buffer.from(`%PDF-1.4 ${audience}`),
  engineVersion: BILAN_PDF_ENGINE_VERSION,
});

function session(userId: string, role: 'ELEVE' | 'PARENT' | 'COACH'): Session {
  return {
    user: { id: userId, email: `${PREFIX}${role.toLowerCase()}@example.test`, role },
    expires: '2026-08-18T08:00:00.000Z',
  } as Session;
}

describe('August Canonical bilan chain', () => {
  let studentUserId: string;
  let parentUserId: string;
  let coachUserId: string;
  let assistanteUserId: string;

  beforeAll(async () => {
    const parentUser = await prisma.user.create({ data: { email: `${PREFIX}parent@example.test`, role: 'PARENT' } });
    const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
    const studentUser = await prisma.user.create({
      data: {
        email: `${PREFIX}student@example.test`,
        role: 'ELEVE',
        firstName: 'Élise',
        lastName: 'Chaîne',
      },
    });
    const student = await prisma.student.create({
      data: { userId: studentUser.id, parentId: parent.id, gradeLevel: 'TERMINALE' },
    });
    await prisma.parentStudentLink.create({
      data: {
        parentUserId: parentUser.id,
        studentId: student.id,
        state: 'VERIFIED',
        consentedAt: NOW,
        verifiedAt: NOW,
      },
    });
    const coachUser = await prisma.user.create({ data: { email: `${PREFIX}coach@example.test`, role: 'COACH' } });
    const coach = await prisma.coachProfile.create({ data: { userId: coachUser.id, pseudonym: `${PREFIX}coach`, subjects: '[]' } });
    await prisma.coachStudentAssignment.create({
      data: { coachId: coach.id, studentId: student.id, status: 'ACTIVE', startsAt: new Date(NOW.getTime() - 60_000) },
    });
    const assistanteUser = await prisma.user.create({ data: { email: `${PREFIX}assistante@example.test`, role: 'ASSISTANTE' } });
    studentUserId = studentUser.id;
    parentUserId = parentUser.id;
    coachUserId = coachUser.id;
    assistanteUserId = assistanteUser.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('runner to reviewed publication serves each authorized audience', async () => {
    const externalFetch = jest.spyOn(global, 'fetch');
    const resolvePack = () => CANONICAL_WORKER_ENABLED_PACK;
    const studentSession = session(studentUserId, 'ELEVE');
    const create = createCreateAttemptHandler({
      prisma,
      authenticate: async () => studentSession,
      resolvePack,
      now: () => NOW,
      generateSeed: () => `${PREFIX}server-seed`,
    });
    const createdResponse = await create(new NextRequest('http://localhost/api/bilans/attempts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': `${PREFIX}create` },
      body: JSON.stringify({ packSlug: CANONICAL_WORKER_ENABLED_PACK.pack.slug }),
    }));
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json() as { attemptId: string };

    const handlerDependencies = { prisma, authenticate: async () => studentSession, resolvePack, now: () => NOW };
    const getAttempt = createGetAttemptHandler(handlerDependencies);
    const patchAnswers = createPatchAnswersHandler(handlerDependencies);
    const submitAttempt = createSubmitAttemptHandler(handlerDependencies);
    const runnerFetch: RunnerFetch = async (input, init) => {
      const url = new URL(input, 'http://localhost');
      const request = new NextRequest(url, init === undefined ? undefined : {
        method: init.method,
        headers: init.headers,
        body: init.body,
      });
      const context = { params: Promise.resolve({ id: created.attemptId }) };
      if (request.method === 'GET' && url.pathname.endsWith(`/${created.attemptId}`)) return getAttempt(request, context);
      if (request.method === 'PATCH' && url.pathname.endsWith('/answers')) return patchAnswers(request, context);
      if (request.method === 'POST' && url.pathname.endsWith('/submit')) return submitAttempt(request, context);
      throw new Error('UNEXPECTED_RUNNER_REQUEST');
    };

    const initial = await loadCanonicalAttempt(created.attemptId, runnerFetch);
    let revision = initial.revision;
    const midpoint = Math.floor(initial.items.length / 2);
    for (const item of initial.items.slice(0, midpoint)) {
      const expected = CANONICAL_WORKER_ANSWERS[item.id];
      revision = (await saveCanonicalAnswer({
        attemptId: created.attemptId,
        revision,
        answer: { itemId: item.id, optionId: expected.optionId, confidence: expected.confidence },
      }, runnerFetch)).revision;
    }

    const resumed = await loadCanonicalAttempt(created.attemptId, runnerFetch);
    expect(resumed.revision).toBe(revision);
    expect(resumed.items.slice(0, midpoint).every((item) => item.savedAnswer.optionId !== null)).toBe(true);
    for (const item of resumed.items.slice(midpoint)) {
      const expected = CANONICAL_WORKER_ANSWERS[item.id];
      revision = (await saveCanonicalAnswer({
        attemptId: created.attemptId,
        revision,
        answer: { itemId: item.id, optionId: expected.optionId, confidence: expected.confidence },
      }, runnerFetch)).revision;
    }
    await expect(submitCanonicalAttempt({ attemptId: created.attemptId, revision }, runnerFetch))
      .resolves.toMatchObject({ status: 'SUBMITTED' });

    const workerDependencies = {
      prisma,
      resolvePack,
      now: () => new Date(NOW.getTime() + 120_000),
      logger: { info: jest.fn(), error: jest.fn() },
    };
    await expect(drainScoreAttemptJobs({ limit: 1, owner: 'a87-e2e' }, {
      prisma,
      processJob: (jobId) => processScoreAttemptJob(jobId, workerDependencies),
      logger: { info: jest.fn(), error: jest.fn() },
    })).resolves.toMatchObject({ claimed: 1, completed: 1, failed: 0 });
    await expect(drainGenerateReportJobs({ limit: 1, owner: 'a88-e2e' }, {
      prisma,
      processJob: (jobId) => processGenerateReportJob(jobId, { ...workerDependencies, buildTransport: () => new MockBilanLlmTransport() }),
      logger: { info: jest.fn(), error: jest.fn() },
    })).resolves.toMatchObject({ claimed: 1, completed: 1, failed: 0 });

    const pending = await prisma.reportRevision.findFirstOrThrow({
      where: { reportArtifact: { assessmentAttemptId: created.attemptId } },
    });
    expect(pending.status).toBe('PENDING_REVIEW');
    await expect(previewPendingReport({
      userId: assistanteUserId,
      role: 'ASSISTANTE',
      revisionId: pending.id,
    }, { resolvePack } as never)).resolves.toMatchObject({ official: false });
    expect(await prisma.reportMaterialization.count({ where: { revisionId: pending.id } })).toBe(0);
    await validateAndPublishPendingReport({
      userId: assistanteUserId,
      role: 'ASSISTANTE',
      revisionId: pending.id,
      motif: 'Relecture pédagogique E2E complète.',
    }, {
      resolvePack,
      publish: (input: Readonly<{ revisionId: string; reviewerId: string; publishedAt: Date }>) => (
        publishReportRevision({ prisma, ...input, renderAudience })
      ),
    } as never);
    expect((await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({ where: { id: created.attemptId } })).status)
      .toBe('PUBLISHED');

    async function reportFor(userSession: Session) {
      const handler = createGetAttemptReportHandler({
        prisma,
        authenticate: async () => userSession,
        resolvePack,
        now: () => new Date(NOW.getTime() + 180_000),
      });
      const response = await handler(
        new NextRequest(`http://localhost/api/bilans/attempts/${created.attemptId}/report`),
        { params: Promise.resolve({ id: created.attemptId }) },
      );
      expect(response.status).toBe(200);
      return response.text();
    }

    const [studentReport, parentReport, nexusReport] = await Promise.all([
      reportFor(studentSession),
      reportFor(session(parentUserId, 'PARENT')),
      reportFor(session(coachUserId, 'COACH')),
    ]);
    expect(studentReport).not.toMatch(/internalFacts|globalScore|calibrationIndex/);
    expect(parentReport).not.toMatch(/internalFacts|globalScore|calibrationIndex/);
    expect(nexusReport).toContain('Score global');
    expect(await prisma.reportMaterialization.count({ where: { revisionId: pending.id } })).toBe(1);
    expect(externalFetch).not.toHaveBeenCalled();
  });
});
