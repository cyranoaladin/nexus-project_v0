/** @jest-environment node */

import {
  buildTombstoneSnapshot,
  canonicalJson,
  createTombstoneCryptoContext,
  createTombstoneExportEnvelope,
  decryptAndVerifyTombstoneEnvelope,
  tombstoneArtifactPath,
} from '@/lib/npc/tombstone/export';
import {
  NPC_TOMBSTONE_REASON,
  NPC_TOMBSTONE_REASON_CODE,
  buildTombstoneOperationIdentity,
  type TombstoneArguments,
} from '@/lib/npc/tombstone/types';

const args: TombstoneArguments = {
  version: 1,
  submissionId: 'sub_synthetic_export',
  expectedInitialStatus: 'COMPLETED',
  expectedPageCount: 4,
  expectedReportId: 'report_synthetic_export',
  expectedReportStatus: 'DRAFT',
  expectedReportVisibility: 'COACH_ONLY',
  reasonCode: NPC_TOMBSTONE_REASON_CODE,
  reason: NPC_TOMBSTONE_REASON,
  actorId: 'admin_synthetic_export',
  actorRole: 'ADMIN',
  exportRoot: '/secure/tombstone-artifacts',
};

const cryptoContext = createTombstoneCryptoContext(
  'synthetic-document-encryption-key-with-at-least-thirty-two-characters',
);

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
      title: 'Dossier synthétique confidentiel',
      description: 'Description libre confidentielle',
      sourceType: 'AUTRE',
      sourceId: null,
      status: 'COMPLETED',
      unavailableReason: null,
      unavailableAt: null,
      ocrText: 'OCR confidentiel',
      ocrError: null,
      aiJobId: 'job_synthetic_export',
      storedFilePath: 'sub_synthetic_export/source.pdf',
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
      originalFilePath: `sub_synthetic_export/page-${index + 1}.pdf`,
      originalFilename: `private-page-${index + 1}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: index + 10,
      sha256: String(index + 1).repeat(64),
      uploadedById: null,
      convertedFilePaths: [],
      ocrText: `private OCR page ${index + 1}`,
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
      diagnostic: { result: 'private diagnostic', password: 'must-not-export' },
      strengths: ['private strength'],
      weaknesses: ['private weakness'],
      rawAiOutput: { authorization: 'Bearer must-not-export' },
      validatedAiOutput: null,
      sentToStudentAt: null,
      readByStudentAt: null,
      coachNotes: 'private coach note',
      studentSummary: 'private student summary',
    },
    job: {
      id: 'job_synthetic_export',
      createdAt: new Date('2026-08-11T08:30:00.000Z'),
      updatedAt: new Date('2026-08-11T08:31:00.000Z'),
      type: 'PEDAGOGICAL_DIAGNOSIS',
      status: 'COMPLETED',
      priority: 'NORMAL',
      copySubmissionId: null,
      inputData: { password: 'must-not-export' },
      outputData: { secret: 'must-not-export' },
      errorMessage: null,
      retryCount: 0,
      maxRetries: 3,
      claimedAt: null,
      claimedBy: null,
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
        entityType: 'CopyPage',
        entityId: 'deleted_page_synthetic',
        details: JSON.stringify({ submissionId: args.submissionId, secret: 'must-not-export' }),
      },
    ],
  };
}

describe('NPC tombstone encrypted export', () => {
  it('derives the operation identity from the exact typed fields, never the export root or time', () => {
    const identity = buildTombstoneOperationIdentity(args);
    expect(identity.fields).toEqual({
      protocolVersion: 'npc-tombstone/v1',
      submissionId: args.submissionId,
      expectedInitialStatus: 'COMPLETED',
      expectedPageCount: 4,
      expectedReportId: args.expectedReportId,
      expectedReportStatus: 'DRAFT',
      expectedReportVisibility: 'COACH_ONLY',
      reasonCode: NPC_TOMBSTONE_REASON_CODE,
      reason: NPC_TOMBSTONE_REASON,
      actorId: args.actorId,
      actorRole: 'ADMIN',
    });
    expect(buildTombstoneOperationIdentity({ ...args, exportRoot: '/another/root' })).toEqual(identity);
    expect(tombstoneArtifactPath(args)).toBe(
      `/secure/tombstone-artifacts/${identity.sha256}.json`,
    );
  });

  it('fails closed for an absent or weak master encryption key', () => {
    expect(() => createTombstoneCryptoContext(undefined)).toThrow(
      expect.objectContaining({ code: 'NPC_TOMBSTONE_ENCRYPTION_KEY_INVALID' }),
    );
    expect(() => createTombstoneCryptoContext('too-short')).toThrow(
      expect.objectContaining({ code: 'NPC_TOMBSTONE_ENCRYPTION_KEY_INVALID' }),
    );
  });

  it('stores only authenticated ciphertext in the JSON envelope and recovers the complete allowlisted snapshot', () => {
    const envelope = createTombstoneExportEnvelope({
      args,
      rawSnapshot: rawSnapshot(),
      generatedAt: new Date('2026-08-11T10:00:00.000Z'),
      crypto: cryptoContext,
    });
    const serialized = canonicalJson(envelope);

    expect(envelope).toMatchObject({
      format: 'nexus-npc-tombstone-export',
      version: 2,
      metadata: {
        algorithm: 'aes-256-gcm',
        keyVersion: 'v1',
        operationDigest: buildTombstoneOperationIdentity(args).sha256,
      },
      iv: expect.stringMatching(/^[A-Za-z0-9+/]+={0,2}$/),
      authTag: expect.stringMatching(/^[A-Za-z0-9+/]+={0,2}$/),
      ciphertext: expect.stringMatching(/^[A-Za-z0-9+/]+={0,2}$/),
      ciphertextChecksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    for (const plaintext of [
      args.submissionId,
      args.expectedReportId,
      args.actorId,
      NPC_TOMBSTONE_REASON,
      'Dossier synthétique confidentiel',
      'private OCR page 1',
      'private coach note',
      'must-not-export',
      'deleted_page_synthetic',
    ]) {
      expect(serialized).not.toContain(plaintext);
    }

    const payload = decryptAndVerifyTombstoneEnvelope(envelope, cryptoContext);
    expect(payload.operation.arguments).toEqual(buildTombstoneOperationIdentity(args).fields);
    expect(payload.snapshot.submission).toMatchObject({
      id: args.submissionId,
      title: 'Dossier synthétique confidentiel',
      ocrText: 'OCR confidentiel',
    });
    expect(payload.snapshot.pages).toHaveLength(4);
    expect(payload.snapshot.report).toMatchObject({
      id: args.expectedReportId,
      coachNotes: 'private coach note',
    });
    expect(payload.snapshot.job).toMatchObject({ id: 'job_synthetic_export', copySubmissionId: null });
    expect(payload.snapshot.audits).toHaveLength(1);
    expect(payload.snapshot.audits[0]).toMatchObject({
      id: 'audit_synthetic_existing',
      entityId: 'deleted_page_synthetic',
    });
    expect(canonicalJson(payload)).not.toContain('must-not-export');
    expect(payload.snapshot.snapshotHmacSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects ciphertext, tag, checksum, metadata and noncanonical shape corruption', () => {
    const envelope = createTombstoneExportEnvelope({
      args,
      rawSnapshot: rawSnapshot(),
      generatedAt: new Date('2026-08-11T10:00:00.000Z'),
      crypto: cryptoContext,
    });
    const variants = [
      { ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -4)}AAAA` },
      { ...envelope, authTag: Buffer.alloc(16, 1).toString('base64') },
      { ...envelope, ciphertextChecksumSha256: 'a'.repeat(64) },
      { ...envelope, metadata: { ...envelope.metadata, operationDigest: 'b'.repeat(64) } },
      { ...envelope, extra: true },
    ];
    for (const variant of variants) {
      expect(() => decryptAndVerifyTombstoneEnvelope(variant, cryptoContext)).toThrow(
        expect.objectContaining({ code: expect.stringMatching(/^NPC_TOMBSTONE_/) }),
      );
    }
  });

  it('builds deterministic snapshot content and keyed digest while excluding opaque secret containers', () => {
    const first = buildTombstoneSnapshot(rawSnapshot(), cryptoContext);
    const second = buildTombstoneSnapshot(rawSnapshot(), cryptoContext);
    expect(second).toEqual(first);
    expect(canonicalJson(first)).not.toContain('must-not-export');
    expect(first.report).toMatchObject({
      rawAiOutput: { redacted: true, hmacSha256: expect.stringMatching(/^[a-f0-9]{64}$/), byteLength: expect.any(Number) },
    });
    expect(first.job).toMatchObject({
      inputData: { redacted: true, hmacSha256: expect.stringMatching(/^[a-f0-9]{64}$/), byteLength: expect.any(Number) },
      outputData: { redacted: true, hmacSha256: expect.stringMatching(/^[a-f0-9]{64}$/), byteLength: expect.any(Number) },
    });
    expect(first.audits[0].details).toEqual({
      redacted: true,
      hmacSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      byteLength: expect.any(Number),
    });
  });
});
