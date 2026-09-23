/**
 * ADMIN/ASSISTANTE diagnostics queue (candidat-libre) — lets staff discover
 * submissions needing attention without knowing a submission's id in
 * advance. Read-only, logistics-only: never selects `extractedText`,
 * `aiProposal`, `humanReview` or any evidentiary/academic content — the
 * detail route (gated separately by DIAGNOSTIC_SUBMISSION_CONTENT_READ /
 * DIAGNOSTIC_BILAN_REVIEW) is the only place that content is ever served.
 *
 * `projectDiagnosticQueueState` is the ONE state-projection function: the
 * list, its filters, its default sort and any future dashboard counter all
 * call this same function — never a second, independently-drifting
 * definition of "what needs action".
 */
import type { Prisma, PrismaClient } from '@/core-v2/generated/client';
import { z } from 'zod';
import { assertCapability } from '../rbac';
import type { ServiceContext } from '../services/context';
import { idSchema } from '../services/validation';
import type { Page } from './staff';
import {
  CURRENT_DIAGNOSTIC_SUBMISSION_STATUSES,
  isUsableDiagnosticSubmission,
  type CurrentDiagnosticSubmissionStatus,
} from '../diagnostics/current-submission';

export type DiagnosticQueueState =
  | 'NOT_PROCESSED'
  | 'PROCESSING'
  | 'READY_FOR_REVIEW'
  | 'VALIDATED_UNPUBLISHED'
  | 'PUBLISHED'
  | 'FAILED';

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
  readonly processingStatus:
    | 'QUEUED'
    | 'EXTRACTING'
    | 'EXTRACTED'
    | 'NO_EXTRACTABLE_TEXT'
    | 'EXTRACTION_FAILED'
    | null;
  readonly draftStatus: 'DRAFT' | 'VALIDATED' | 'PUBLISHED' | null;
}

/**
 * The one state-projection function (mission "GO-LIVE ARIA/queue" §I):
 * pure, exhaustive over the real enum combinations, never re-derived by the
 * route or the client.
 */
export function projectDiagnosticQueueState(input: DiagnosticQueueStatusInput): DiagnosticQueueState {
  if (!input.processingStatus) return 'NOT_PROCESSED';
  if (input.processingStatus === 'QUEUED' || input.processingStatus === 'EXTRACTING') return 'PROCESSING';
  if (input.processingStatus === 'EXTRACTION_FAILED' || input.processingStatus === 'NO_EXTRACTABLE_TEXT') {
    return 'FAILED';
  }
  // processingStatus === 'EXTRACTED' from here on.
  if (input.draftStatus === 'PUBLISHED') return 'PUBLISHED';
  if (input.draftStatus === 'VALIDATED') return 'VALIDATED_UNPUBLISHED';
  return 'READY_FOR_REVIEW'; // no draft yet, or draft still DRAFT
}

const ACTION_REQUIRED_STATES: ReadonlySet<DiagnosticQueueState> = new Set([
  'NOT_PROCESSED',
  'READY_FOR_REVIEW',
  'VALIDATED_UNPUBLISHED',
  'FAILED',
]);

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
} satisfies Prisma.StudentSelect;

const queueRowInclude = {
  assignment: {
    select: {
      student: { select: queueCandidateSelect },
      instrumentRef: { select: { instrumentKey: true, version: true, title: true } },
    },
  },
  processing: {
    select: {
      status: true,
      updatedAt: true,
      bilanDrafts: { select: { status: true, updatedAt: true }, orderBy: { revision: 'desc' as const }, take: 1 },
    },
  },
} as const;

function lastActivityOf(
  submissionUpdatedAt: Date,
  processing: { updatedAt: Date; bilanDrafts: readonly { updatedAt: Date }[] } | null,
): Date {
  let latest = submissionUpdatedAt;
  if (processing) {
    if (processing.updatedAt > latest) latest = processing.updatedAt;
    const draft = processing.bilanDrafts[0];
    if (draft && draft.updatedAt > latest) latest = draft.updatedAt;
  }
  return latest;
}

function toRow(submission: {
  id: string;
  version: number;
  status: DiagnosticQueueStatusInput['submissionStatus'];
  createdAt: Date;
  updatedAt: Date;
  assignment: {
    student: { id: string; user: { firstName: string | null; lastName: string | null } };
    instrumentRef: { instrumentKey: string; version: string; title: string };
  };
  processing: { status: DiagnosticQueueStatusInput['processingStatus']; updatedAt: Date; bilanDrafts: readonly { status: 'DRAFT' | 'VALIDATED' | 'PUBLISHED'; updatedAt: Date }[] } | null;
}): DiagnosticQueueRow {
  const processingStatus = submission.processing?.status ?? null;
  const draftStatus = submission.processing?.bilanDrafts[0]?.status ?? null;
  const state = projectDiagnosticQueueState({
    submissionStatus: submission.status,
    processingStatus,
    draftStatus,
  });
  return {
    submissionId: submission.id,
    state,
    candidate: {
      id: submission.assignment.student.id,
      firstName: submission.assignment.student.user.firstName,
      lastName: submission.assignment.student.user.lastName,
    },
    instrument: submission.assignment.instrumentRef,
    submission: { version: submission.version, status: submission.status, createdAt: submission.createdAt },
    processingStatus,
    draftStatus,
    lastActivityAt: lastActivityOf(submission.updatedAt, submission.processing),
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
): Promise<Page<DiagnosticQueueRow> & { readonly totalCount: number }> {
  assertCapability(ctx.actor, 'DIAGNOSTIC_SUBMISSION_TRACK');

  const submissions = await client.diagnosticSubmission.findMany({
    where: { status: { in: [...CURRENT_DIAGNOSTIC_SUBMISSION_STATUSES] } },
    select: {
      id: true,
      version: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      ...queueRowInclude,
    },
  });

  const rows = submissions.filter(isUsableDiagnosticSubmission).map(toRow);

  const filtered =
    query.status === 'ALL'
      ? rows
      : query.status === 'ACTION_REQUIRED'
        ? rows.filter((r) => isActionRequiredState(r.state))
        : rows.filter((r) => r.state === query.status);

  filtered.sort((a, b) => {
    const rankDiff = STATE_SORT_RANK[a.state] - STATE_SORT_RANK[b.state];
    if (rankDiff !== 0) return rankDiff;
    // Oldest first within a state: staleness matters for a queue.
    return a.lastActivityAt.getTime() - b.lastActivityAt.getTime();
  });

  const hasCursor = query.cursor !== undefined;
  const cursorIndex = hasCursor ? filtered.findIndex((r) => r.submissionId === query.cursor) : -1;
  const startIndex = hasCursor && cursorIndex !== -1 ? cursorIndex + 1 : 0;
  const slice = filtered.slice(startIndex, startIndex + query.limit + 1);
  const hasMore = slice.length > query.limit;
  const items = hasMore ? slice.slice(0, query.limit) : slice;

  return {
    totalCount: filtered.length,
    items,
    nextCursor: hasMore ? (items[items.length - 1]?.submissionId ?? null) : null,
  };
}
