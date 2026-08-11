/** @jest-environment node */

import { createHash } from 'node:crypto';
import { chmodSync, constants, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  canonicalJson,
  createTombstoneExportEnvelope,
  readVerifiedTombstoneExport,
  writeVerifiedTombstoneExport,
} from '@/lib/npc/tombstone/export';
import {
  buildTombstoneOperationIdentity,
  type TombstoneArguments,
} from '@/lib/npc/tombstone/types';

const args: TombstoneArguments = {
  submissionId: 'sub_synthetic_export',
  expectedInitialStatus: 'COMPLETED',
  expectedPageCount: 4,
  expectedReportId: 'report_synthetic_export',
  expectedReportStatus: 'DRAFT',
  expectedReportVisibility: 'COACH_ONLY',
  reason: 'SOURCE_BYTES_UNAVAILABLE',
  actorId: 'maintenance_synthetic_export',
  actorRole: 'SYSTEM',
  exportFile: '/outside/repository/npc-export.json',
};

const TEST_EXPORT_SECURITY = {
  trustedUid: process.getuid?.() ?? 0,
};

function rawSnapshot() {
  return {
    submission: {
      id: args.submissionId,
      createdAt: new Date('2026-08-11T08:00:00.000Z'),
      updatedAt: new Date('2026-08-11T08:01:00.000Z'),
      studentId: 'student_synthetic_export',
      coachId: null,
      subject: 'MATHEMATIQUES',
      gradeLevel: 'TERMINALE',
      title: 'Dossier synthétique',
      description: null,
      sourceType: 'AUTRE',
      sourceId: null,
      status: 'COMPLETED',
      unavailableReason: null,
      unavailableAt: null,
      ocrText: 'metadata only',
      ocrError: null,
      aiJobId: 'job_synthetic_export',
      storedFilePath: '/srv/npc/private/source.pdf',
      fileSizeBytes: 24,
      mimeType: 'application/pdf',
    },
    pages: Array.from({ length: 4 }, (_, index) => ({
      id: `page_synthetic_${index + 1}`,
      createdAt: new Date(`2026-08-11T08:0${index}:00.000Z`),
      updatedAt: new Date(`2026-08-11T08:1${index}:00.000Z`),
      submissionId: args.submissionId,
      pageNumber: index + 1,
      status: 'READY',
      documentType: 'STUDENT_COPY',
      unavailableReason: null,
      unavailableAt: null,
      originalFilePath: `/srv/npc/private/page-${index + 1}.pdf`,
      originalFilename: `page-${index + 1}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: index + 10,
      sha256: String(index + 1).repeat(64),
      uploadedById: null,
      convertedFilePaths: [`/srv/npc/private/page-${index + 1}.png`],
      ocrText: `page ${index + 1}`,
      ocrConfidence: 0.99,
      width: 1000,
      height: 1400,
    })),
    report: {
      id: args.expectedReportId,
      createdAt: new Date('2026-08-11T09:00:00.000Z'),
      updatedAt: new Date('2026-08-11T09:01:00.000Z'),
      copySubmissionId: args.submissionId,
      studentId: 'student_synthetic_export',
      coachId: null,
      status: 'DRAFT',
      visibility: 'COACH_ONLY',
      diagnostic: { version: 1, apiToken: 'must-not-leave-export' },
      strengths: ['Calcul'],
      weaknesses: ['Rédaction'],
      rawAiOutput: { authorization: 'Bearer must-not-leave-export' },
      validatedAiOutput: null,
      sentToStudentAt: null,
      readByStudentAt: null,
      coachNotes: 'Rapport intact',
      studentSummary: null,
    },
    job: {
      id: 'job_synthetic_export',
      createdAt: new Date('2026-08-11T08:30:00.000Z'),
      updatedAt: new Date('2026-08-11T08:31:00.000Z'),
      type: 'PEDAGOGICAL_DIAGNOSIS',
      status: 'COMPLETED',
      priority: 'NORMAL',
      copySubmissionId: args.submissionId,
      inputData: {
        submissionId: args.submissionId,
        password: 'never-export',
        nested: ['unlabelled-secret-value'],
      },
      outputData: { complete: true, values: ['second-unlabelled-secret-value'] },
      errorMessage: 'postgresql://synthetic-user:synthetic-pass@synthetic-host/database',
      retryCount: 0,
      maxRetries: 3,
      claimedAt: null,
      claimedBy: 'worker-synthetic',
      startedAt: null,
      completedAt: null,
      nextRetryAt: null,
      processingDurationMs: 12,
      chutesRequestId: null,
      tokensUsed: 17,
      modelVersion: null,
    },
    audits: [
      {
        id: 'audit_synthetic_existing',
        createdAt: new Date('2026-08-11T09:02:00.000Z'),
        reportId: args.expectedReportId,
        action: 'SYNTHETIC_EXISTING_AUDIT',
        actorId: 'coach_synthetic',
        actorRole: 'COACH',
        entityType: 'PedagogicalReport',
        entityId: args.expectedReportId,
        details: {
          reviewed: true,
          auth: { cookie: 'never-export' },
          values: ['third-unlabelled-secret-value'],
        },
      },
    ],
  };
}

describe('NPC tombstone export', () => {
  let directory: string;
  let exportFile: string;

  beforeEach(() => {
    directory = mkdtempSync(join(homedir(), 'npc-tombstone-export-'));
    exportFile = join(directory, 'snapshot.json');
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('builds a versioned, complete and deterministic envelope without destinations, Users, secrets, or absolute paths', () => {
    const generatedAt = new Date('2026-08-11T10:00:00.000Z');
    const first = createTombstoneExportEnvelope({ args, rawSnapshot: rawSnapshot(), generatedAt });
    const reorderedArgs = Object.fromEntries(Object.entries(args).reverse()) as unknown as TombstoneArguments;
    const second = createTombstoneExportEnvelope({ args: reorderedArgs, rawSnapshot: rawSnapshot(), generatedAt });
    const serialized = canonicalJson(first);

    expect(first.format).toBe('nexus-npc-tombstone-export');
    expect(first.version).toBe(1);
    expect(first.payload.operation.generatedAt).toBe('2026-08-11T10:00:00.000Z');
    expect(first.payload.operation.arguments).toEqual(
      buildTombstoneOperationIdentity(args).fields,
    );
    expect(first.payload.snapshot.submission).toMatchObject({
      id: args.submissionId,
      title: 'Dossier synthétique',
      status: 'COMPLETED',
      fileSizeBytes: 24,
    });
    expect(first.payload.snapshot.pages).toHaveLength(4);
    expect(first.payload.snapshot.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3, 4]);
    expect(first.payload.snapshot.report).toMatchObject({
      id: args.expectedReportId,
      status: 'DRAFT',
      visibility: 'COACH_ONLY',
      coachNotes: 'Rapport intact',
    });
    expect(first.payload.snapshot.job).toMatchObject({
      id: 'job_synthetic_export',
      tokensUsed: 17,
      inputData: { redacted: true, sha256: expect.stringMatching(/^[a-f0-9]{64}$/), byteLength: expect.any(Number) },
      outputData: { redacted: true, sha256: expect.stringMatching(/^[a-f0-9]{64}$/), byteLength: expect.any(Number) },
      errorMessage: { redacted: true, sha256: expect.stringMatching(/^[a-f0-9]{64}$/), byteLength: expect.any(Number) },
    });
    expect(first.payload.snapshot.audits).toHaveLength(1);
    expect(first.payload.snapshot.audits[0].details).toEqual({
      redacted: true,
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      byteLength: expect.any(Number),
    });
    expect(first.payload.snapshot.report).toMatchObject({
      diagnostic: { redacted: true, sha256: expect.stringMatching(/^[a-f0-9]{64}$/), byteLength: expect.any(Number) },
      rawAiOutput: { redacted: true, sha256: expect.stringMatching(/^[a-f0-9]{64}$/), byteLength: expect.any(Number) },
      validatedAiOutput: null,
    });
    expect(first.payload.snapshot.snapshotSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.payloadSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(canonicalJson(second)).toBe(serialized);
    expect(serialized).not.toContain(args.exportFile);
    expect(serialized).not.toContain('/srv/npc/private');
    expect(serialized).not.toContain('must-not-leave-export');
    expect(serialized).not.toContain('never-export');
    expect(serialized).not.toContain('unlabelled-secret-value');
    expect(serialized).not.toContain('second-unlabelled-secret-value');
    expect(serialized).not.toContain('third-unlabelled-secret-value');
    expect(serialized).not.toContain('synthetic-pass');
    expect(serialized).not.toMatch(/"(?:user|auth|password|token|secret|cookie)"\s*:/i);
  });

  it('derives the deterministic operation and audit identity from exactly the approved fields', () => {
    const identity = buildTombstoneOperationIdentity(args);
    expect(identity.fields).toEqual({
      protocolVersion: 'npc-tombstone/v1',
      submissionId: args.submissionId,
      expectedInitialStatus: 'COMPLETED',
      expectedPageCount: 4,
      expectedReportId: args.expectedReportId,
      expectedReportStatus: 'DRAFT',
      expectedReportVisibility: 'COACH_ONLY',
      reason: 'SOURCE_BYTES_UNAVAILABLE',
      actorId: 'maintenance_synthetic_export',
      actorRole: 'SYSTEM',
    });
    expect(Object.keys(identity.fields)).toHaveLength(10);
    expect(identity).toEqual(buildTombstoneOperationIdentity({
      ...args,
      exportFile: '/different/absolute/destination.json',
    }));
    expect(identity.operationKey).toMatch(/^npc-tombstone-v1:[a-f0-9]{64}$/);
    expect(identity.auditId).toMatch(/^npc-tombstone-v1-[a-f0-9]{64}$/);
  });

  it('creates with exclusive no-follow flags, mode 0600, fsyncs, rereads, reparses and rehashes', async () => {
    const envelope = createTombstoneExportEnvelope({
      args,
      rawSnapshot: rawSnapshot(),
      generatedAt: new Date('2026-08-11T10:00:00.000Z'),
    });
    const calls: Array<{ flags?: number; synced?: boolean }> = [];

    const result = await writeVerifiedTombstoneExport(exportFile, envelope, {
      ...TEST_EXPORT_SECURITY,
      onFileOpened(flags) {
        calls.push({ flags });
      },
      onFileSynced() {
        calls.push({ synced: true });
      },
    });

    expect(calls[0].flags! & constants.O_EXCL).toBe(constants.O_EXCL);
    expect(calls[0].flags! & constants.O_NOFOLLOW).toBe(constants.O_NOFOLLOW);
    expect(calls).toContainEqual({ synced: true });
    expect(lstatSync(exportFile).mode & 0o777).toBe(0o600);
    expect(result.envelope).toEqual(envelope);
    expect(result.bytes).toEqual(readFileSync(exportFile));
    expect(result.payloadSha256).toBe(envelope.payloadSha256);
    await expect(readVerifiedTombstoneExport(exportFile, TEST_EXPORT_SECURITY)).resolves.toEqual(result);
  });

  it('never overwrites an existing file and refuses symbolic links', async () => {
    const envelope = createTombstoneExportEnvelope({
      args,
      rawSnapshot: rawSnapshot(),
      generatedAt: new Date('2026-08-11T10:00:00.000Z'),
    });
    writeFileSync(exportFile, 'sentinel', { mode: 0o600 });

    await expect(writeVerifiedTombstoneExport(exportFile, envelope, TEST_EXPORT_SECURITY)).rejects.toMatchObject({
      code: 'NPC_TOMBSTONE_EXPORT_EXISTS',
    });
    expect(readFileSync(exportFile, 'utf8')).toBe('sentinel');

    rmSync(exportFile);
    const target = join(directory, 'target.json');
    writeFileSync(target, 'sentinel', { mode: 0o600 });
    symlinkSync(target, exportFile);
    await expect(writeVerifiedTombstoneExport(exportFile, envelope, TEST_EXPORT_SECURITY)).rejects.toMatchObject({
      code: 'NPC_TOMBSTONE_EXPORT_SYMLINK',
    });
    expect(readFileSync(target, 'utf8')).toBe('sentinel');
  });

  it('rejects a tampered or non-0600 export during physical readback', async () => {
    const envelope = createTombstoneExportEnvelope({
      args,
      rawSnapshot: rawSnapshot(),
      generatedAt: new Date('2026-08-11T10:00:00.000Z'),
    });
    await writeVerifiedTombstoneExport(exportFile, envelope, TEST_EXPORT_SECURITY);
    const parsed = JSON.parse(readFileSync(exportFile, 'utf8'));
    parsed.payload.snapshot.submission.title = 'tampered';
    writeFileSync(exportFile, JSON.stringify(parsed), { mode: 0o600 });

    await expect(readVerifiedTombstoneExport(exportFile, TEST_EXPORT_SECURITY)).rejects.toMatchObject({
      code: 'NPC_TOMBSTONE_EXPORT_HASH_MISMATCH',
    });

    rmSync(exportFile);
    await writeVerifiedTombstoneExport(exportFile, envelope, TEST_EXPORT_SECURITY);
    chmodSync(exportFile, 0o640);
    await expect(readVerifiedTombstoneExport(exportFile, TEST_EXPORT_SECURITY)).rejects.toMatchObject({
      code: 'NPC_TOMBSTONE_EXPORT_PERMISSIONS',
    });
  });

  it('rejects a hash-valid envelope with a structurally incomplete operation or snapshot', async () => {
    const validEnvelope = createTombstoneExportEnvelope({
      args,
      rawSnapshot: rawSnapshot(),
      generatedAt: new Date('2026-08-11T10:00:00.000Z'),
    });
    const malformedPayload = {
      ...validEnvelope.payload,
      operation: undefined,
    };
    const malformedEnvelope = {
      ...validEnvelope,
      payload: malformedPayload,
      payloadSha256: createHash('sha256')
        .update(canonicalJson(malformedPayload))
        .digest('hex'),
    };
    writeFileSync(exportFile, `${canonicalJson(malformedEnvelope)}\n`, { mode: 0o600 });

    await expect(readVerifiedTombstoneExport(exportFile, TEST_EXPORT_SECURITY)).rejects.toMatchObject({
      code: 'NPC_TOMBSTONE_EXPORT_INVALID',
    });

    const emptySnapshotPayload = {
      ...validEnvelope.payload,
      snapshot: {
        submission: {},
        pages: [],
        report: null,
        job: null,
        audits: [],
        snapshotSha256: '0'.repeat(64),
      },
    };
    const emptySnapshotEnvelope = {
      ...validEnvelope,
      payload: emptySnapshotPayload,
      payloadSha256: createHash('sha256')
        .update(canonicalJson(emptySnapshotPayload))
        .digest('hex'),
    };
    writeFileSync(exportFile, `${canonicalJson(emptySnapshotEnvelope)}\n`, { mode: 0o600 });

    await expect(readVerifiedTombstoneExport(exportFile, TEST_EXPORT_SECURITY)).rejects.toMatchObject({
      code: 'NPC_TOMBSTONE_EXPORT_INVALID',
    });
  });

  it.each([
    'safe/./snapshot.json',
    'safe/link/../snapshot.json',
    'safe//snapshot.json',
  ])('rejects unnormalized destination %s before opening it', async (suffix) => {
    mkdirSync(join(directory, 'safe', 'link'), { recursive: true, mode: 0o700 });
    const rawPath = `${directory}/${suffix}`;
    const envelope = createTombstoneExportEnvelope({
      args,
      rawSnapshot: rawSnapshot(),
      generatedAt: new Date('2026-08-11T10:00:00.000Z'),
    });

    await expect(writeVerifiedTombstoneExport(
      rawPath,
      envelope,
      TEST_EXPORT_SECURITY,
    )).rejects.toMatchObject({ code: 'NPC_TOMBSTONE_EXPORT_PATH_INVALID' });
  });

  it('revalidates owner and 0700 mode in the export layer', async () => {
    const lockedParent = join(directory, 'locked-parent');
    mkdirSync(lockedParent, { mode: 0o750 });
    const envelope = createTombstoneExportEnvelope({
      args,
      rawSnapshot: rawSnapshot(),
      generatedAt: new Date('2026-08-11T10:00:00.000Z'),
    });

    await expect(writeVerifiedTombstoneExport(
      join(lockedParent, 'snapshot.json'),
      envelope,
      TEST_EXPORT_SECURITY,
    )).rejects.toMatchObject({ code: 'NPC_TOMBSTONE_EXPORT_PARENT_PERMISSIONS' });
  });

  it('cannot escape or fsync a replacement parent after the trusted dirfd is opened', async () => {
    const trustedParent = join(directory, 'trusted-parent');
    const movedParent = join(directory, 'moved-parent');
    const escapeParent = join(directory, 'escape-parent');
    mkdirSync(trustedParent, { mode: 0o700 });
    mkdirSync(escapeParent, { mode: 0o700 });
    const destination = join(trustedParent, 'snapshot.json');
    const envelope = createTombstoneExportEnvelope({
      args,
      rawSnapshot: rawSnapshot(),
      generatedAt: new Date('2026-08-11T10:00:00.000Z'),
    });

    await expect(writeVerifiedTombstoneExport(destination, envelope, {
      ...TEST_EXPORT_SECURITY,
      onParentVerified() {
        renameSync(trustedParent, movedParent);
        symlinkSync(escapeParent, trustedParent, 'dir');
      },
    })).rejects.toMatchObject({ code: 'NPC_TOMBSTONE_EXPORT_PARENT_CHANGED' });
    expect(existsSync(join(escapeParent, 'snapshot.json'))).toBe(false);
  });
});
