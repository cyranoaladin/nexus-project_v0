import { createHash } from 'node:crypto';
import { lstat } from 'node:fs/promises';

import {
  CopyPageStatus,
  CopySubmissionStatus,
  Prisma,
  type PrismaClient,
} from '@prisma/client';

import { CopySubmissionNotFoundError, withLockedCopySubmission } from '../submission-lock';
import { NPC_INTERACTIVE_TRANSACTION_OPTIONS } from '../transaction';
import {
  buildTombstoneSnapshot,
  canonicalJson,
  createTombstoneExportEnvelope,
  readVerifiedTombstoneExport,
  writeVerifiedTombstoneExport,
  type RawTombstoneSnapshot,
  type TombstoneExportEnvelope,
  type TombstoneExportSecurityOptions,
  type VerifiedTombstoneExport,
} from './export';
import {
  NPC_TOMBSTONE_AUDIT_ACTION,
  NpcTombstoneError,
  buildTombstoneOperationIdentity,
  type TombstoneArguments,
  type TombstoneOperationIdentity,
  tombstoneError,
  validateTombstoneReason,
} from './types';

export interface ExecuteNpcTombstoneOptions {
  now?: () => Date;
  testOnlyTrustedUid?: number;
}

export interface ExecuteNpcTombstoneResult {
  status: 'applied' | 'already-applied';
  operationKey: string;
  exportPayloadSha256: string;
}

type TombstoneTransaction = Prisma.TransactionClient;

interface LockedSnapshot extends RawTombstoneSnapshot {
  submission: NonNullable<Awaited<ReturnType<TombstoneTransaction['copySubmission']['findUnique']>>>;
  pages: Awaited<ReturnType<TombstoneTransaction['copyPage']['findMany']>>;
  report: Awaited<ReturnType<TombstoneTransaction['pedagogicalReport']['findUnique']>>;
  job: Awaited<ReturnType<TombstoneTransaction['aiProcessingJob']['findUnique']>>;
  audits: Awaited<ReturnType<TombstoneTransaction['npcAuditLog']['findMany']>>;
}

interface TombstoneAuditDetails {
  operationKey: string;
  operation: TombstoneOperationIdentity['fields'];
  exportPayloadSha256: string;
  snapshotSha256: string;
  reason: string;
  affectedPageIds: string[];
  unavailableAt: string;
  rowCounts: {
    submissions: 1;
    pages: 4;
    audits: 1;
  };
  idempotenceProofSha256: string;
}

const TOMBSTONE_ROW_COUNTS = {
  submissions: 1,
  pages: 4,
  audits: 1,
} as const;

function asRawRecord(value: object): Record<string, unknown> {
  return value as unknown as Record<string, unknown>;
}

function asRawSnapshot(snapshot: LockedSnapshot): RawTombstoneSnapshot {
  return {
    submission: asRawRecord(snapshot.submission),
    pages: snapshot.pages.map(asRawRecord),
    report: snapshot.report ? asRawRecord(snapshot.report) : null,
    job: snapshot.job ? asRawRecord(snapshot.job) : null,
    audits: snapshot.audits.map(asRawRecord),
  };
}

async function lockAndReadSnapshot(
  tx: TombstoneTransaction,
  submissionId: string,
): Promise<LockedSnapshot> {
  try {
    return await withLockedCopySubmission(tx, submissionId, async () => {
      // Every target-linked row is locked before any status, count, report, or
      // operation argument is interpreted by the command.
      await tx.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "copy_pages"
        WHERE "submissionId" = ${submissionId}
        ORDER BY "id"
        FOR UPDATE
      `);
      await tx.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "pedagogical_reports"
        WHERE "copySubmissionId" = ${submissionId}
        ORDER BY "id"
        FOR UPDATE
      `);
      await tx.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "ai_processing_jobs"
        WHERE "copySubmissionId" = ${submissionId}
           OR "id" = (
             SELECT "aiJobId"
             FROM "copy_submissions"
             WHERE "id" = ${submissionId}
           )
        ORDER BY "id"
        FOR UPDATE
      `);
      await tx.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "npc_audit_logs"
        WHERE "entityId" = ${submissionId}
           OR "reportId" IN (
             SELECT "id"
             FROM "pedagogical_reports"
             WHERE "copySubmissionId" = ${submissionId}
           )
           OR "entityId" IN (
             SELECT "id"
             FROM "pedagogical_reports"
             WHERE "copySubmissionId" = ${submissionId}
           )
           OR "entityId" IN (
             SELECT "id"
             FROM "copy_pages"
             WHERE "submissionId" = ${submissionId}
           )
        ORDER BY "id"
        FOR UPDATE
      `);

      const submission = await tx.copySubmission.findUnique({
        where: { id: submissionId },
      });
      if (!submission) {
        tombstoneError('NPC_TOMBSTONE_TARGET_NOT_FOUND', 'Target submission was not found.');
      }
      const pages = await tx.copyPage.findMany({
        where: { submissionId },
        orderBy: [{ pageNumber: 'asc' }, { id: 'asc' }],
      });
      const report = await tx.pedagogicalReport.findUnique({
        where: { copySubmissionId: submissionId },
      });

      let job = submission.aiJobId
        ? await tx.aiProcessingJob.findUnique({ where: { id: submission.aiJobId } })
        : null;
      if (!job) {
        job = await tx.aiProcessingJob.findUnique({
          where: { copySubmissionId: submissionId },
        });
      }
      const auditEntityIds = [
        submissionId,
        ...pages.map((page) => page.id),
        ...(report ? [report.id] : []),
      ];
      const audits = await tx.npcAuditLog.findMany({
        where: {
          OR: [
            { entityId: { in: auditEntityIds } },
            ...(report ? [{ reportId: report.id }] : []),
          ],
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });

      return { submission, pages, report, job, audits } as LockedSnapshot;
    });
  } catch (error) {
    if (error instanceof CopySubmissionNotFoundError) {
      tombstoneError('NPC_TOMBSTONE_TARGET_NOT_FOUND', 'Target submission was not found.');
    }
    throw error;
  }
}

function isNodeError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

async function destinationExists(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return true;
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return false;
    throw error;
  }
}

function assertEnvelopeMatchesOperation(
  envelope: TombstoneExportEnvelope,
  identity: TombstoneOperationIdentity,
): void {
  if (
    envelope.payload.operation.operationKey !== identity.operationKey ||
    envelope.payload.operation.auditId !== identity.auditId ||
    canonicalJson(envelope.payload.operation.arguments) !== canonicalJson(identity.fields)
  ) {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_OPERATION_MISMATCH',
      'Existing export belongs to a different tombstone operation.',
    );
  }
}

function assertEnvelopeMatchesLockedSnapshot(
  envelope: TombstoneExportEnvelope,
  locked: LockedSnapshot,
): void {
  const current = buildTombstoneSnapshot(asRawSnapshot(locked));
  if (
    envelope.payload.snapshot.snapshotSha256 !== current.snapshotSha256 ||
    canonicalJson(envelope.payload.snapshot) !== canonicalJson(current)
  ) {
    tombstoneError(
      'NPC_TOMBSTONE_SNAPSHOT_MISMATCH',
      'Locked rows no longer match the verified export snapshot.',
    );
  }
}

async function createOrResumeExport(
  args: TombstoneArguments,
  identity: TombstoneOperationIdentity,
  locked: LockedSnapshot,
  now: () => Date,
  exportSecurity: TombstoneExportSecurityOptions,
): Promise<VerifiedTombstoneExport> {
  let verified: VerifiedTombstoneExport;
  if (await destinationExists(args.exportFile)) {
    verified = await readVerifiedTombstoneExport(args.exportFile, exportSecurity);
  } else {
    const envelope = createTombstoneExportEnvelope({
      args,
      rawSnapshot: asRawSnapshot(locked),
      generatedAt: now(),
    });
    verified = await writeVerifiedTombstoneExport(args.exportFile, envelope, exportSecurity);
  }

  assertEnvelopeMatchesOperation(verified.envelope, identity);
  assertEnvelopeMatchesLockedSnapshot(verified.envelope, locked);
  return verified;
}

function assertBusinessScope(
  locked: LockedSnapshot,
  args: TombstoneArguments,
): void {
  if (locked.submission.status !== args.expectedInitialStatus) {
    tombstoneError(
      'NPC_TOMBSTONE_SUBMISSION_STATUS_MISMATCH',
      'Submission status does not match the expected initial status.',
    );
  }
  if (locked.pages.length !== args.expectedPageCount) {
    tombstoneError(
      'NPC_TOMBSTONE_PAGE_COUNT_MISMATCH',
      'Submission does not contain exactly four pages.',
    );
  }
  if (!locked.report || locked.report.id !== args.expectedReportId) {
    tombstoneError(
      'NPC_TOMBSTONE_REPORT_ID_MISMATCH',
      'Linked report does not match the expected report identifier.',
    );
  }
  if (locked.report.status !== args.expectedReportStatus) {
    tombstoneError(
      'NPC_TOMBSTONE_REPORT_STATUS_MISMATCH',
      'Linked report status does not match the expected status.',
    );
  }
  if (locked.report.visibility !== args.expectedReportVisibility) {
    tombstoneError(
      'NPC_TOMBSTONE_REPORT_VISIBILITY_MISMATCH',
      'Linked report visibility does not match the expected visibility.',
    );
  }
  if (new Set(locked.pages.map((page) => page.id)).size !== args.expectedPageCount) {
    tombstoneError(
      'NPC_TOMBSTONE_PAGE_COUNT_MISMATCH',
      'Submission page identity is not exact.',
    );
  }
}

function idempotenceProofSha256({
  identity,
  exportPayloadSha256,
  snapshotSha256,
  reason,
  unavailableAt,
}: {
  identity: TombstoneOperationIdentity;
  exportPayloadSha256: string;
  snapshotSha256: string;
  reason: string;
  unavailableAt: string;
}): string {
  return createHash('sha256').update(canonicalJson({
    protocolVersion: identity.fields.protocolVersion,
    operationKey: identity.operationKey,
    exportPayloadSha256,
    snapshotSha256,
    reason,
    unavailableAt,
    rowCounts: TOMBSTONE_ROW_COUNTS,
    auditId: identity.auditId,
  })).digest('hex');
}

function buildAuditDetails(
  identity: TombstoneOperationIdentity,
  verified: VerifiedTombstoneExport,
  affectedPageIds: string[],
  unavailableAt: Date,
): TombstoneAuditDetails {
  const unavailableAtIso = unavailableAt.toISOString();
  const snapshotSha256 = verified.envelope.payload.snapshot.snapshotSha256;
  const details = {
    operationKey: identity.operationKey,
    operation: identity.fields,
    exportPayloadSha256: verified.payloadSha256,
    snapshotSha256,
    reason: identity.fields.reason,
    affectedPageIds,
    unavailableAt: unavailableAtIso,
    rowCounts: TOMBSTONE_ROW_COUNTS,
    idempotenceProofSha256: idempotenceProofSha256({
      identity,
      exportPayloadSha256: verified.payloadSha256,
      snapshotSha256,
      reason: identity.fields.reason,
      unavailableAt: unavailableAtIso,
    }),
  };
  return details;
}

function auditDetails(value: Prisma.JsonValue | null): TombstoneAuditDetails | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as unknown as TombstoneAuditDetails;
}

function hasExactAuditDetails(
  details: TombstoneAuditDetails | null,
  identity: TombstoneOperationIdentity,
  pageIds: string[],
  unavailableAt: Date,
): details is TombstoneAuditDetails {
  if (!details) return false;
  if (
    canonicalJson(Object.keys(details).sort()) !== canonicalJson([
      'affectedPageIds',
      'exportPayloadSha256',
      'idempotenceProofSha256',
      'operation',
      'operationKey',
      'reason',
      'rowCounts',
      'snapshotSha256',
      'unavailableAt',
    ]) ||
    !details.operation ||
    typeof details.operation !== 'object' ||
    !Array.isArray(details.affectedPageIds) ||
    !details.affectedPageIds.every((pageId) => typeof pageId === 'string') ||
    !/^[a-f0-9]{64}$/.test(details.exportPayloadSha256) ||
    !/^[a-f0-9]{64}$/.test(details.snapshotSha256) ||
    !/^[a-f0-9]{64}$/.test(details.idempotenceProofSha256) ||
    !details.rowCounts ||
    canonicalJson(details.rowCounts) !== canonicalJson(TOMBSTONE_ROW_COUNTS)
  ) {
    return false;
  }
  return (
    details.operationKey === identity.operationKey &&
    canonicalJson(details.operation) === canonicalJson(identity.fields) &&
    details.reason === identity.fields.reason &&
    details.unavailableAt === unavailableAt.toISOString() &&
    canonicalJson(details.affectedPageIds) === canonicalJson(pageIds) &&
    details.idempotenceProofSha256 === idempotenceProofSha256({
      identity,
      exportPayloadSha256: details.exportPayloadSha256,
      snapshotSha256: details.snapshotSha256,
      reason: details.reason,
      unavailableAt: details.unavailableAt,
    })
  );
}

async function validateAlreadyApplied(
  locked: LockedSnapshot,
  args: TombstoneArguments,
  identity: TombstoneOperationIdentity,
  exportSecurity: TombstoneExportSecurityOptions,
): Promise<ExecuteNpcTombstoneResult> {
  const unavailableAt = locked.submission.unavailableAt;
  const exactReport =
    locked.report?.id === args.expectedReportId &&
    locked.report.status === args.expectedReportStatus &&
    locked.report.visibility === args.expectedReportVisibility;
  const exactPages =
    locked.pages.length === args.expectedPageCount &&
    unavailableAt !== null &&
    locked.pages.every(
      (page) =>
        page.status === CopyPageStatus.UNAVAILABLE &&
        page.unavailableReason === args.reason &&
        page.unavailableAt?.getTime() === unavailableAt.getTime(),
    );
  const tombstoneAudits = locked.audits.filter(
    (audit) =>
      audit.entityId === args.submissionId &&
      (audit.action === NPC_TOMBSTONE_AUDIT_ACTION ||
        /(?:TOMBSTONE|UNAVAILABLE)/i.test(audit.action)),
  );
  const exactAudit = tombstoneAudits.length === 1
    ? tombstoneAudits[0]
    : null;
  const details = exactAudit ? auditDetails(exactAudit.details) : null;

  if (
    locked.submission.status !== CopySubmissionStatus.UNAVAILABLE ||
    locked.submission.unavailableReason !== args.reason ||
    !unavailableAt ||
    !exactReport ||
    !exactPages ||
    !exactAudit ||
    exactAudit.id !== identity.auditId ||
    exactAudit.action !== NPC_TOMBSTONE_AUDIT_ACTION ||
    exactAudit.entityType !== 'CopySubmission' ||
    exactAudit.actorId !== args.actorId ||
    exactAudit.actorRole !== args.actorRole ||
    exactAudit.reportId !== args.expectedReportId ||
    exactAudit.createdAt.getTime() !== unavailableAt.getTime() ||
    !hasExactAuditDetails(
      details,
      identity,
      locked.pages.map((page) => page.id),
      unavailableAt,
    )
  ) {
    tombstoneError(
      'NPC_TOMBSTONE_IDEMPOTENCE_INVALID',
      'Existing unavailable state is not the exact result of this operation.',
    );
  }

  if (await destinationExists(args.exportFile)) {
    const verified = await readVerifiedTombstoneExport(args.exportFile, exportSecurity);
    assertEnvelopeMatchesOperation(verified.envelope, identity);
    if (
      verified.payloadSha256 !== details.exportPayloadSha256 ||
      verified.envelope.payload.snapshot.snapshotSha256 !== details.snapshotSha256
    ) {
      tombstoneError(
        'NPC_TOMBSTONE_IDEMPOTENCE_INVALID',
        'Existing export does not match the committed audit.',
      );
    }
  }

  return {
    status: 'already-applied',
    operationKey: identity.operationKey,
    exportPayloadSha256: details.exportPayloadSha256,
  };
}

async function applyTombstone(
  tx: TombstoneTransaction,
  locked: LockedSnapshot,
  args: TombstoneArguments,
  identity: TombstoneOperationIdentity,
  verified: VerifiedTombstoneExport,
): Promise<ExecuteNpcTombstoneResult> {
  const unavailableAt = new Date(verified.envelope.payload.operation.generatedAt);
  if (Number.isNaN(unavailableAt.getTime())) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_INVALID', 'Export timestamp is invalid.');
  }
  const pageIds = locked.pages.map((page) => page.id);

  const submissionUpdate = await tx.copySubmission.updateMany({
    where: {
      id: args.submissionId,
      status: args.expectedInitialStatus,
      unavailableReason: null,
      unavailableAt: null,
    },
    data: {
      status: CopySubmissionStatus.UNAVAILABLE,
      unavailableReason: args.reason,
      unavailableAt,
    },
  });
  if (submissionUpdate.count !== 1) {
    tombstoneError(
      'NPC_TOMBSTONE_DATABASE_ROW_COUNT_MISMATCH',
      'Submission update did not affect exactly one row.',
    );
  }

  const pagesUpdate = await tx.copyPage.updateMany({
    where: {
      submissionId: args.submissionId,
      id: { in: pageIds },
      unavailableReason: null,
      unavailableAt: null,
    },
    data: {
      status: CopyPageStatus.UNAVAILABLE,
      unavailableReason: args.reason,
      unavailableAt,
    },
  });
  if (pagesUpdate.count !== args.expectedPageCount) {
    tombstoneError(
      'NPC_TOMBSTONE_DATABASE_ROW_COUNT_MISMATCH',
      'Page update did not affect exactly four rows.',
    );
  }

  const details = buildAuditDetails(identity, verified, pageIds, unavailableAt);
  await tx.npcAuditLog.create({
    data: {
      id: identity.auditId,
      createdAt: unavailableAt,
      reportId: args.expectedReportId,
      action: NPC_TOMBSTONE_AUDIT_ACTION,
      actorId: args.actorId,
      actorRole: args.actorRole,
      entityType: 'CopySubmission',
      entityId: args.submissionId,
      details: details as unknown as Prisma.InputJsonValue,
    },
  });

  const [submissionCount, pageCount, auditCount] = await Promise.all([
    tx.copySubmission.count({
      where: {
        id: args.submissionId,
        status: CopySubmissionStatus.UNAVAILABLE,
        unavailableReason: args.reason,
        unavailableAt,
      },
    }),
    tx.copyPage.count({
      where: {
        submissionId: args.submissionId,
        id: { in: pageIds },
        status: CopyPageStatus.UNAVAILABLE,
        unavailableReason: args.reason,
        unavailableAt,
      },
    }),
    tx.npcAuditLog.count({
      where: {
        id: identity.auditId,
        action: NPC_TOMBSTONE_AUDIT_ACTION,
        entityType: 'CopySubmission',
        entityId: args.submissionId,
      },
    }),
  ]);
  if (submissionCount !== 1 || pageCount !== 4 || auditCount !== 1) {
    tombstoneError(
      'NPC_TOMBSTONE_DATABASE_ROW_COUNT_MISMATCH',
      'Post-write row counts do not match the tombstone protocol.',
    );
  }

  return {
    status: 'applied',
    operationKey: identity.operationKey,
    exportPayloadSha256: verified.payloadSha256,
  };
}

export async function executeNpcTombstone(
  prisma: PrismaClient,
  args: TombstoneArguments,
  options: ExecuteNpcTombstoneOptions = {},
): Promise<ExecuteNpcTombstoneResult> {
  validateTombstoneReason(args.reason);
  const identity = buildTombstoneOperationIdentity(args);
  const now = options.now ?? (() => new Date());
  const exportSecurity: TombstoneExportSecurityOptions = {};
  if (options.testOnlyTrustedUid !== undefined) {
    if (
      process.env.NODE_ENV !== 'test' ||
      typeof process.getuid !== 'function' ||
      options.testOnlyTrustedUid !== process.getuid()
    ) {
      tombstoneError(
        'NPC_TOMBSTONE_TEST_IDENTITY_FORBIDDEN',
        'Injected export identity is restricted to the test runtime.',
      );
    }
    exportSecurity.trustedUid = options.testOnlyTrustedUid;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const locked = await lockAndReadSnapshot(tx, args.submissionId);

      if (locked.submission.status === CopySubmissionStatus.UNAVAILABLE) {
        return validateAlreadyApplied(locked, args, identity, exportSecurity);
      }

      let verified: VerifiedTombstoneExport;
      try {
        verified = await createOrResumeExport(args, identity, locked, now, exportSecurity);
      } catch (error) {
        if (error instanceof NpcTombstoneError) throw error;
        throw new NpcTombstoneError(
          'NPC_TOMBSTONE_EXPORT_FAILURE',
          'Export could not be created and verified.',
        );
      }

      assertBusinessScope(locked, args);

      // Re-read every still-locked row after physical export verification.
      const stillLocked = await lockAndReadSnapshot(tx, args.submissionId);
      assertEnvelopeMatchesLockedSnapshot(verified.envelope, stillLocked);
      assertBusinessScope(stillLocked, args);

      return applyTombstone(tx, stillLocked, args, identity, verified);
    }, NPC_INTERACTIVE_TRANSACTION_OPTIONS);
  } catch (error) {
    if (error instanceof NpcTombstoneError) throw error;
    throw new NpcTombstoneError(
      'NPC_TOMBSTONE_DATABASE_FAILURE',
      'Database transaction failed and was rolled back; a verified export may remain.',
    );
  }
}
