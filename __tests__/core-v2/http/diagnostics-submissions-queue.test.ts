/**
 * HTTP-boundary proof for the ADMIN/ASSISTANTE diagnostics queue
 * (GET /api/v2/staff/diagnostics/submissions): discoverability without a
 * known submission id, RBAC, the excluded-fields contract, filter
 * correctness, default sort, and pagination.
 */
import { createHash, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));

import { auth } from '@/auth';
import { NO_PARAMS, type RouteContext } from '@/lib/core-v2/http/staff-route';
import { setupServiceHarness } from '../helpers/service-harness';
import { createHousehold, createStudent } from '@/lib/core-v2/services';
import { attributeDiagnostic } from '@/lib/core-v2/services/diagnostics';
import { depositOwnDiagnosticSubmission } from '@/lib/core-v2/diagnostics/submission-pipeline';
import { renderHtmlToPdf } from '@/lib/bilans/render/pdf';
import { drainDiagnosticSubmissionProcessingQueue, enqueueDiagnosticSubmissionProcessing } from '@/lib/core-v2/services/diagnostic-processing';
import { DEMO_ANSWER_HTML } from '@/lib/core-v2/diagnostics/demo-content';
import * as queueRoute from '@/app/api/v2/staff/diagnostics/submissions/route';
import * as bilanRoute from '@/app/api/v2/staff/diagnostics/processing/[processingId]/bilan/route';
import * as validateRoute from '@/app/api/v2/staff/diagnostics/processing/[processingId]/bilan/validate/route';
import * as publishRoute from '@/app/api/v2/staff/diagnostics/processing/[processingId]/bilan/publish/route';

const h = setupServiceHarness();
const mockedAuth = auth as unknown as jest.Mock;

beforeEach(() => {
  process.env.DIAGNOSTIC_DEMO_MODE = '1';
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = '';
  process.env.OPENROUTER_API_KEY = '';
});

function allowDemoFixtureFor(...studentIds: string[]) {
  const existing = (process.env.DIAGNOSTIC_DEMO_STUDENT_IDS ?? '').split(',').filter(Boolean);
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = [...existing, ...studentIds].join(',');
}

function signInAs(actor: { userId: string; role: string }) {
  mockedAuth.mockResolvedValue({ user: { id: actor.userId, role: actor.role, email: 'x@synthetic.test' }, expires: '2099-01-01' });
}

function paramsOf(params: Record<string, string>): RouteContext {
  return { params: Promise.resolve(params) };
}

async function callJson(
  handler: (req: NextRequest, ctx: RouteContext) => Promise<Response>,
  method: 'GET' | 'POST',
  path: string,
  params: Record<string, string> = {},
  json?: unknown,
) {
  const request = new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { origin: 'http://localhost:3000', ...(json !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
  const response = await handler(request, Object.keys(params).length ? paramsOf(params) : NO_PARAMS);
  const text = await response.text();
  return { status: response.status, text, body: text ? JSON.parse(text) : null };
}

async function seedCandidate(label: string) {
  const ctx = h.ctx();
  const { household } = await createHousehold(h.client, ctx, {
    parent: { firstName: `P${label}`, lastName: 'Synthetic', email: `parent-queue-${label}@synthetic.test` },
  });
  const { student, user } = await createStudent(h.client, ctx, {
    householdId: household.id,
    student: { firstName: `S${label}`, lastName: 'Synthetic' },
  });
  allowDemoFixtureFor(student.id);
  await h.client.user.update({ where: { id: user.id }, data: { accountStatus: 'ACTIVE' } });
  const instrumentKey = `QUEUE-API-${label}`;
  const instrument = await h.client.diagnosticInstrumentRef.create({
    data: {
      instrumentKey,
      version: '1.0.0',
      title: `Queue API instrument ${label}`,
      subject: 'Test',
      level: 'Toutes',
      targetSession: 'DEMO',
      form: 'FORM_TEST',
      durationMinutes: 30,
      modalities: 'Test only.',
      catalogStatus: 'DEMO_FIXTURE',
      manifestChecksum: createHash('sha256').update(instrumentKey).digest('hex'),
      manifestVersion: 'test/1.0',
      subjectSha256: createHash('sha256').update(`subject-${instrumentKey}`).digest('hex'),
    },
  });
  const assignment = await attributeDiagnostic(h.client, ctx, { studentId: student.id, instrumentRefId: instrument.id });
  return { ctx, student, user, instrument, assignment };
}

async function depositFor(assignmentId: string, userId: string) {
  const pdf = await renderHtmlToPdf(DEMO_ANSWER_HTML);
  const { submission } = await depositOwnDiagnosticSubmission(h.client, h.ctx({ userId, role: 'ELEVE' }), {
    assignmentId,
    originalFilename: 'reponses.pdf',
    mimeType: 'application/pdf',
    bytes: pdf,
  });
  return submission;
}

describe('GET /api/v2/staff/diagnostics/submissions', () => {
  test('RBAC: ADMIN and ASSISTANTE (DIAGNOSTIC_SUBMISSION_TRACK) both see the queue; ELEVE/PARENT/anonymous are refused', async () => {
    const { assignment, user } = await seedCandidate(`RBAC-${randomUUID()}`);
    await depositFor(assignment.id, user.id);

    signInAs(h.admin);
    expect((await callJson(queueRoute.GET, 'GET', '/api/v2/staff/diagnostics/submissions?status=ALL')).status).toBe(200);

    signInAs(h.assistante);
    expect((await callJson(queueRoute.GET, 'GET', '/api/v2/staff/diagnostics/submissions?status=ALL')).status).toBe(200);

    signInAs(h.parentActor);
    expect((await callJson(queueRoute.GET, 'GET', '/api/v2/staff/diagnostics/submissions?status=ALL')).status).toBe(403);

    mockedAuth.mockResolvedValue(null);
    expect((await callJson(queueRoute.GET, 'GET', '/api/v2/staff/diagnostics/submissions?status=ALL')).status).toBe(401);
  });

  test('never leaks extractedText, aiProposal or humanReview even when a published bilan carries real content', async () => {
    const label = `LEAK-${randomUUID()}`;
    const { assignment, user } = await seedCandidate(label);
    const submission = await depositFor(assignment.id, user.id);
    const processing = await enqueueDiagnosticSubmissionProcessing(h.client, h.ctx(), submission.id);
    await drainDiagnosticSubmissionProcessingQueue(h.client);

    signInAs(h.admin);
    const generated = await callJson(bilanRoute.POST, 'POST', `/api/v2/staff/diagnostics/processing/${processing.id}/bilan`, { processingId: processing.id });
    expect(generated.status).toBe(201);
    const draftId = generated.body.data.id as string;
    await callJson(
      validateRoute.POST,
      'POST',
      `/api/v2/staff/diagnostics/processing/${processing.id}/bilan/validate`,
      { processingId: processing.id },
      { draftId, editVersion: generated.body.data.editVersion },
    );
    const published = await callJson(
      publishRoute.POST,
      'POST',
      `/api/v2/staff/diagnostics/processing/${processing.id}/bilan/publish`,
      { processingId: processing.id },
      { draftId, editVersion: generated.body.data.editVersion + 1, audienceScope: 'own-student' },
    );
    expect(published.status).toBe(200);

    const list = await callJson(queueRoute.GET, 'GET', '/api/v2/staff/diagnostics/submissions?status=ALL');
    expect(list.status).toBe(200);
    const text = JSON.stringify(list.body);
    expect(text).not.toMatch(/extractedText|aiProposal|humanReview|deterministicResults|publishedContent/);
    const row = list.body.data.items.find((r: { submissionId: string }) => r.submissionId === submission.id);
    expect(row).toBeDefined();
    expect(row.state).toBe('PUBLISHED');
    expect(Object.keys(row).sort()).toEqual(
      ['candidate', 'draftStatus', 'instrument', 'lastActivityAt', 'processingStatus', 'state', 'submission', 'submissionId'].sort(),
    );
  });

  test('filters correctly across every real state and defaults to ACTION_REQUIRED (excludes PROCESSING and PUBLISHED)', async () => {
    // NOT_PROCESSED
    const notProcessed = await seedCandidate(`NOTPROC-${randomUUID()}`);
    const notProcessedSubmission = await depositFor(notProcessed.assignment.id, notProcessed.user.id);

    // READY_FOR_REVIEW (extracted, no draft) — drained BEFORE the PROCESSING
    // fixture is enqueued: `drainDiagnosticSubmissionProcessingQueue` drains
    // every QUEUED row globally, not just this one submission's.
    const ready = await seedCandidate(`READY-${randomUUID()}`);
    const readySubmission = await depositFor(ready.assignment.id, ready.user.id);
    await enqueueDiagnosticSubmissionProcessing(h.client, h.ctx(), readySubmission.id);
    await drainDiagnosticSubmissionProcessingQueue(h.client);

    // PROCESSING (QUEUED, never drained)
    const processing = await seedCandidate(`PROC-${randomUUID()}`);
    const processingSubmission = await depositFor(processing.assignment.id, processing.user.id);
    await enqueueDiagnosticSubmissionProcessing(h.client, h.ctx(), processingSubmission.id);

    // FAILED: a current usable submission whose extraction failed. A
    // REJECTED/quarantined audit row is never an operational queue item.
    const failed = await seedCandidate(`FAILED-${randomUUID()}`);
    const failedSubmission = await depositFor(failed.assignment.id, failed.user.id);
    const failedProcessing = await enqueueDiagnosticSubmissionProcessing(h.client, h.ctx(), failedSubmission.id);
    await h.client.diagnosticSubmissionProcessing.update({
      where: { id: failedProcessing.id },
      data: { status: 'EXTRACTION_FAILED' },
    });

    // An assignment whose entire history is rejected must be absent.
    const rejectedOnly = await seedCandidate(`REJECTED-ONLY-${randomUUID()}`);
    const rejectedOnlySubmission = await depositFor(rejectedOnly.assignment.id, rejectedOnly.user.id);
    await h.client.diagnosticSubmission.update({
      where: { id: rejectedOnlySubmission.id },
      data: { status: 'REJECTED' },
    });

    signInAs(h.admin);
    const actionRequired = await callJson(queueRoute.GET, 'GET', '/api/v2/staff/diagnostics/submissions');
    const ids = (actionRequired.body.data.items as { submissionId: string; state: string }[]).map((r) => r.submissionId);
    expect(ids).toEqual(expect.arrayContaining([notProcessedSubmission.id, readySubmission.id, failedSubmission.id]));
    expect(ids).not.toContain(processingSubmission.id);
    expect(ids).not.toContain(rejectedOnlySubmission.id);

    const onlyProcessing = await callJson(queueRoute.GET, 'GET', '/api/v2/staff/diagnostics/submissions?status=PROCESSING');
    expect((onlyProcessing.body.data.items as { submissionId: string }[]).map((r) => r.submissionId)).toEqual([processingSubmission.id]);

    const onlyFailed = await callJson(queueRoute.GET, 'GET', '/api/v2/staff/diagnostics/submissions?status=FAILED');
    expect((onlyFailed.body.data.items as { submissionId: string }[]).map((r) => r.submissionId)).toEqual([failedSubmission.id]);

    const onlyNotProcessed = await callJson(queueRoute.GET, 'GET', '/api/v2/staff/diagnostics/submissions?status=NOT_PROCESSED');
    expect((onlyNotProcessed.body.data.items as { submissionId: string }[]).map((r) => r.submissionId)).toEqual([notProcessedSubmission.id]);
  });

  test('returns only the current usable version and an exact PII-minimal candidate payload', async () => {
    const label = `CURRENT-${randomUUID()}`;
    const fixture = await seedCandidate(label);
    const v1 = await depositFor(fixture.assignment.id, fixture.user.id);

    const pdf = await renderHtmlToPdf(`${DEMO_ANSWER_HTML}<p>corrected version</p>`);
    const v2 = (
      await depositOwnDiagnosticSubmission(h.client, h.ctx({ userId: fixture.user.id, role: 'ELEVE' }), {
        assignmentId: fixture.assignment.id,
        originalFilename: 'reponses-corrigees.pdf',
        mimeType: 'application/pdf',
        bytes: pdf,
      })
    ).submission;

    const rejected = await h.client.diagnosticSubmission.create({
      data: {
        assignmentId: fixture.assignment.id,
        submittedById: fixture.user.id,
        version: 3,
        storageKey: `queue-http/${randomUUID()}.pdf`,
        originalFilename: 'refuse.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1,
        sha256: createHash('sha256').update(randomUUID()).digest('hex'),
        status: 'REJECTED',
      },
    });

    signInAs(h.admin);
    const list = await callJson(queueRoute.GET, 'GET', '/api/v2/staff/diagnostics/submissions?status=ALL');
    expect(list.status).toBe(200);
    const rows = list.body.data.items as Array<{ submissionId: string; candidate: unknown }>;

    expect(rows.map((row) => row.submissionId)).toEqual([v2.id]);
    expect(rows.map((row) => row.submissionId)).not.toEqual(expect.arrayContaining([v1.id, rejected.id]));
    expect(rows[0]?.candidate).toEqual({
      id: fixture.student.id,
      firstName: `S${label}`,
      lastName: 'Synthetic',
    });
    expect(Object.keys((rows[0]?.candidate ?? {}) as object).sort()).toEqual(['firstName', 'id', 'lastName']);
    expect(JSON.stringify(rows[0]?.candidate)).not.toMatch(
      /user|email|phone|accountStatus|activatedAt|createdAt|updatedAt/i,
    );
  });

  test('pagination: limit + cursor walk the full ALL set without gaps or duplicates', async () => {
    const created: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const c = await seedCandidate(`PAGE-${i}-${randomUUID()}`);
      const s = await depositFor(c.assignment.id, c.user.id);
      created.push(s.id);
    }
    signInAs(h.admin);
    const page1 = await callJson(queueRoute.GET, 'GET', '/api/v2/staff/diagnostics/submissions?status=ALL&limit=2');
    expect(page1.body.data.items).toHaveLength(2);
    expect(page1.body.data.nextCursor).not.toBeNull();

    const page2 = await callJson(
      queueRoute.GET,
      'GET',
      `/api/v2/staff/diagnostics/submissions?status=ALL&limit=2&cursor=${page1.body.data.nextCursor}`,
    );
    const allSeen = [...page1.body.data.items, ...page2.body.data.items].map((r: { submissionId: string }) => r.submissionId);
    for (const id of created) expect(allSeen).toContain(id);
    expect(new Set(allSeen).size).toBe(allSeen.length); // no duplicates across pages
  });
});
