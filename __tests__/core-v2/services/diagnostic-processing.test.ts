/**
 * C2, first increment (mission §9), hardened per mission §5: a receivable
 * DiagnosticSubmission → an enqueue/drain job lifecycle that can actually
 * be resumed after a crash, not just retried after an in-process
 * exception. No AI, no correction, no publication yet.
 */
import { createHash, randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PrismaClient } from '@/core-v2/generated/client';
import type { ServiceContext } from '@/lib/core-v2/services/context';
import type { Actor } from '@/lib/core-v2/rbac';
import { setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();

jest.mock('@/lib/core-v2/diagnostics/text-extraction', () => {
  const actual = jest.requireActual('@/lib/core-v2/diagnostics/text-extraction');
  return {
    ...actual,
    checkPdfTextExtractionRuntime: jest.fn(actual.checkPdfTextExtractionRuntime),
    extractSubmissionTextBounded: jest.fn(actual.extractSubmissionTextBounded),
  };
});
jest.mock('@/lib/core-v2/diagnostics/release-identity', () => ({ readRunningReleaseSha: jest.fn(async () => null) }));

import { createHousehold, createStudent } from '@/lib/core-v2/services';
import { attributeDiagnostic } from '@/lib/core-v2/services/diagnostics';
import { depositOwnDiagnosticSubmission } from '@/lib/core-v2/diagnostics/submission-pipeline';
import { diagnosticsStorageRoot } from '@/lib/core-v2/diagnostics/storage';
import { renderHtmlToPdf } from '@/lib/bilans/render/pdf';
import { checkPdfTextExtractionRuntime, extractSubmissionTextBounded } from '@/lib/core-v2/diagnostics/text-extraction';
import { readRunningReleaseSha } from '@/lib/core-v2/diagnostics/release-identity';
import { authorizeDiagnosticProcessingRetry, PDFJS_RETRY_AUTHORIZATION_REASON } from '@/lib/core-v2/services/diagnostic-processing-recovery';
import {
  drainDiagnosticSubmissionProcessingQueue,
  enqueueDiagnosticSubmissionProcessing,
  getDiagnosticSubmissionProcessingStatus,
  getLatestDiagnosticSubmissionExtraction,
  runOneDiagnosticProcessingJob,
} from '@/lib/core-v2/services/diagnostic-processing';

const mockedExtract = extractSubmissionTextBounded as jest.MockedFunction<typeof extractSubmissionTextBounded>;
const mockedRuntimeCheck = checkPdfTextExtractionRuntime as jest.MockedFunction<typeof checkPdfTextExtractionRuntime>;
const mockedReleaseSha = readRunningReleaseSha as jest.MockedFunction<typeof readRunningReleaseSha>;

beforeEach(() => {
  process.env.DIAGNOSTIC_DEMO_MODE = '1';
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = '';
  mockedExtract.mockClear();
  mockedRuntimeCheck.mockReset();
  mockedRuntimeCheck.mockResolvedValue({ available: true });
  mockedReleaseSha.mockReset();
  mockedReleaseSha.mockResolvedValue(null);
});

function allowDemoFixtureFor(...studentIds: string[]) {
  const existing = (process.env.DIAGNOSTIC_DEMO_STUDENT_IDS ?? '').split(',').filter(Boolean);
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = [...existing, ...studentIds].join(',');
}

function eleveActor(userId: string): Actor {
  return { userId, role: 'ELEVE' };
}

async function seedInstrument(client: PrismaClient, label: string) {
  const instrumentKey = `PROCESSING-${label}`;
  return client.diagnosticInstrumentRef.create({
    data: {
      instrumentKey,
      version: '1.0.0',
      title: `Processing instrument ${label}`,
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
}

async function seedDepositedSubmission(client: PrismaClient, ctx: ServiceContext, label: string, pdfBytes: Buffer) {
  const { household } = await createHousehold(client, ctx, {
    parent: { firstName: `P${label}`, lastName: 'Synthetic', email: `parent-processing-${label}@synthetic.test` },
  });
  const { student, user } = await createStudent(client, ctx, {
    householdId: household.id,
    student: { firstName: `S${label}`, lastName: 'Synthetic' },
  });
  allowDemoFixtureFor(student.id);
  const instrument = await seedInstrument(client, label);
  const assignment = await attributeDiagnostic(client, ctx, { studentId: student.id, instrumentRefId: instrument.id });
  const { submission } = await depositOwnDiagnosticSubmission(client, h.ctx(eleveActor(user.id)), {
    assignmentId: assignment.id,
    originalFilename: 'reponses.pdf',
    mimeType: 'application/pdf',
    bytes: pdfBytes,
  });
  return { student, user, assignment, submission };
}

/** Enqueue then run the drain once — the two-step lifecycle a real staff POST + scheduled worker actually exercise. */
async function enqueueAndDrainOnce(submissionId: string) {
  const ctx = h.ctx();
  await enqueueDiagnosticSubmissionProcessing(h.client, ctx, submissionId);
  const metrics = await drainDiagnosticSubmissionProcessingQueue(h.client);
  const processing = await getDiagnosticSubmissionProcessingStatus(h.client, ctx, submissionId);
  const extraction = await getLatestDiagnosticSubmissionExtraction(h.client, ctx, submissionId);
  return { metrics, processing: processing!, extraction: extraction! };
}

async function exhaustWithPdfJsPackagingIncident(submissionId: string) {
  const incident = "BILAN_PDF_TEXT_EXTRACTION_FAILED:1:Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'pdfjs-dist' imported from standalone";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    mockedExtract.mockResolvedValueOnce({ status: 'FAILED', errorMessage: incident });
    await enqueueAndDrainOnce(submissionId);
  }
  const processing = await h.client.diagnosticSubmissionProcessing.findUniqueOrThrow({ where: { submissionId } });
  const extraction = await h.client.diagnosticSubmissionExtraction.findFirstOrThrow({ where: { processingId: processing.id }, orderBy: { revision: 'desc' } });
  return { processing, extraction };
}

function retryAuthorizationInput(processing: {
  id: string;
  submissionId: string;
  submissionVersionSnapshot: number;
  submissionSha256Snapshot: string;
  subjectVersionSnapshot: string;
}, extraction: { id: string; revision: number }) {
  return {
    processingId: processing.id,
    submissionId: processing.submissionId,
    submissionVersion: processing.submissionVersionSnapshot,
    submissionSha256: processing.submissionSha256Snapshot,
    subjectVersion: processing.subjectVersionSnapshot,
    lastExtractionId: extraction.id,
    lastExtractionRevision: extraction.revision,
    attemptCount: 5,
    reason: PDFJS_RETRY_AUTHORIZATION_REASON,
    operationId: randomUUID(),
  } as const;
}

describe('enqueue + drain — synthetic textual answer → real extraction', () => {
  test('extracts the real, non-empty text of a genuinely rendered PDF and records it as revision 1 SUCCEEDED', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body><p>Réponse candidate — capitale de la France : C.</p></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `TEXT-${randomUUID()}`, pdf);

    const { metrics, processing, extraction } = await enqueueAndDrainOnce(submission.id);

    expect(metrics).toEqual({ claimed: 1, succeeded: 1, failed: 0 });
    expect(processing.status).toBe('EXTRACTED');
    expect(processing.extractionCount).toBe(1);
    expect(extraction.revision).toBe(1);
    expect(extraction.status).toBe('SUCCEEDED');
    expect(extraction.extractedText).toContain('capitale de la France');
    expect(extraction.characterCount).toBeGreaterThan(0);
    expect(extraction.truncated).toBe(false); // mission §6: a real, complete answer is explicitly marked as such, not just left ambiguous.
  });
});

describe('runtime prerequisite blocks claims without consuming attempts', () => {
  test('missing PDF.js runtime claims no processing and leaves attempt/lease/history untouched', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body><p>Précontrôle sans claim.</p></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `RUNTIME-${randomUUID()}`, pdf);
    const processing = await enqueueDiagnosticSubmissionProcessing(h.client, ctx, submission.id);
    mockedRuntimeCheck.mockResolvedValueOnce({ available: false, code: 'PDFJS_RUNTIME_DEPENDENCY_UNAVAILABLE' });

    const metrics = await drainDiagnosticSubmissionProcessingQueue(h.client);
    const after = await h.client.diagnosticSubmissionProcessing.findUniqueOrThrow({ where: { id: processing.id } });
    const extractions = await h.client.diagnosticSubmissionExtraction.findMany({ where: { processingId: processing.id } });

    expect(metrics).toEqual({ claimed: 0, succeeded: 0, failed: 0, blockedReason: 'PDFJS_RUNTIME_DEPENDENCY_UNAVAILABLE' });
    expect(after.status).toBe('QUEUED');
    expect(after.attemptCount).toBe(0);
    expect(after.leaseOwner).toBeNull();
    expect(after.leaseExpiresAt).toBeNull();
    expect(extractions).toHaveLength(0);
    expect(mockedExtract).not.toHaveBeenCalled();
  });
});

describe('one-shot incident-scoped administrative extraction recovery', () => {
  test('keeps the five historical attempts, authorizes once, and two workers produce only revision 6', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body><p>PDF.js retry synthetic.</p></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `PDFJS-RETRY-${randomUUID()}`, pdf);
    const { processing, extraction } = await exhaustWithPdfJsPackagingIncident(submission.id);

    expect(processing.attemptCount).toBe(5);
    expect(processing.status).toBe('EXTRACTION_FAILED');
    expect(extraction.revision).toBe(5);

    // An exhausted row remains nonclaimable until the dedicated capability
    // creates an exact authorization.
    expect(await drainDiagnosticSubmissionProcessingQueue(h.client)).toEqual({ claimed: 0, succeeded: 0, failed: 0 });
    const input = retryAuthorizationInput(processing, extraction);
    const releaseSha = 'a'.repeat(40);
    const assignment = await h.client.diagnosticAssignment.findUniqueOrThrow({
      where: { id: submission.assignmentId },
      select: { studentId: true },
    });
    const demoStudentIds = process.env.DIAGNOSTIC_DEMO_STUDENT_IDS;
    process.env.DIAGNOSTIC_DEMO_MODE = '0';
    await expect(authorizeDiagnosticProcessingRetry(h.client, ctx, input, releaseSha))
      .rejects.toMatchObject({ code: 'INVALID_STATE' });
    process.env.DIAGNOSTIC_DEMO_MODE = '1';
    process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = '';
    await expect(authorizeDiagnosticProcessingRetry(h.client, ctx, input, releaseSha))
      .rejects.toMatchObject({ code: 'INVALID_STATE' });
    process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = demoStudentIds;
    const authorization = await authorizeDiagnosticProcessingRetry(h.client, ctx, input, releaseSha);
    const replay = await authorizeDiagnosticProcessingRetry(h.client, ctx, input, releaseSha);
    expect(replay.retryAuthorizationOperationId).toBe(authorization.retryAuthorizationOperationId);
    expect(await h.client.auditEvent.count({ where: { subjectId: processing.id, action: 'diagnostic.submission.processing.retry_authorized' } })).toBe(1);
    await expect(authorizeDiagnosticProcessingRetry(h.client, ctx, { ...input, operationId: randomUUID() }, releaseSha))
      .rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(authorizeDiagnosticProcessingRetry(h.client, h.ctx(h.assistante), input, releaseSha))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });

    mockedRuntimeCheck.mockResolvedValueOnce({ available: false, code: 'PDFJS_RUNTIME_DEPENDENCY_UNAVAILABLE' });
    expect(await drainDiagnosticSubmissionProcessingQueue(h.client)).toEqual({
      claimed: 0,
      succeeded: 0,
      failed: 0,
      blockedReason: 'PDFJS_RUNTIME_DEPENDENCY_UNAVAILABLE',
    });
    const stillAuthorized = await h.client.diagnosticSubmissionProcessing.findUniqueOrThrow({ where: { id: processing.id } });
    expect(stillAuthorized).toMatchObject({ attemptCount: 5, status: 'EXTRACTION_FAILED', retryAuthorizationConsumedAt: null });

    mockedReleaseSha.mockResolvedValue(releaseSha);
    mockedExtract.mockResolvedValueOnce({
      status: 'SUCCEEDED',
      text: 'PDF.js retry synthetic.',
      characterCount: 24,
      truncated: false,
      totalCharacterCount: 24,
    });
    process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = '';
    expect(await drainDiagnosticSubmissionProcessingQueue(h.client)).toEqual({ claimed: 0, succeeded: 0, failed: 0 });
    process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = demoStudentIds;
    const [first, second] = await Promise.all([
      drainDiagnosticSubmissionProcessingQueue(h.client, { owner: 'worker-a' }),
      drainDiagnosticSubmissionProcessingQueue(h.client, { owner: 'worker-b' }),
    ]);
    expect(first.claimed + second.claimed).toBe(1);
    const final = await h.client.diagnosticSubmissionProcessing.findUniqueOrThrow({ where: { id: processing.id } });
    const revisions = await h.client.diagnosticSubmissionExtraction.findMany({ where: { processingId: processing.id }, orderBy: { revision: 'asc' } });
    expect(final.status).toBe('EXTRACTED');
    expect(final.attemptCount).toBe(6);
    expect(final.retryAuthorizationConsumedAt).not.toBeNull();
    expect(revisions).toHaveLength(6);
    expect(revisions.slice(0, 5).map((row) => row.status)).toEqual(['FAILED', 'FAILED', 'FAILED', 'FAILED', 'FAILED']);
    expect(revisions[5]).toMatchObject({ revision: 6, status: 'SUCCEEDED', extractedText: 'PDF.js retry synthetic.' });

    mockedExtract.mockResolvedValueOnce({ status: 'SUCCEEDED', text: 'late result', characterCount: 11, truncated: false, totalCharacterCount: 11 });
    await runOneDiagnosticProcessingJob(h.client, processing.id, 'stale-worker-token');
    expect(await h.client.diagnosticSubmissionExtraction.count({ where: { processingId: processing.id } })).toBe(6);
    expect(await drainDiagnosticSubmissionProcessingQueue(h.client)).toEqual({ claimed: 0, succeeded: 0, failed: 0 });
  });

  test('an expired one-shot lease becomes terminal FAILED revision 6 and cannot be reclaimed', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body><p>PDF.js crash retry synthetic.</p></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `PDFJS-CRASH-${randomUUID()}`, pdf);
    const { processing, extraction } = await exhaustWithPdfJsPackagingIncident(submission.id);
    const input = retryAuthorizationInput(processing, extraction);
    const releaseSha = 'b'.repeat(40);
    await authorizeDiagnosticProcessingRetry(h.client, ctx, input, releaseSha);
    await h.client.diagnosticSubmissionProcessing.update({
      where: { id: processing.id },
      data: {
        status: 'EXTRACTING',
        attemptCount: 6,
        leaseOwner: 'expired-one-shot-owner',
        leaseExpiresAt: new Date(Date.now() - 1_000),
        retryAuthorizationConsumedAt: new Date(Date.now() - 90_000),
      },
    });
    mockedReleaseSha.mockResolvedValue(releaseSha);

    const metrics = await drainDiagnosticSubmissionProcessingQueue(h.client);
    const final = await h.client.diagnosticSubmissionProcessing.findUniqueOrThrow({ where: { id: processing.id } });
    const latest = await h.client.diagnosticSubmissionExtraction.findFirstOrThrow({ where: { processingId: processing.id }, orderBy: { revision: 'desc' } });
    expect(metrics).toEqual({ claimed: 0, succeeded: 0, failed: 0 });
    expect(final).toMatchObject({ status: 'EXTRACTION_FAILED', attemptCount: 6, leaseOwner: null, leaseExpiresAt: null });
    expect(latest).toMatchObject({ revision: 6, status: 'FAILED', errorMessage: 'AUTHORIZED_RETRY_LEASE_EXPIRED' });
    expect(await drainDiagnosticSubmissionProcessingQueue(h.client)).toEqual({ claimed: 0, succeeded: 0, failed: 0 });
  });
});

describe('enqueue + drain — document without exploitable text', () => {
  test('a genuinely textless PDF gets an explicit NO_EXTRACTABLE_TEXT state, never a fabricated success', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `EMPTY-${randomUUID()}`, pdf);

    const { processing, extraction } = await enqueueAndDrainOnce(submission.id);

    expect(processing.status).toBe('NO_EXTRACTABLE_TEXT');
    expect(extraction.status).toBe('EMPTY');
    expect(extraction.extractedText).toBeNull();
  });
});

describe('job failure → controlled resumption without duplication', () => {
  test('a failed attempt records revision 1 FAILED; re-enqueue + drain creates revision 2, never overwriting or duplicating', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body><p>Contenu récupérable après échec.</p></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `RETRY-${randomUUID()}`, pdf);

    mockedExtract.mockResolvedValueOnce({ status: 'FAILED', errorMessage: 'SIMULATED_TRANSIENT_FAILURE' });

    const first = await enqueueAndDrainOnce(submission.id);
    expect(first.processing.status).toBe('EXTRACTION_FAILED');
    expect(first.extraction.revision).toBe(1);
    expect(first.extraction.status).toBe('FAILED');

    const second = await enqueueAndDrainOnce(submission.id);
    expect(second.processing.status).toBe('EXTRACTED');
    expect(second.extraction.revision).toBe(2);
    expect(second.extraction.status).toBe('SUCCEEDED');
    expect(second.extraction.extractedText).toContain('récupérable');

    const rows = await h.client.diagnosticSubmissionExtraction.findMany({
      where: { processingId: first.processing.id },
      orderBy: { revision: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe('FAILED');
    expect(rows[1].status).toBe('SUCCEEDED');

    const processingRows = await h.client.diagnosticSubmissionProcessing.findMany({ where: { submissionId: submission.id } });
    expect(processingRows).toHaveLength(1); // one processing row per submission, never recreated
  });

  test('a completed submission is never silently re-enqueued — no duplicate run, no duplicate row', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body><p>Déjà traité une fois.</p></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `DONE-${randomUUID()}`, pdf);

    await enqueueAndDrainOnce(submission.id);
    await expect(enqueueDiagnosticSubmissionProcessing(h.client, ctx, submission.id)).rejects.toMatchObject({ code: 'CONFLICT' });

    const rows = await h.client.diagnosticSubmissionExtraction.findMany({ where: { processing: { submissionId: submission.id } } });
    expect(rows).toHaveLength(1);
  });
});

describe('never processes a rejected/quarantined copy', () => {
  test('refuses outright at enqueue when the submission itself is REJECTED', async () => {
    const ctx = h.ctx();
    const { household } = await createHousehold(h.client, ctx, {
      parent: { firstName: 'PRejected', lastName: 'Synthetic', email: `parent-processing-rejected-${randomUUID()}@synthetic.test` },
    });
    const { student, user } = await createStudent(h.client, ctx, {
      householdId: household.id,
      student: { firstName: 'SRejected', lastName: 'Synthetic' },
    });
    allowDemoFixtureFor(student.id);
    const instrument = await seedInstrument(h.client, `REJECTED-${randomUUID()}`);
    const assignment = await attributeDiagnostic(h.client, ctx, { studentId: student.id, instrumentRefId: instrument.id });

    const rejected = await h.client.diagnosticSubmission.create({
      data: {
        assignmentId: assignment.id,
        version: 1,
        storageKey: '_quarantine/does-not-matter.pdf',
        originalFilename: 'reponses.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        sha256: createHash('sha256').update('irrelevant').digest('hex'),
        status: 'REJECTED',
        submittedById: user.id,
        reviewNote: 'Simulated rejection for the test.',
      },
    });

    await expect(enqueueDiagnosticSubmissionProcessing(h.client, ctx, rejected.id)).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });
});

describe('mission §5 — resumption and crash recovery', () => {
  test('missing file on disk: explicit, recoverable FAILED — never stuck EXTRACTING, never a crash', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body><p>Ce fichier va disparaître du disque.</p></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `MISSING-${randomUUID()}`, pdf);

    await unlink(resolve(diagnosticsStorageRoot(), submission.storageKey));

    const first = await enqueueAndDrainOnce(submission.id);
    expect(first.processing.status).toBe('EXTRACTION_FAILED'); // not stuck EXTRACTING
    expect(first.extraction.status).toBe('FAILED');
    expect(first.extraction.extractedText).toBeNull();

    // Recoverable: a real retry (e.g. after an operator restores the file
    // in a real incident) can still be enqueued and drained again.
    await expect(enqueueDiagnosticSubmissionProcessing(h.client, ctx, submission.id)).resolves.toMatchObject({ status: 'EXTRACTION_FAILED' });
  });

  test('a stale lease (simulating a worker that died mid-extraction) is reclaimed and completed by the next drain cycle', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body><p>Repris après un worker mort.</p></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `STALE-${randomUUID()}`, pdf);

    const processing = await enqueueDiagnosticSubmissionProcessing(h.client, ctx, submission.id);
    // Simulate a worker that claimed the job and then crashed: no
    // exception was ever thrown in this process, so nothing recorded a
    // FAILED outcome — only the lease exists, and it is already expired.
    await h.client.diagnosticSubmissionProcessing.update({
      where: { id: processing.id },
      data: { status: 'EXTRACTING', leaseOwner: 'dead-worker', leaseExpiresAt: new Date(Date.now() - 60_000), attemptCount: 1 },
    });

    const metrics = await drainDiagnosticSubmissionProcessingQueue(h.client);
    expect(metrics).toEqual({ claimed: 1, succeeded: 1, failed: 0 });

    const finalStatus = await getDiagnosticSubmissionProcessingStatus(h.client, ctx, submission.id);
    expect(finalStatus?.status).toBe('EXTRACTED');
    const extraction = await getLatestDiagnosticSubmissionExtraction(h.client, ctx, submission.id);
    expect(extraction?.extractedText).toContain('Repris après un worker mort');
  });

  test('a live (non-expired) lease is never reclaimed — one job is never run twice concurrently', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body><p>Toujours en cours.</p></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `LIVE-${randomUUID()}`, pdf);
    const processing = await enqueueDiagnosticSubmissionProcessing(h.client, ctx, submission.id);
    await h.client.diagnosticSubmissionProcessing.update({
      where: { id: processing.id },
      data: { status: 'EXTRACTING', leaseOwner: 'still-running-worker', leaseExpiresAt: new Date(Date.now() + 60_000), attemptCount: 1 },
    });

    const metrics = await drainDiagnosticSubmissionProcessingQueue(h.client);
    expect(metrics).toEqual({ claimed: 0, succeeded: 0, failed: 0 });

    const unchanged = await h.client.diagnosticSubmissionProcessing.findUniqueOrThrow({ where: { id: processing.id } });
    expect(unchanged.status).toBe('EXTRACTING');
    expect(unchanged.leaseOwner).toBe('still-running-worker');
  });

  test('a late result from an already-reclaimed (abandoned) attempt is discarded, never overwrites the current result', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body><p>Résultat courant, gagnant.</p></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `ABANDONED-${randomUUID()}`, pdf);
    const processing = await enqueueDiagnosticSubmissionProcessing(h.client, ctx, submission.id);

    // "ownerA" claimed it, then went silent (simulated: an expired lease).
    await h.client.diagnosticSubmissionProcessing.update({
      where: { id: processing.id },
      data: { status: 'EXTRACTING', leaseOwner: 'ownerA', leaseExpiresAt: new Date(Date.now() - 60_000), attemptCount: 1 },
    });

    // A real drain cycle reclaims it as "ownerB" and completes it — this is the current, winning result.
    const metrics = await drainDiagnosticSubmissionProcessingQueue(h.client, { owner: 'ownerB' });
    expect(metrics).toEqual({ claimed: 1, succeeded: 1, failed: 0 });
    const afterWinner = await h.client.diagnosticSubmissionProcessing.findUniqueOrThrow({ where: { id: processing.id } });
    expect(afterWinner.status).toBe('EXTRACTED');
    expect(afterWinner.leaseOwner).toBeNull();

    // "ownerA" finally wakes up and tries to finalize its own (stale) attempt.
    await runOneDiagnosticProcessingJob(h.client, processing.id, 'ownerA');

    const afterLateArrival = await h.client.diagnosticSubmissionProcessing.findUniqueOrThrow({ where: { id: processing.id } });
    expect(afterLateArrival.status).toBe('EXTRACTED'); // unchanged — ownerB's result still stands
    expect(afterLateArrival.updatedAt).toEqual(afterWinner.updatedAt); // genuinely untouched, not just the same status by coincidence

    const rows = await h.client.diagnosticSubmissionExtraction.findMany({ where: { processingId: processing.id } });
    expect(rows).toHaveLength(1); // ownerA's late result was never written at all
  });

  test('two concurrent drain cycles racing the same queue: exactly one claims and processes the job, never both', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body><p>Course concurrente réelle.</p></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `RACE-${randomUUID()}`, pdf);
    await enqueueDiagnosticSubmissionProcessing(h.client, ctx, submission.id);

    const [a, b] = await Promise.all([
      drainDiagnosticSubmissionProcessingQueue(h.client, { owner: 'race-a' }),
      drainDiagnosticSubmissionProcessingQueue(h.client, { owner: 'race-b' }),
    ]);
    expect(a.claimed + b.claimed).toBe(1); // FOR UPDATE SKIP LOCKED: never both claim the same real row

    const rows = await h.client.diagnosticSubmissionExtraction.findMany({ where: { processing: { submissionId: submission.id } } });
    expect(rows).toHaveLength(1);
    const finalStatus = await getDiagnosticSubmissionProcessingStatus(h.client, ctx, submission.id);
    expect(finalStatus?.status).toBe('EXTRACTED');
  });

  test('a deterministically broken submission stops being reclaimed once it exceeds the attempt cap', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body><p>Toujours en échec.</p></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `QUARANTINE-${randomUUID()}`, pdf);
    const processing = await enqueueDiagnosticSubmissionProcessing(h.client, ctx, submission.id);
    await h.client.diagnosticSubmissionProcessing.update({
      where: { id: processing.id },
      data: { status: 'EXTRACTION_FAILED', attemptCount: 5 }, // already at MAX_PROCESSING_ATTEMPTS
    });

    const metrics = await drainDiagnosticSubmissionProcessingQueue(h.client);
    expect(metrics).toEqual({ claimed: 0, succeeded: 0, failed: 0 });
  });
});

describe('mission §5 — a real extraction timeout surfaces as an explicit terminal state', () => {
  // The bound itself (the underlying child process is genuinely SIGKILL'd,
  // not just abandoned) is proven at the source in
  // __tests__/bilans/render-pdf-timeout.test.ts, against a fake process
  // handle — that test can assert on `kill()` without a real 20s wait.
  // This test proves the INTEGRATION: when extraction reports the exact
  // timeout error, the job still reaches EXTRACTION_FAILED, never gets
  // stuck EXTRACTING, and can still be resumed afterwards.
  test('a timeout-shaped extraction failure reaches EXTRACTION_FAILED, not a stuck EXTRACTING row', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body><p>Contenu qui aurait normalement dû s’extraire.</p></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `TIMEOUT-${randomUUID()}`, pdf);

    mockedExtract.mockRejectedValueOnce(new Error('BILAN_PDF_TEXT_EXTRACTION_TIMEOUT'));

    const { processing, extraction } = await enqueueAndDrainOnce(submission.id);
    expect(processing.status).toBe('EXTRACTION_FAILED');
    expect(extraction.status).toBe('FAILED');
    expect(extraction.errorMessage).toContain('BILAN_PDF_TEXT_EXTRACTION_TIMEOUT');

    // Resumable afterwards, same as any other recoverable failure.
    const retried = await enqueueAndDrainOnce(submission.id);
    expect(retried.processing.status).toBe('EXTRACTED');
    expect(retried.extraction.revision).toBe(2);
  });
});

describe('mission §6 — a truncated extraction is persisted as an explicit, distinguishable fact', () => {
  test('truncated=true and the real pre-cap length survive into the stored row — never disguised as a complete answer', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body><p>Peu importe le contenu réel ici — le résultat de troncature est simulé.</p></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `TRUNCATED-${randomUUID()}`, pdf);

    mockedExtract.mockResolvedValueOnce({
      status: 'SUCCEEDED',
      text: 'x'.repeat(50),
      characterCount: 50,
      truncated: true,
      totalCharacterCount: 12_345,
    });

    const { processing, extraction } = await enqueueAndDrainOnce(submission.id);
    expect(processing.status).toBe('EXTRACTED'); // still a success — a bounded, explicit one, not a failure
    expect(extraction.status).toBe('SUCCEEDED');
    expect(extraction.truncated).toBe(true);
    expect(extraction.characterCount).toBe(50);
    expect(extraction.totalCharacterCount).toBe(12_345); // the real, un-truncated length — never lost
  });
});
