/**
 * C2, first increment (mission §9): the first concrete, working pathway
 * from a receivable DiagnosticSubmission to a bounded, versioned text
 * extraction — no AI, no correction, no publication yet.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { PrismaClient } from '@/core-v2/generated/client';
import type { ServiceContext } from '@/lib/core-v2/services/context';
import type { Actor } from '@/lib/core-v2/rbac';
import { setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();

jest.mock('@/lib/core-v2/diagnostics/text-extraction', () => {
  const actual = jest.requireActual('@/lib/core-v2/diagnostics/text-extraction');
  return { ...actual, extractSubmissionTextBounded: jest.fn(actual.extractSubmissionTextBounded) };
});

import { createHousehold, createStudent } from '@/lib/core-v2/services';
import { attributeDiagnostic } from '@/lib/core-v2/services/diagnostics';
import { depositOwnDiagnosticSubmission } from '@/lib/core-v2/diagnostics/submission-pipeline';
import { renderHtmlToPdf } from '@/lib/bilans/render/pdf';
import { extractSubmissionTextBounded } from '@/lib/core-v2/diagnostics/text-extraction';
import {
  getDiagnosticSubmissionProcessingStatus,
  getLatestDiagnosticSubmissionExtraction,
  processDiagnosticSubmission,
} from '@/lib/core-v2/services/diagnostic-processing';

const mockedExtract = extractSubmissionTextBounded as jest.MockedFunction<typeof extractSubmissionTextBounded>;

beforeEach(() => {
  process.env.DIAGNOSTIC_DEMO_MODE = '1';
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = '';
  mockedExtract.mockClear();
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

describe('processDiagnosticSubmission — synthetic textual answer → real extraction', () => {
  test('extracts the real, non-empty text of a genuinely rendered PDF and records it as revision 1 SUCCEEDED', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body><p>Réponse candidate — capitale de la France : C.</p></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `TEXT-${randomUUID()}`, pdf);

    const { processing, extraction } = await processDiagnosticSubmission(h.client, ctx, submission.id);

    expect(processing.status).toBe('EXTRACTED');
    expect(extraction.revision).toBe(1);
    expect(extraction.status).toBe('SUCCEEDED');
    expect(extraction.extractedText).toContain('capitale de la France');
    expect(extraction.characterCount).toBeGreaterThan(0);

    const status = await getDiagnosticSubmissionProcessingStatus(h.client, ctx, submission.id);
    expect(status?.status).toBe('EXTRACTED');
    expect(status?.extractionCount).toBe(1);

    const content = await getLatestDiagnosticSubmissionExtraction(h.client, ctx, submission.id);
    expect(content?.extractedText).toContain('capitale de la France');
  });
});

describe('processDiagnosticSubmission — document without exploitable text', () => {
  test('a genuinely textless PDF gets an explicit NO_EXTRACTABLE_TEXT state, never a fabricated success', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `EMPTY-${randomUUID()}`, pdf);

    const { processing, extraction } = await processDiagnosticSubmission(h.client, ctx, submission.id);

    expect(processing.status).toBe('NO_EXTRACTABLE_TEXT');
    expect(extraction.status).toBe('EMPTY');
    expect(extraction.extractedText).toBeNull();
  });
});

describe('processDiagnosticSubmission — job failure → controlled resumption without duplication', () => {
  test('a failed attempt records revision 1 FAILED; a retry creates revision 2, never overwriting or duplicating', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body><p>Contenu récupérable après échec.</p></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `RETRY-${randomUUID()}`, pdf);

    mockedExtract.mockResolvedValueOnce({ status: 'FAILED', errorMessage: 'SIMULATED_TRANSIENT_FAILURE' });

    const first = await processDiagnosticSubmission(h.client, ctx, submission.id);
    expect(first.processing.status).toBe('EXTRACTION_FAILED');
    expect(first.extraction.revision).toBe(1);
    expect(first.extraction.status).toBe('FAILED');

    const second = await processDiagnosticSubmission(h.client, ctx, submission.id);
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

  test('a completed submission is never silently re-processed — no duplicate run, no duplicate row', async () => {
    const ctx = h.ctx();
    const pdf = await renderHtmlToPdf('<html><body><p>Déjà traité une fois.</p></body></html>');
    const { submission } = await seedDepositedSubmission(h.client, ctx, `DONE-${randomUUID()}`, pdf);

    await processDiagnosticSubmission(h.client, ctx, submission.id);
    await expect(processDiagnosticSubmission(h.client, ctx, submission.id)).rejects.toMatchObject({ code: 'CONFLICT' });

    const rows = await h.client.diagnosticSubmissionExtraction.findMany({ where: { processing: { submissionId: submission.id } } });
    expect(rows).toHaveLength(1);
  });
});

describe('processDiagnosticSubmission — never processes a rejected/quarantined copy', () => {
  test('refuses outright when the submission itself is REJECTED', async () => {
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

    await expect(processDiagnosticSubmission(h.client, ctx, rejected.id)).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });
});
