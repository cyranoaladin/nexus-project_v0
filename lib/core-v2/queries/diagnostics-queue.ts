/**
 * ADMIN/ASSISTANTE diagnostics queue (candidat-libre) — lets staff discover
 * submissions needing attention without knowing a submission's id in
 * advance. Read-only, logistics-only: never selects `extractedText`,
 * `aiProposal`, `humanReview` or any evidentiary/academic content — the
 * detail route (gated separately by DIAGNOSTIC_SUBMISSION_CONTENT_READ /
 * DIAGNOSTIC_BILAN_REVIEW) is the only place that content is ever served.
 *
 * `projectDiagnosticQueueState` is the canonical executable state contract.
 * The bounded SQL projection below is generated from the same status buckets
 * and rank map, with real-DB parity tests guarding every branch. A future
 * dashboard counter must reuse that SQL fragment in this repository.
 */
import type { Prisma as PrismaTypes, PrismaClient } from '@/core-v2/generated/client';
import { z } from 'zod';
import { Prisma } from '../client';
import { assertCapability } from '../rbac';
import type { ServiceContext } from '../services/context';
import { idSchema } from '../services/validation';
import type { Page } from './staff';
import {
  CURRENT_DIAGNOSTIC_SUBMISSION_STATUSES,
  type CurrentDiagnosticSubmissionStatus,
} from '@/lib/diagnostics/current-submission';

const DIAGNOSTIC_QUEUE_STATES = [
  'NOT_PROCESSED',
  'PROCESSING',
  'READY_FOR_REVIEW',
  'VALIDATED_UNPUBLISHED',
  'PUBLISHED',
  'FAILED',
] as const;
export type DiagnosticQueueState = (typeof DIAGNOSTIC_QUEUE_STATES)[number];

const DIAGNOSTIC_PROCESSING_STATUSES = [
  'QUEUED',
  'EXTRACTING',
  'EXTRACTED',
  'NO_EXTRACTABLE_TEXT',
  'EXTRACTION_FAILED',
] as const;
const DIAGNOSTIC_DRAFT_STATUSES = ['DRAFT', 'VALIDATED', 'PUBLISHED'] as const;

export const DIAGNOSTIC_QUEUE_FILTERS = [
  'ACTION_REQUIRED',
  'NOT_PROCESSED',
  'PROCESSING',
  'READY_FOR_REVIEW',
  'VALIDATED_UNPUBLISHED',
  'PUBLISHED',
  'FAILED',
  'ALL',
] as const;
export type DiagnosticQueueFilter = (typeof DIAGNOSTIC_QUEUE_FILTERS)[number];

export interface DiagnosticQueueStatusInput {
  readonly submissionStatus: CurrentDiagnosticSubmissionStatus;
  readonly processingStatus: (typeof DIAGNOSTIC_PROCESSING_STATUSES)[number] | null;
  readonly draftStatus: (typeof DIAGNOSTIC_DRAFT_STATUSES)[number] | null;
}

const PROCESSING_QUEUE_STATUSES = ['QUEUED', 'EXTRACTING'] as const;
const FAILED_QUEUE_STATUSES = ['EXTRACTION_FAILED', 'NO_EXTRACTABLE_TEXT'] as const;
const DRAFT_QUEUE_STATE = {
  PUBLISHED: 'PUBLISHED',
  VALIDATED: 'VALIDATED_UNPUBLISHED',
} as const satisfies Partial<
  Record<NonNullable<DiagnosticQueueStatusInput['draftStatus']>, DiagnosticQueueState>
>;

/**
 * The one state-projection function (mission "GO-LIVE ARIA/queue" §I):
 * pure, exhaustive over the real enum combinations, never re-derived by the
 * route or the client.
 */
export function projectDiagnosticQueueState(input: DiagnosticQueueStatusInput): DiagnosticQueueState {
  if (!input.processingStatus) return 'NOT_PROCESSED';
  if (PROCESSING_QUEUE_STATUSES.some((status) => status === input.processingStatus)) return 'PROCESSING';
  if (FAILED_QUEUE_STATUSES.some((status) => status === input.processingStatus)) return 'FAILED';
  // processingStatus === 'EXTRACTED' from here on.
  const draftState = input.draftStatus ? DRAFT_QUEUE_STATE[input.draftStatus as keyof typeof DRAFT_QUEUE_STATE] : null;
  if (draftState) return draftState;
  return 'READY_FOR_REVIEW'; // no draft yet, or draft still DRAFT
}

const ACTION_REQUIRED_STATE_VALUES = [
  'NOT_PROCESSED',
  'READY_FOR_REVIEW',
  'VALIDATED_UNPUBLISHED',
  'FAILED',
] as const satisfies readonly DiagnosticQueueState[];
const ACTION_REQUIRED_STATES: ReadonlySet<DiagnosticQueueState> = new Set(ACTION_REQUIRED_STATE_VALUES);

/** Staleness matters for a queue: these are handled/inert, everything else needs a human. */
export function isActionRequiredState(state: DiagnosticQueueState): boolean {
  return ACTION_REQUIRED_STATES.has(state);
}

/** Deterministic priority for the default sort: action-required states first, in a stable order. */
const STATE_SORT_RANK: Readonly<Record<DiagnosticQueueState, number>> = {
  NOT_PROCESSED: 0,
  READY_FOR_REVIEW: 1,
  VALIDATED_UNPUBLISHED: 2,
  FAILED: 3,
  PROCESSING: 4,
  PUBLISHED: 5,
};

export const diagnosticQueueQuerySchema = z.object({
  status: z.enum(DIAGNOSTIC_QUEUE_FILTERS).default('ACTION_REQUIRED'),
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type DiagnosticQueueQuery = z.infer<typeof diagnosticQueueQuerySchema>;

export interface DiagnosticQueueRow {
  readonly submissionId: string;
  readonly state: DiagnosticQueueState;
  readonly candidate: { readonly id: string; readonly firstName: string | null; readonly lastName: string | null };
  readonly instrument: { readonly instrumentKey: string; readonly version: string; readonly title: string };
  readonly submission: {
    readonly version: number;
    readonly status: DiagnosticQueueStatusInput['submissionStatus'];
    readonly createdAt: Date;
  };
  readonly processingStatus: DiagnosticQueueStatusInput['processingStatus'];
  readonly draftStatus: DiagnosticQueueStatusInput['draftStatus'];
  readonly lastActivityAt: Date;
}

export const queueCandidateSelect = {
  id: true,
  user: { select: { firstName: true, lastName: true } },
} satisfies PrismaTypes.StudentSelect;

function queueStateSql(processingStatus: Prisma.Sql, draftStatus: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`CASE
    WHEN ${processingStatus} IS NULL THEN 'NOT_PROCESSED'
    WHEN ${processingStatus} IN (${Prisma.join([...PROCESSING_QUEUE_STATUSES])}) THEN 'PROCESSING'
    WHEN ${processingStatus} IN (${Prisma.join([...FAILED_QUEUE_STATUSES])}) THEN 'FAILED'
    ${Prisma.join(
      Object.entries(DRAFT_QUEUE_STATE).map(
        ([status, state]) => Prisma.sql`WHEN ${draftStatus} = ${status} THEN ${state}`,
      ),
      ' ',
    )}
    ELSE 'READY_FOR_REVIEW'
  END`;
}

const QUEUE_STATE_SQL = queueStateSql(
  Prisma.raw('p."status"::text'),
  Prisma.raw('d."draftStatus"'),
);

const QUEUE_STATE_RANK_SQL = Prisma.sql`CASE "state"
  ${Prisma.join(
    Object.entries(STATE_SORT_RANK).map(([state, rank]) => Prisma.sql`WHEN ${state} THEN ${rank}`),
    ' ',
  )}
  ELSE 999
END`;

function queueFilterSql(filter: DiagnosticQueueFilter): Prisma.Sql {
  if (filter === 'ALL') return Prisma.sql`TRUE`;
  if (filter === 'ACTION_REQUIRED') {
    return Prisma.sql`"state" IN (${Prisma.join([...ACTION_REQUIRED_STATE_VALUES])})`;
  }
  return Prisma.sql`"state" = ${filter}`;
}

function buildDiagnosticQueuePageSql(query: DiagnosticQueueQuery): Prisma.Sql {
  const cursorPredicate = query.cursor
    ? Prisma.sql`AND EXISTS (SELECT 1 FROM "anchor")
        AND (
          q."stateRank" > (SELECT "stateRank" FROM "anchor")
          OR (
            q."stateRank" = (SELECT "stateRank" FROM "anchor")
            AND q."lastActivityAt" > (SELECT "lastActivityAt" FROM "anchor")
          )
          OR (
            q."stateRank" = (SELECT "stateRank" FROM "anchor")
            AND q."lastActivityAt" = (SELECT "lastActivityAt" FROM "anchor")
            AND q."submissionId" > (SELECT "submissionId" FROM "anchor")
          )
        )`
    : Prisma.empty;

  return Prisma.sql`
    WITH "latestUsableSubmission" AS (
      SELECT DISTINCT ON (s."assignmentId")
        s."id" AS "submissionId",
        s."assignmentId",
        s."version" AS "submissionVersion",
        s."status"::text AS "submissionStatus",
        s."createdAt" AS "submissionCreatedAt",
        s."updatedAt" AS "submissionUpdatedAt"
      FROM "diagnostic_submissions" s
      WHERE s."status"::text IN (${Prisma.join([...CURRENT_DIAGNOSTIC_SUBMISSION_STATUSES])})
      ORDER BY s."assignmentId" ASC, s."version" DESC
    ),
    "latestDraft" AS (
      SELECT DISTINCT ON (d."processingId")
        d."processingId",
        d."status"::text AS "draftStatus",
        d."updatedAt" AS "draftUpdatedAt"
      FROM "diagnostic_bilan_drafts" d
      ORDER BY d."processingId" ASC, d."revision" DESC
    ),
    "stateProjected" AS (
      SELECT
        s."submissionId",
        st."id" AS "candidateId",
        u."firstName" AS "candidateFirstName",
        u."lastName" AS "candidateLastName",
        i."instrumentKey",
        i."version" AS "instrumentVersion",
        i."title" AS "instrumentTitle",
        s."submissionVersion",
        s."submissionStatus",
        s."submissionCreatedAt",
        p."status"::text AS "processingStatus",
        d."draftStatus",
        GREATEST(s."submissionUpdatedAt", p."updatedAt", d."draftUpdatedAt") AS "lastActivityAt",
        ${QUEUE_STATE_SQL} AS "state"
      FROM "latestUsableSubmission" s
      INNER JOIN "diagnostic_assignments" a ON a."id" = s."assignmentId"
      INNER JOIN "students_v2" st ON st."id" = a."studentId"
      INNER JOIN "users" u ON u."id" = st."userId"
      INNER JOIN "diagnostic_instrument_refs" i ON i."id" = a."instrumentRefId"
      LEFT JOIN "diagnostic_submission_processings" p ON p."submissionId" = s."submissionId"
      LEFT JOIN "latestDraft" d ON d."processingId" = p."id"
    ),
    "ranked" AS (
      SELECT "stateProjected".*, (${QUEUE_STATE_RANK_SQL})::integer AS "stateRank"
      FROM "stateProjected"
    ),
    "filtered" AS (
      SELECT * FROM "ranked" WHERE ${queueFilterSql(query.status)}
    ),
    "anchor" AS (
      SELECT "stateRank", "lastActivityAt", "submissionId"
      FROM "filtered"
      WHERE "submissionId" = ${query.cursor ?? ''}
    )
    SELECT
      q."submissionId",
      q."state",
      q."stateRank",
      q."candidateId",
      q."candidateFirstName",
      q."candidateLastName",
      q."instrumentKey",
      q."instrumentVersion",
      q."instrumentTitle",
      q."submissionVersion",
      q."submissionStatus",
      q."submissionCreatedAt",
      q."processingStatus",
      q."draftStatus",
      q."lastActivityAt"
    FROM "filtered" q
    WHERE TRUE ${cursorPredicate}
    ORDER BY q."stateRank" ASC, q."lastActivityAt" ASC, q."submissionId" ASC
    LIMIT ${query.limit + 1}
  `;
}

const queueDateSchema = z
  .union([z.date(), z.string().datetime({ offset: true })])
  .transform((value) => (value instanceof Date ? value : new Date(value)));

const diagnosticQueueRawRowSchema = z
  .object({
    submissionId: z.string().min(1),
    state: z.enum(DIAGNOSTIC_QUEUE_STATES),
    stateRank: z.number().int().nonnegative(),
    candidateId: z.string().min(1),
    candidateFirstName: z.string().nullable(),
    candidateLastName: z.string().nullable(),
    instrumentKey: z.string(),
    instrumentVersion: z.string(),
    instrumentTitle: z.string(),
    submissionVersion: z.number().int().positive(),
    submissionStatus: z.enum(CURRENT_DIAGNOSTIC_SUBMISSION_STATUSES),
    submissionCreatedAt: queueDateSchema,
    processingStatus: z.enum(DIAGNOSTIC_PROCESSING_STATUSES).nullable(),
    draftStatus: z.enum(DIAGNOSTIC_DRAFT_STATUSES).nullable(),
    lastActivityAt: queueDateSchema,
  })
  .strict();

export type DiagnosticQueueRawRow = z.infer<typeof diagnosticQueueRawRowSchema>;

export function mapDiagnosticQueueRawRow(raw: DiagnosticQueueRawRow): DiagnosticQueueRow {
  return {
    submissionId: raw.submissionId,
    state: raw.state,
    candidate: {
      id: raw.candidateId,
      firstName: raw.candidateFirstName,
      lastName: raw.candidateLastName,
    },
    instrument: {
      instrumentKey: raw.instrumentKey,
      version: raw.instrumentVersion,
      title: raw.instrumentTitle,
    },
    submission: {
      version: raw.submissionVersion,
      status: raw.submissionStatus,
      createdAt: raw.submissionCreatedAt,
    },
    processingStatus: raw.processingStatus,
    draftStatus: raw.draftStatus,
    lastActivityAt: raw.lastActivityAt,
  };
}

export function materializeDiagnosticQueuePage(
  rawRows: readonly unknown[],
  limit: number,
  mapper: (raw: DiagnosticQueueRawRow) => DiagnosticQueueRow = mapDiagnosticQueueRawRow,
): Page<DiagnosticQueueRow> {
  const boundedRows = rawRows.slice(0, limit + 1).map((raw) => diagnosticQueueRawRowSchema.parse(raw));
  const rows = boundedRows.map(mapper);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    nextCursor: hasMore ? (items[items.length - 1]?.submissionId ?? null) : null,
  };
}

/**
 * Server-filtered, server-paginated queue. Everything is loaded with an
 * explicit `select`/`include` allow-list (never a bare `include: true` on
 * `processing`/`draft`) so `extractedText`/`aiProposal`/`humanReview` are
 * structurally unreachable from this query, not merely omitted by
 * discipline.
 */
export async function listDiagnosticSubmissionsQueue(
  client: PrismaClient,
  ctx: ServiceContext,
  query: DiagnosticQueueQuery,
): Promise<Page<DiagnosticQueueRow>> {
  assertCapability(ctx.actor, 'DIAGNOSTIC_SUBMISSION_TRACK');
  const rows = await client.$queryRaw<unknown[]>(buildDiagnosticQueuePageSql(query));
  return materializeDiagnosticQueuePage(rows, query.limit);
}
