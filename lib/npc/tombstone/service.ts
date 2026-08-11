import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

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
  canonicalizeTombstonePath,
  createTombstoneCryptoContext,
  createTombstoneExportEnvelope,
  readVerifiedTombstoneExport,
  tombstoneArtifactPath,
  tombstoneProofHmac,
  writeVerifiedTombstoneExport,
  type RawTombstoneSnapshot,
  type TombstoneCryptoContext,
  type TombstoneExportPayload,
  type VerifiedTombstoneExport,
} from './export';
import {
  NPC_TOMBSTONE_AUDIT_ACTION,
  NPC_TOMBSTONE_REASON,
  NPC_TOMBSTONE_REASON_CODE,
  NpcTombstoneError,
  buildTombstoneOperationIdentity,
  type TombstoneArguments,
  type TombstoneOperationIdentity,
  tombstoneError,
} from './types';

export interface ExecuteNpcTombstoneOptions {
  now?: () => Date;
}

export interface ExecuteNpcTombstoneResult {
  status: 'applied' | 'already-applied';
  operationKey: string;
  artifactChecksumSha256: string;
}

type TombstoneTransaction = Prisma.TransactionClient;
type SubmissionRow = NonNullable<Awaited<ReturnType<TombstoneTransaction['copySubmission']['findUnique']>>>;
type PageRows = Awaited<ReturnType<TombstoneTransaction['copyPage']['findMany']>>;
type ReportRow = Awaited<ReturnType<TombstoneTransaction['pedagogicalReport']['findUnique']>>;
type JobRows = Awaited<ReturnType<TombstoneTransaction['aiProcessingJob']['findMany']>>;
type AuditRows = Awaited<ReturnType<TombstoneTransaction['npcAuditLog']['findMany']>>;

interface LockedSnapshot extends RawTombstoneSnapshot {
  submission: SubmissionRow;
  pages: PageRows;
  report: ReportRow;
  job: JobRows[number] | null;
  jobs: JobRows;
  audits: AuditRows;
}

interface TombstoneAuditDetails {
  operationKey: string;
  operation: TombstoneOperationIdentity['fields'];
  artifactChecksumSha256: string;
  snapshotHmacSha256: string;
  reasonCode: typeof NPC_TOMBSTONE_REASON_CODE;
  reason: typeof NPC_TOMBSTONE_REASON;
  affectedPageIds: string[];
  unavailableAt: string;
  rowCounts: typeof TOMBSTONE_ROW_COUNTS;
  idempotenceProofHmacSha256: string;
}

const TOMBSTONE_ROW_COUNTS = {
  submissions: 1,
  pages: 4,
  audits: 1,
} as const;

function asRecord(value: object): Record<string, unknown> {
  return value as unknown as Record<string, unknown>;
}

function asRawSnapshot(snapshot: LockedSnapshot): RawTombstoneSnapshot {
  return {
    submission: asRecord(snapshot.submission),
    pages: snapshot.pages.map(asRecord),
    report: snapshot.report ? asRecord(snapshot.report) : null,
    job: snapshot.job ? asRecord(snapshot.job) : null,
    audits: snapshot.audits.map(asRecord),
  };
}

function detailsSubmissionId(value: Prisma.JsonValue | null): string | null {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const candidate = (parsed as Record<string, unknown>).submissionId;
  return typeof candidate === 'string' ? candidate : null;
}

function isDirectlyLinkedAudit(
  audit: AuditRows[number],
  submissionId: string,
  pageIds: Set<string>,
  reportId: string | null,
): boolean {
  return audit.entityId === submissionId ||
    pageIds.has(audit.entityId) ||
    (reportId !== null && (audit.entityId === reportId || audit.reportId === reportId));
}

async function lockAndReadSnapshot(
  tx: TombstoneTransaction,
  submissionId: string,
): Promise<LockedSnapshot> {
  try {
    return await withLockedCopySubmission(tx, submissionId, async () => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "copy_pages"
        WHERE "submissionId" = ${submissionId}
        ORDER BY "id" FOR UPDATE
      `);
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "pedagogical_reports"
        WHERE "copySubmissionId" = ${submissionId}
        ORDER BY "id" FOR UPDATE
      `);
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "ai_processing_jobs"
        WHERE "copySubmissionId" = ${submissionId}
           OR "id" = (SELECT "aiJobId" FROM "copy_submissions" WHERE "id" = ${submissionId})
        ORDER BY "id" FOR UPDATE
      `);

      const legacyPattern = `"submissionId"[[:space:]]*:[[:space:]]*"${submissionId}"`;
      const auditIds = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "npc_audit_logs"
        WHERE "entityId" = ${submissionId}
           OR "reportId" IN (
             SELECT "id" FROM "pedagogical_reports" WHERE "copySubmissionId" = ${submissionId}
           )
           OR "entityId" IN (
             SELECT "id" FROM "pedagogical_reports" WHERE "copySubmissionId" = ${submissionId}
           )
           OR "entityId" IN (
             SELECT "id" FROM "copy_pages" WHERE "submissionId" = ${submissionId}
           )
           OR (
             jsonb_typeof("details") = 'object'
             AND "details" @> ${JSON.stringify({ submissionId })}::jsonb
           )
           OR (
             jsonb_typeof("details") = 'string'
             AND ("details" #>> '{}') ~ ${legacyPattern}
           )
        ORDER BY "id" FOR UPDATE
      `);

      const submission = await tx.copySubmission.findUnique({ where: { id: submissionId } });
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
      const jobs = await tx.aiProcessingJob.findMany({
        where: {
          OR: [
            ...(submission.aiJobId ? [{ id: submission.aiJobId }] : []),
            { copySubmissionId: submissionId },
          ],
        },
        orderBy: { id: 'asc' },
      });
      const job = submission.aiJobId
        ? jobs.find((candidate) => candidate.id === submission.aiJobId) ?? jobs[0] ?? null
        : jobs[0] ?? null;
      const candidates = auditIds.length === 0
        ? []
        : await tx.npcAuditLog.findMany({
          where: { id: { in: auditIds.map(({ id }) => id) } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
      const pageIds = new Set(pages.map((page) => page.id));
      const reportId = report?.id ?? null;
      const audits = candidates.filter((audit) =>
        isDirectlyLinkedAudit(audit, submissionId, pageIds, reportId) ||
        detailsSubmissionId(audit.details) === submissionId);

      return { submission, pages, report, job, jobs, audits } as LockedSnapshot;
    });
  } catch (error) {
    if (error instanceof CopySubmissionNotFoundError) {
      tombstoneError('NPC_TOMBSTONE_TARGET_NOT_FOUND', 'Target submission was not found.');
    }
    throw error;
  }
}

function atOrBelow(parent: string, candidate: string): boolean {
  const child = relative(parent, candidate);
  if (child === '') return true;
  const [first] = child.split(sep);
  return !isAbsolute(child) && first !== '..';
}

async function assertProductionRuntime(args: TombstoneArguments): Promise<void> {
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
    tombstoneError('NPC_TOMBSTONE_ROOT_REQUIRED', 'This command must execute as UID 0.');
  }
  const exportRoot = canonicalizeTombstonePath(args.exportRoot);
  let exportStats: Awaited<ReturnType<typeof lstat>>;
  let resolvedExport: string;
  try {
    [exportStats, resolvedExport] = await Promise.all([lstat(exportRoot), realpath(exportRoot)]);
  } catch {
    tombstoneError('NPC_TOMBSTONE_EXPORT_PARENT_INVALID', 'Artifact root must exist.');
  }
  if (
    !exportStats.isDirectory() ||
    exportStats.isSymbolicLink() ||
    resolvedExport !== exportRoot
  ) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_SYMLINK', 'Artifact root must be a stable directory.');
  }
  if (exportStats.uid !== 0) {
    tombstoneError('NPC_TOMBSTONE_EXPORT_PARENT_OWNER', 'Artifact root must be root-owned.');
  }
  if ((Number(exportStats.mode) & 0o077) !== 0) {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_PARENT_PERMISSIONS',
      'Artifact root must grant no group or world permissions.',
    );
  }
  const repositoryRoot = await realpath(resolve());
  const releaseRoot = await realpath(resolve(process.env.NEXUS_RELEASE_ROOT ?? repositoryRoot));
  if (atOrBelow(repositoryRoot, resolvedExport) || atOrBelow(releaseRoot, resolvedExport)) {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_SCOPE_INVALID',
      'Artifact root must be outside the repository and active release.',
    );
  }
}

function assertEnvelopeMatchesOperation(
  payload: TombstoneExportPayload,
  identity: TombstoneOperationIdentity,
): void {
  if (
    payload.operation.operationKey !== identity.operationKey ||
    payload.operation.auditId !== identity.auditId ||
    canonicalJson(payload.operation.arguments) !== canonicalJson(identity.fields)
  ) {
    tombstoneError(
      'NPC_TOMBSTONE_EXPORT_OPERATION_MISMATCH',
      'Canonical artifact belongs to another operation.',
    );
  }
}

function assertEnvelopeMatchesLockedSnapshot(
  payload: TombstoneExportPayload,
  locked: LockedSnapshot,
  crypto: TombstoneCryptoContext,
): void {
  const current = buildTombstoneSnapshot(asRawSnapshot(locked), crypto);
  if (canonicalJson(payload.snapshot) !== canonicalJson(current)) {
    tombstoneError(
      'NPC_TOMBSTONE_SNAPSHOT_MISMATCH',
      'Locked rows no longer match the authenticated artifact.',
    );
  }
}

async function createOrResumeExport(
  args: TombstoneArguments,
  locked: LockedSnapshot,
  now: () => Date,
  crypto: TombstoneCryptoContext,
): Promise<VerifiedTombstoneExport> {
  const artifactPath = tombstoneArtifactPath(args);
  try {
    return await readVerifiedTombstoneExport(artifactPath, crypto);
  } catch (error) {
    if (!(error instanceof NpcTombstoneError) || error.code !== 'NPC_TOMBSTONE_ARTIFACT_REQUIRED') {
      throw error;
    }
  }
  const envelope = createTombstoneExportEnvelope({
    args,
    rawSnapshot: asRawSnapshot(locked),
    generatedAt: now(),
    crypto,
  });
  return writeVerifiedTombstoneExport(artifactPath, envelope, crypto);
}

function assertBusinessScope(locked: LockedSnapshot, args: TombstoneArguments): void {
  if (locked.submission.status !== args.expectedInitialStatus) {
    tombstoneError(
      'NPC_TOMBSTONE_SUBMISSION_STATUS_MISMATCH',
      'Submission status does not match the request.',
    );
  }
  if (locked.pages.length !== args.expectedPageCount ||
    new Set(locked.pages.map((page) => page.id)).size !== args.expectedPageCount) {
    tombstoneError(
      'NPC_TOMBSTONE_PAGE_COUNT_MISMATCH',
      'Submission does not contain exactly four distinct pages.',
    );
  }
  if (!locked.report || locked.report.id !== args.expectedReportId) {
    tombstoneError('NPC_TOMBSTONE_REPORT_ID_MISMATCH', 'Linked report id does not match.');
  }
  if (locked.report.status !== args.expectedReportStatus) {
    tombstoneError('NPC_TOMBSTONE_REPORT_STATUS_MISMATCH', 'Linked report status does not match.');
  }
  if (locked.report.visibility !== args.expectedReportVisibility) {
    tombstoneError(
      'NPC_TOMBSTONE_REPORT_VISIBILITY_MISMATCH',
      'Linked report visibility does not match.',
    );
  }
  if (
    locked.jobs.length !== 1 ||
    !locked.job ||
    (locked.submission.aiJobId !== null && locked.submission.aiJobId !== locked.job.id) ||
    (locked.submission.aiJobId === null && locked.job.copySubmissionId !== args.submissionId) ||
    (locked.job.copySubmissionId !== null && locked.job.copySubmissionId !== args.submissionId)
  ) {
    tombstoneError('NPC_TOMBSTONE_JOB_LINK_MISMATCH', 'Linked processing job is contradictory.');
  }
}

async function assertAuthorizedActor(
  tx: TombstoneTransaction,
  args: TombstoneArguments,
): Promise<void> {
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "users" WHERE "id" = ${args.actorId} FOR UPDATE
  `);
  const actor = await tx.user.findUnique({ where: { id: args.actorId } });
  if (!actor) {
    tombstoneError('NPC_TOMBSTONE_ACTOR_NOT_FOUND', 'Responsible actor was not found.');
  }
  if (
    actor.role !== args.actorRole ||
    !['ADMIN', 'ASSISTANTE'].includes(actor.role)
  ) {
    tombstoneError('NPC_TOMBSTONE_ACTOR_ROLE_MISMATCH', 'Responsible actor role is not authorized.');
  }
  if (!actor.activatedAt || actor.mergedAt !== null || actor.mergedIntoUserId !== null) {
    tombstoneError('NPC_TOMBSTONE_ACTOR_INACTIVE', 'Responsible actor is not active.');
  }
}

function targetUnavailableAudits(
  audits: AuditRows,
  submissionId: string,
): AuditRows {
  return audits.filter((audit) =>
    audit.entityId === submissionId &&
    (audit.action === NPC_TOMBSTONE_AUDIT_ACTION || /(?:TOMBSTONE|UNAVAILABLE)/i.test(audit.action)));
}

function auditProofInput({
  identity,
  artifactChecksumSha256,
  snapshotHmacSha256,
  unavailableAt,
}: {
  identity: TombstoneOperationIdentity;
  artifactChecksumSha256: string;
  snapshotHmacSha256: string;
  unavailableAt: string;
}): Record<string, unknown> {
  return {
    protocolVersion: identity.fields.protocolVersion,
    operationKey: identity.operationKey,
    artifactChecksumSha256,
    snapshotHmacSha256,
    reasonCode: identity.fields.reasonCode,
    reason: identity.fields.reason,
    unavailableAt,
    rowCounts: TOMBSTONE_ROW_COUNTS,
    auditId: identity.auditId,
  };
}

function buildAuditDetails(
  identity: TombstoneOperationIdentity,
  verified: VerifiedTombstoneExport,
  pageIds: string[],
  unavailableAt: Date,
  crypto: TombstoneCryptoContext,
): TombstoneAuditDetails {
  const unavailableAtIso = unavailableAt.toISOString();
  const base = {
    operationKey: identity.operationKey,
    operation: identity.fields,
    artifactChecksumSha256: verified.artifactChecksumSha256,
    snapshotHmacSha256: verified.payload.snapshot.snapshotHmacSha256,
    reasonCode: identity.fields.reasonCode,
    reason: identity.fields.reason,
    affectedPageIds: pageIds,
    unavailableAt: unavailableAtIso,
    rowCounts: TOMBSTONE_ROW_COUNTS,
  };
  return {
    ...base,
    idempotenceProofHmacSha256: tombstoneProofHmac(crypto, auditProofInput({
      identity,
      artifactChecksumSha256: base.artifactChecksumSha256,
      snapshotHmacSha256: base.snapshotHmacSha256,
      unavailableAt: unavailableAtIso,
    })),
  };
}

function parsedAuditDetails(value: Prisma.JsonValue | null): TombstoneAuditDetails | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as unknown as TombstoneAuditDetails;
}

function exactAuditDetails(
  details: TombstoneAuditDetails | null,
  identity: TombstoneOperationIdentity,
  verified: VerifiedTombstoneExport,
  pageIds: string[],
  unavailableAt: Date,
  crypto: TombstoneCryptoContext,
): boolean {
  if (!details) return false;
  if (canonicalJson(Object.keys(details).sort()) !== canonicalJson([
    'affectedPageIds',
    'artifactChecksumSha256',
    'idempotenceProofHmacSha256',
    'operation',
    'operationKey',
    'reason',
    'reasonCode',
    'rowCounts',
    'snapshotHmacSha256',
    'unavailableAt',
  ].sort())) return false;
  const expectedProof = tombstoneProofHmac(crypto, auditProofInput({
    identity,
    artifactChecksumSha256: verified.artifactChecksumSha256,
    snapshotHmacSha256: verified.payload.snapshot.snapshotHmacSha256,
    unavailableAt: unavailableAt.toISOString(),
  }));
  return details.operationKey === identity.operationKey &&
    canonicalJson(details.operation) === canonicalJson(identity.fields) &&
    details.artifactChecksumSha256 === verified.artifactChecksumSha256 &&
    details.snapshotHmacSha256 === verified.payload.snapshot.snapshotHmacSha256 &&
    details.reasonCode === identity.fields.reasonCode &&
    details.reason === identity.fields.reason &&
    canonicalJson(details.affectedPageIds) === canonicalJson(pageIds) &&
    details.unavailableAt === unavailableAt.toISOString() &&
    canonicalJson(details.rowCounts) === canonicalJson(TOMBSTONE_ROW_COUNTS) &&
    details.idempotenceProofHmacSha256 === expectedProof;
}

function validateAlreadyApplied(
  locked: LockedSnapshot,
  args: TombstoneArguments,
  identity: TombstoneOperationIdentity,
  verified: VerifiedTombstoneExport,
  crypto: TombstoneCryptoContext,
): ExecuteNpcTombstoneResult {
  const unavailableAt = locked.submission.unavailableAt;
  const pageIds = locked.pages.map((page) => page.id);
  const tombstoneAudits = targetUnavailableAudits(locked.audits, args.submissionId);
  const exactAudit = tombstoneAudits.length === 1 ? tombstoneAudits[0] : null;
  if (
    locked.submission.status !== CopySubmissionStatus.UNAVAILABLE ||
    locked.submission.unavailableReason !== args.reason ||
    !unavailableAt ||
    locked.pages.length !== 4 ||
    locked.pages.some((page) =>
      page.status !== CopyPageStatus.UNAVAILABLE ||
      page.unavailableReason !== args.reason ||
      page.unavailableAt?.getTime() !== unavailableAt.getTime()) ||
    locked.report?.id !== args.expectedReportId ||
    locked.report.status !== args.expectedReportStatus ||
    locked.report.visibility !== args.expectedReportVisibility ||
    !exactAudit ||
    exactAudit.id !== identity.auditId ||
    exactAudit.action !== NPC_TOMBSTONE_AUDIT_ACTION ||
    exactAudit.entityType !== 'CopySubmission' ||
    exactAudit.actorId !== args.actorId ||
    exactAudit.actorRole !== args.actorRole ||
    exactAudit.reportId !== args.expectedReportId ||
    exactAudit.createdAt.getTime() !== unavailableAt.getTime() ||
    !exactAuditDetails(
      parsedAuditDetails(exactAudit.details),
      identity,
      verified,
      pageIds,
      unavailableAt,
      crypto,
    )
  ) {
    tombstoneError(
      'NPC_TOMBSTONE_IDEMPOTENCE_INVALID',
      'Unavailable state is not the exact result of this operation.',
    );
  }
  return {
    status: 'already-applied',
    operationKey: identity.operationKey,
    artifactChecksumSha256: verified.artifactChecksumSha256,
  };
}

async function applyTombstone(
  tx: TombstoneTransaction,
  locked: LockedSnapshot,
  args: TombstoneArguments,
  identity: TombstoneOperationIdentity,
  verified: VerifiedTombstoneExport,
  crypto: TombstoneCryptoContext,
): Promise<ExecuteNpcTombstoneResult> {
  const unavailableAt = new Date(verified.payload.operation.generatedAt);
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
  const pageUpdate = await tx.copyPage.updateMany({
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
  if (pageUpdate.count !== 4) {
    tombstoneError(
      'NPC_TOMBSTONE_DATABASE_ROW_COUNT_MISMATCH',
      'Page update did not affect exactly four rows.',
    );
  }
  const details = buildAuditDetails(identity, verified, pageIds, unavailableAt, crypto);
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
  const [submissionCount, pageCount, allTargetAudits] = await Promise.all([
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
    tx.npcAuditLog.findMany({ where: { entityId: args.submissionId } }),
  ]);
  if (
    submissionCount !== 1 ||
    pageCount !== 4 ||
    targetUnavailableAudits(allTargetAudits, args.submissionId).length !== 1
  ) {
    tombstoneError(
      'NPC_TOMBSTONE_DATABASE_ROW_COUNT_MISMATCH',
      'Post-write row counts do not match the protocol.',
    );
  }
  return {
    status: 'applied',
    operationKey: identity.operationKey,
    artifactChecksumSha256: verified.artifactChecksumSha256,
  };
}

export async function executeNpcTombstone(
  prisma: PrismaClient,
  args: TombstoneArguments,
  options: ExecuteNpcTombstoneOptions = {},
): Promise<ExecuteNpcTombstoneResult> {
  if (
    args.reasonCode !== NPC_TOMBSTONE_REASON_CODE ||
    args.reason !== NPC_TOMBSTONE_REASON
  ) {
    tombstoneError('NPC_TOMBSTONE_REASON_CODE_INVALID', 'Reason contract is invalid.');
  }
  const crypto = createTombstoneCryptoContext(process.env.DOCUMENT_ENCRYPTION_KEY);
  await assertProductionRuntime(args);
  const identity = buildTombstoneOperationIdentity(args);
  const now = options.now ?? (() => new Date());

  try {
    return await prisma.$transaction(async (tx) => {
      const locked = await lockAndReadSnapshot(tx, args.submissionId);
      let verified: VerifiedTombstoneExport;
      if (locked.submission.status === CopySubmissionStatus.UNAVAILABLE) {
        verified = await readVerifiedTombstoneExport(tombstoneArtifactPath(args), crypto);
        assertEnvelopeMatchesOperation(verified.payload, identity);
        return validateAlreadyApplied(locked, args, identity, verified, crypto);
      }
      try {
        verified = await createOrResumeExport(args, locked, now, crypto);
      } catch (error) {
        if (error instanceof NpcTombstoneError) throw error;
        tombstoneError('NPC_TOMBSTONE_EXPORT_FAILURE', 'Artifact could not be verified.');
      }
      assertEnvelopeMatchesOperation(verified.payload, identity);
      assertEnvelopeMatchesLockedSnapshot(verified.payload, locked, crypto);
      assertBusinessScope(locked, args);
      if (targetUnavailableAudits(locked.audits, args.submissionId).length !== 0) {
        tombstoneError(
          'NPC_TOMBSTONE_PREEXISTING_AUDIT',
          'Target already has a tombstone or unavailable audit.',
        );
      }
      await assertAuthorizedActor(tx, args);

      const stillLocked = await lockAndReadSnapshot(tx, args.submissionId);
      assertEnvelopeMatchesLockedSnapshot(verified.payload, stillLocked, crypto);
      assertBusinessScope(stillLocked, args);
      if (targetUnavailableAudits(stillLocked.audits, args.submissionId).length !== 0) {
        tombstoneError(
          'NPC_TOMBSTONE_PREEXISTING_AUDIT',
          'Target already has a tombstone or unavailable audit.',
        );
      }
      return applyTombstone(tx, stillLocked, args, identity, verified, crypto);
    }, NPC_INTERACTIVE_TRANSACTION_OPTIONS);
  } catch (error) {
    if (error instanceof NpcTombstoneError) throw error;
    throw new NpcTombstoneError(
      'NPC_TOMBSTONE_DATABASE_FAILURE',
      'Database transaction failed and was rolled back; the artifact may remain.',
    );
  }
}
