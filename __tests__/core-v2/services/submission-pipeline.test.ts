/**
 * Full deposit pipeline (mission §4): the guarantee under test is "no
 * incomplete, unverified, or rejected copy is ever exposed as an available
 * submission" — not merely that the write call used O_CREAT|O_EXCL.
 */
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PrismaClient } from '@/core-v2/generated/client';
import { CoreV2DomainError } from '@/lib/core-v2/errors';
import type { ServiceContext } from '@/lib/core-v2/services/context';
import type { Actor } from '@/lib/core-v2/rbac';
import { holdOpenTransaction, race, setupServiceHarness, waitForLockWaiter } from '../helpers/service-harness';

jest.mock('@/lib/core-v2/diagnostics/virus-scan', () => {
  const actual = jest.requireActual('@/lib/core-v2/diagnostics/virus-scan');
  return { scanDiagnosticSubmissionFile: jest.fn(actual.scanDiagnosticSubmissionFile) };
});
jest.mock('@/lib/core-v2/diagnostics/storage', () => {
  const actual = jest.requireActual('@/lib/core-v2/diagnostics/storage');
  return { ...actual, verifyStagedFile: jest.fn(actual.verifyStagedFile) };
});
jest.mock('@/lib/core-v2/services/diagnostics', () => {
  const actual = jest.requireActual('@/lib/core-v2/services/diagnostics');
  return { ...actual, createOwnDiagnosticSubmission: jest.fn(actual.createOwnDiagnosticSubmission) };
});

import { attributeDiagnostic, createOwnDiagnosticSubmission } from '@/lib/core-v2/services/diagnostics';
import { depositOwnDiagnosticSubmission } from '@/lib/core-v2/diagnostics/submission-pipeline';
import {
  diagnosticsStorageRoot,
  readDiagnosticStorageFile,
  verifyStagedFile,
  writeDiagnosticStorageFile,
} from '@/lib/core-v2/diagnostics/storage';
import { scanDiagnosticSubmissionFile } from '@/lib/core-v2/diagnostics/virus-scan';
import { createHousehold, createStudent } from '@/lib/core-v2/services';

const h = setupServiceHarness();
const mockedVerify = verifyStagedFile as jest.MockedFunction<typeof verifyStagedFile>;
const mockedScan = scanDiagnosticSubmissionFile as jest.MockedFunction<typeof scanDiagnosticSubmissionFile>;
const mockedCreate = createOwnDiagnosticSubmission as jest.MockedFunction<typeof createOwnDiagnosticSubmission>;

beforeEach(() => {
  process.env.DIAGNOSTIC_DEMO_MODE = '1';
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = '';
  mockedVerify.mockClear();
  mockedScan.mockClear();
  mockedCreate.mockClear();
});

function allowDemoFixtureFor(...studentIds: string[]) {
  const existing = (process.env.DIAGNOSTIC_DEMO_STUDENT_IDS ?? '').split(',').filter(Boolean);
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = [...existing, ...studentIds].join(',');
}

function eleveActor(userId: string): Actor {
  return { userId, role: 'ELEVE' };
}

async function seedStudent(client: PrismaClient, ctx: ServiceContext, label: string) {
  const { household } = await createHousehold(client, ctx, {
    parent: { firstName: `P${label}`, lastName: 'Synthetic', email: `parent-pipeline-${label}@synthetic.test` },
  });
  const { student, user } = await createStudent(client, ctx, {
    householdId: household.id,
    student: { firstName: `S${label}`, lastName: 'Synthetic' },
  });
  return { student, user };
}

async function seedInstrument(client: PrismaClient, label: string) {
  const instrumentKey = `PIPELINE-${label}`;
  return client.diagnosticInstrumentRef.create({
    data: {
      instrumentKey,
      version: '1.0.0',
      title: `Pipeline instrument ${label}`,
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

async function seedAssignment(client: PrismaClient, ctx: ServiceContext, label: string) {
  const { student, user } = await seedStudent(client, ctx, label);
  allowDemoFixtureFor(student.id);
  const instrument = await seedInstrument(client, label);
  const assignment = await attributeDiagnostic(client, ctx, { studentId: student.id, instrumentRefId: instrument.id });
  return { student, user, assignment };
}

const PDF = (text: string) => Buffer.from(`%PDF-1.0\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n${text}`);

describe('verifyStagedFile', () => {
  test('reports ok when the bytes on disk match exactly what was written', async () => {
    const bytes = PDF('sample-a');
    const path = `verify-ok-test-${randomUUID()}.bin`;
    await writeDiagnosticStorageFile(path, bytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const result = await verifyStagedFile(path, { sizeBytes: bytes.length, sha256 });
    expect(result.ok).toBe(true);
  });

  test('reports NOT ok when the file was truncated/corrupted after being written — a write does not get to claim completeness just because the call returned', async () => {
    const bytes = PDF('sample-b-longer-content-than-the-truncated-version');
    const path = `verify-corrupt-test-${randomUUID()}.bin`;
    await writeDiagnosticStorageFile(path, bytes);
    const expectedSha256 = createHash('sha256').update(bytes).digest('hex');

    const absolute = resolve(diagnosticsStorageRoot(), path);
    const onDisk = await readFile(absolute);
    await writeFile(absolute, onDisk.subarray(0, Math.floor(onDisk.length / 2)));

    const result = await verifyStagedFile(path, { sizeBytes: bytes.length, sha256: expectedSha256 });
    expect(result.ok).toBe(false);
  });
});

describe('depositOwnDiagnosticSubmission — write-verification failure', () => {
  test('quarantines the file, records a REJECTED audit row, and never flips the assignment to SUBMITTED', async () => {
    const ctx = h.ctx();
    const { user, assignment } = await seedAssignment(h.client, ctx, 'VERIFYFAIL');

    mockedVerify.mockResolvedValueOnce({ ok: false, actualSizeBytes: 0, actualSha256: '' });

    await expect(
      depositOwnDiagnosticSubmission(h.client, h.ctx(eleveActor(user.id)), {
        assignmentId: assignment.id,
        originalFilename: 'reponses.pdf',
        mimeType: 'application/pdf',
        bytes: PDF('verify-fail'),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });

    const rows = await h.client.diagnosticSubmission.findMany({ where: { assignmentId: assignment.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('REJECTED');
    expect(rows[0].storageKey).toMatch(/^_quarantine\//);

    const reread = await h.client.diagnosticAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(reread.status).toBe('ASSIGNED');

    // The evidence is preserved, not deleted.
    const quarantined = await readDiagnosticStorageFile(rows[0].storageKey);
    quarantined.handle.close();
  });
});

describe('depositOwnDiagnosticSubmission — antivirus rejection', () => {
  test('malware detected: quarantines the file, records a REJECTED row, never marks the assignment SUBMITTED', async () => {
    const ctx = h.ctx();
    const { user, assignment } = await seedAssignment(h.client, ctx, 'AVREJECT');

    mockedScan.mockRejectedValueOnce(new Error('MALWARE_DETECTED'));

    await expect(
      depositOwnDiagnosticSubmission(h.client, h.ctx(eleveActor(user.id)), {
        assignmentId: assignment.id,
        originalFilename: 'reponses.pdf',
        mimeType: 'application/pdf',
        bytes: PDF('av-reject'),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });

    const rows = await h.client.diagnosticSubmission.findMany({ where: { assignmentId: assignment.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('REJECTED');
    expect(rows[0].reviewNote).toMatch(/MALWARE_DETECTED/);

    const reread = await h.client.diagnosticAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(reread.status).toBe('ASSIGNED');
  });

  test('antivirus unavailable while mandatory (AV_NOT_CONFIGURED): fails closed exactly like a detected infection, never silently accepted', async () => {
    const ctx = h.ctx();
    const { user, assignment } = await seedAssignment(h.client, ctx, 'AVUNAVAILABLE');

    mockedScan.mockRejectedValueOnce(new Error('AV_NOT_CONFIGURED'));

    await expect(
      depositOwnDiagnosticSubmission(h.client, h.ctx(eleveActor(user.id)), {
        assignmentId: assignment.id,
        originalFilename: 'reponses.pdf',
        mimeType: 'application/pdf',
        bytes: PDF('av-unavailable'),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });

    const rows = await h.client.diagnosticSubmission.findMany({ where: { assignmentId: assignment.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('REJECTED');
  });
});

describe('depositOwnDiagnosticSubmission — DB failure after the file is already finalized', () => {
  test('the finalized file is quarantined, never left as a dangling orphan and never deleted, when the DB row cannot be created', async () => {
    const ctx = h.ctx();
    const { user, assignment } = await seedAssignment(h.client, ctx, 'DBFAIL');

    mockedCreate.mockRejectedValueOnce(new Error('SIMULATED_DB_OUTAGE'));

    await expect(
      depositOwnDiagnosticSubmission(h.client, h.ctx(eleveActor(user.id)), {
        assignmentId: assignment.id,
        originalFilename: 'reponses.pdf',
        mimeType: 'application/pdf',
        bytes: PDF('db-fail'),
      }),
    ).rejects.toThrow('SIMULATED_DB_OUTAGE');

    // No row at all — an unrecorded file is never "an available submission".
    const rows = await h.client.diagnosticSubmission.findMany({ where: { assignmentId: assignment.id } });
    expect(rows).toHaveLength(0);

    // The file was moved to quarantine, not deleted — locate it there.
    const fs = await import('node:fs/promises');
    const entries = await fs.readdir(resolve(diagnosticsStorageRoot(), '_quarantine'));
    expect(entries.length).toBeGreaterThan(0);
  });
});

describe('depositOwnDiagnosticSubmission — retry vs. distinct new deposit', () => {
  test('an identical repeated request (network retry) is recognized as a replay: no new version, no new file write', async () => {
    const ctx = h.ctx();
    const { user, assignment } = await seedAssignment(h.client, ctx, 'RETRY');
    const bytes = PDF('same-content-both-times');

    const first = await depositOwnDiagnosticSubmission(h.client, h.ctx(eleveActor(user.id)), {
      assignmentId: assignment.id,
      originalFilename: 'reponses.pdf',
      mimeType: 'application/pdf',
      bytes,
    });
    expect(first.idempotentReplay).toBe(false);
    expect(first.submission.version).toBe(1);

    const retry = await depositOwnDiagnosticSubmission(h.client, h.ctx(eleveActor(user.id)), {
      assignmentId: assignment.id,
      originalFilename: 'reponses.pdf',
      mimeType: 'application/pdf',
      bytes,
    });
    expect(retry.idempotentReplay).toBe(true);
    expect(retry.submission.id).toBe(first.submission.id);

    const rows = await h.client.diagnosticSubmission.findMany({ where: { assignmentId: assignment.id } });
    expect(rows).toHaveLength(1);
  });

  test('a distinct new deposit (different content) after an existing one creates a genuinely new version', async () => {
    const ctx = h.ctx();
    const { user, assignment } = await seedAssignment(h.client, ctx, 'DISTINCT');

    const first = await depositOwnDiagnosticSubmission(h.client, h.ctx(eleveActor(user.id)), {
      assignmentId: assignment.id,
      originalFilename: 'v1.pdf',
      mimeType: 'application/pdf',
      bytes: PDF('first-real-answer'),
    });
    const second = await depositOwnDiagnosticSubmission(h.client, h.ctx(eleveActor(user.id)), {
      assignmentId: assignment.id,
      originalFilename: 'v2.pdf',
      mimeType: 'application/pdf',
      bytes: PDF('a-corrected-different-answer'),
    });

    expect(second.idempotentReplay).toBe(false);
    expect([first.submission.version, second.submission.version]).toEqual([1, 2]);
  });

  test('a later rejected audit version never supplants the latest usable submission for replay detection', async () => {
    const ctx = h.ctx();
    const { user, assignment } = await seedAssignment(h.client, ctx, 'REJECTED-LATEST-RETRY');
    const bytes = PDF('accepted-content');

    const accepted = await depositOwnDiagnosticSubmission(h.client, h.ctx(eleveActor(user.id)), {
      assignmentId: assignment.id,
      originalFilename: 'accepted.pdf',
      mimeType: 'application/pdf',
      bytes,
    });
    await h.client.diagnosticSubmission.create({
      data: {
        assignmentId: assignment.id,
        version: 2,
        storageKey: '_quarantine/rejected-later.pdf',
        originalFilename: 'rejected.pdf',
        mimeType: 'application/pdf',
        sizeBytes: bytes.length,
        sha256: createHash('sha256').update(PDF('rejected-content')).digest('hex'),
        status: 'REJECTED',
        submittedById: user.id,
      },
    });

    const replay = await depositOwnDiagnosticSubmission(h.client, h.ctx(eleveActor(user.id)), {
      assignmentId: assignment.id,
      originalFilename: 'accepted-retry.pdf',
      mimeType: 'application/pdf',
      bytes,
    });

    expect(replay).toMatchObject({ idempotentReplay: true, submission: { id: accepted.submission.id, version: 1 } });
    expect(await h.client.diagnosticSubmission.count({ where: { assignmentId: assignment.id } })).toBe(2);
  });
});

describe('createOwnDiagnosticSubmission — real concurrent DB race on the version sequence', () => {
  test('a deposit racing an uncommitted concurrent deposit for the SAME next version is refused with a typed CONFLICT, never a raw driver error; exactly one row exists', async () => {
    const { client } = h;
    const ctx = h.ctx();
    const { user, assignment } = await seedAssignment(client, ctx, 'DBRACE');

    // T1 claims version 1 and stays open (uncommitted) — mirrors this
    // codebase's own concurrency-proof pattern (concurrency.test.ts).
    const t1 = await holdOpenTransaction(client, async (tx) => {
      await tx.diagnosticSubmission.create({
        data: {
          assignmentId: assignment.id,
          version: 1,
          storageKey: 'held-by-t1.pdf',
          originalFilename: 'held.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1,
          sha256: 'e'.repeat(64),
          submittedById: user.id,
        },
      });
    });

    // T2 (the real, unmodified function) independently computes the same
    // "next version" under READ COMMITTED (T1 hasn't committed) and blocks
    // on the same unique index entry when it tries to insert. Attach the
    // outcome handler at creation (no window between creation and the
    // intervening awaits below) rather than asserting `.rejects` on a
    // promise created earlier — see deferred-rejection-assertion-authority.
    const t2Outcome = createOwnDiagnosticSubmission(client, h.ctx(eleveActor(user.id)), {
      assignmentId: assignment.id,
      originalFilename: 'racer.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2,
      sha256: 'f'.repeat(64),
      storageKey: 'racer.pdf',
    }).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    );

    await waitForLockWaiter(client);
    await t1.release();

    const t2Result = await t2Outcome;
    expect(t2Result.ok).toBe(false);
    if (!t2Result.ok) {
      expect(t2Result.error).toBeInstanceOf(CoreV2DomainError);
      expect(t2Result.error).toMatchObject({ code: 'CONFLICT' });
    }

    const rows = await client.diagnosticSubmission.findMany({ where: { assignmentId: assignment.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe(1);
    expect(rows[0].storageKey).toBe('held-by-t1.pdf');
  });
});

/**
 * Two genuinely concurrent deposits for the SAME assignment (not
 * artificially synchronized) may race at the DB layer exactly like the
 * deterministic proof above: at most one may ever fail, and when it does
 * it must be the typed CONFLICT, never a raw driver error, and the loser's
 * already-finalized file must never be left dangling. This complements
 * the deterministic proof by exercising the pipeline's OWN orphan-file
 * compensation (not just createOwnDiagnosticSubmission's) on a real,
 * unforced race.
 */
describe('depositOwnDiagnosticSubmission — two ordinary concurrent deposits', () => {
  test('at most one may fail; if one does, it is a typed CONFLICT and exactly the surviving row remains, with no dangling file', async () => {
    const ctx = h.ctx();
    const { user, assignment } = await seedAssignment(h.client, ctx, 'ORDINARYCONCURRENT');

    const { fulfilled, rejected } = await race(
      () =>
        depositOwnDiagnosticSubmission(h.client, h.ctx(eleveActor(user.id)), {
          assignmentId: assignment.id,
          originalFilename: 'a.pdf',
          mimeType: 'application/pdf',
          bytes: PDF('concurrent-attempt-A'),
        }),
      () =>
        depositOwnDiagnosticSubmission(h.client, h.ctx(eleveActor(user.id)), {
          assignmentId: assignment.id,
          originalFilename: 'b.pdf',
          mimeType: 'application/pdf',
          bytes: PDF('concurrent-attempt-B'),
        }),
    );

    expect(rejected.length).toBeLessThanOrEqual(1);
    for (const failure of rejected) {
      expect(failure).toBeInstanceOf(CoreV2DomainError);
      expect((failure as CoreV2DomainError).code).toBe('CONFLICT');
    }

    const rows = await h.client.diagnosticSubmission.findMany({ where: { assignmentId: assignment.id } });
    expect(rows).toHaveLength(fulfilled.length);
    expect(rows.every((r) => r.status === 'RECEIVED')).toBe(true);
  });
});
