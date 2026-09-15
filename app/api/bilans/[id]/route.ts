import { serializeError } from '@/lib/utils/serialize-error';
/**
 * Bilan Individual API
 * GET /api/bilans/[id] — Get bilan by ID
 * PUT /api/bilans/[id] — Update bilan
 * DELETE /api/bilans/[id] — Delete bilan
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { parseJsonBody } from '@/lib/api/helpers';
import {
  buildBilanReadWhere,
  buildBilanWriteWhere,
  sanitizeBilanForRole,
} from '@/lib/security/ownership';
import { BilanStatus, BilanReviewDecision, BilanType } from '@/lib/bilan/types';
import {
  resolvePeriodicBilanNotificationIntent,
  enqueuePeriodicBilanNotification,
  isDuplicateNotificationError,
  type PeriodicBilanNotificationIntent,
} from '@/lib/aria/notifications/notify-parent-periodic-bilan-published';
import { isParentReportingEligibleForStudent } from '@/lib/aria/bilans/periodic/parent-reporting-eligibility';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const routeParamsSchema = z.object({
  id: z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/),
}).strict();

const updateBilanBodySchema = z.object({
  status: z.nativeEnum(BilanStatus).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  globalScore: z.number().min(0).max(100).optional(),
  confidenceIndex: z.number().min(0).max(100).optional(),
  ssn: z.number().min(0).max(100).optional(),
  uai: z.number().min(0).max(100).optional(),
  domainScores: z.unknown().optional(),
  studentMarkdown: z.string().max(80_000).optional(),
  parentsMarkdown: z.string().max(80_000).optional(),
  nexusMarkdown: z.string().max(80_000).optional(),
  analysisJson: z.unknown().optional(),
  isPublished: z.boolean().optional(),
  errorCode: z.string().trim().max(120).nullable().optional(),
  errorDetails: z.string().trim().max(2000).nullable().optional(),
  retryCount: z.number().int().min(0).max(20).optional(),
  ragUsed: z.boolean().optional(),
  ragCollections: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  sourceVersion: z.string().trim().max(120).optional(),
  engineVersion: z.string().trim().max(120).optional(),
  reviewDecision: z.nativeEnum(BilanReviewDecision).optional(),
}).strict();

function validationFailed() {
  return NextResponse.json({ success: false, error: 'Données invalides' }, { status: 400 });
}

function reviewRequired() {
  return NextResponse.json(
    { success: false, error: 'Une revue approuvée est requise avant publication.' },
    { status: 403 },
  );
}

/**
 * Thrown inside the PUT transaction to abort it (rolling back any partial
 * write) when the locked, transaction-consistent row shows the review
 * gate is not actually satisfied — caught outside to return the same 403
 * `reviewRequired()` response. A plain thrown Error would also roll back
 * the transaction, but a dedicated class lets the outer catch distinguish
 * "expected 403" from a genuine unexpected failure.
 */
class ReviewGateRequiredError extends Error {}

interface LockedBilanRow {
  id: string;
  isPublished: boolean;
  reviewDecision: BilanReviewDecision | null;
  studentId: string | null;
  subject: string;
  type: BilanType;
}

/**
 * GET /api/bilans/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const authResponse = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH', 'ELEVE', 'PARENT']);
  if (isErrorResponse(authResponse)) return authResponse;

  try {
    const parsedParams = routeParamsSchema.safeParse(await params);
    if (!parsedParams.success) return validationFailed();
    const { id } = parsedParams.data;
    const where = buildBilanReadWhere(id, authResponse.user);
    if (!where) {
      return NextResponse.json(
        { success: false, error: 'Bilan not found' },
        { status: 404 }
      );
    }

    const bilan = await prisma.bilan.findFirst({
      where,
      include: {
        student: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true, email: true } },
            grade: true,
            school: true,
          },
        },
        stage: { select: { id: true, title: true, slug: true, startDate: true, endDate: true } },
        coach: { select: { id: true, pseudonym: true, user: { select: { firstName: true, lastName: true } } } },
      },
    });

    if (!bilan) {
      return NextResponse.json(
        { success: false, error: 'Bilan not found' },
        { status: 404 }
      );
    }

    // ARIA_PERIODIC parent-reporting gate: ownership (checked above via
    // buildBilanReadWhere) is necessary but not sufficient for this type —
    // a parent whose child's ARIA tier doesn't include `parentReporting`
    // must not be able to read the detail either, even if they somehow
    // hold the bilan id (e.g. from a stale link, or one sent before a
    // downgrade). Same 404 shape as "not found": never reveal that a
    // bilan exists for a family that isn't entitled to see it.
    if (
      authResponse.user.role === 'PARENT'
      && bilan.type === 'ARIA_PERIODIC'
      && bilan.studentId
      && !(await isParentReportingEligibleForStudent(bilan.studentId))
    ) {
      return NextResponse.json(
        { success: false, error: 'Bilan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: sanitizeBilanForRole(bilan, authResponse.user.role),
    });
  } catch (error) {
    console.error('[GET /api/bilans/[id]] Error:', serializeError(error));
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bilan' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/bilans/[id]
 * Update bilan fields (scoring, markdowns, status, etc.)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const authResponse = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH']);
  if (isErrorResponse(authResponse)) return authResponse;

  try {
    const parsedParams = routeParamsSchema.safeParse(await params);
    if (!parsedParams.success) return validationFailed();
    let rawBody: unknown;
    try {
      rawBody = await parseJsonBody(request);
    } catch {
      return validationFailed();
    }
    const parsedBody = updateBilanBodySchema.safeParse(rawBody);
    if (!parsedBody.success) return validationFailed();
    const { id } = parsedParams.data;
    const body = parsedBody.data;
    const where = buildBilanWriteWhere(id, authResponse.user);
    if (!where) {
      return NextResponse.json(
        { success: false, error: 'Bilan not found' },
        { status: 404 }
      );
    }

    // Existence/ownership check — role-based relational scoping
    // (buildBilanWriteWhere) never changes mid-request, so this pre-check
    // is safe to run outside the transaction. The actual publish-decision
    // fields (isPublished/reviewDecision) are re-read under a row lock
    // inside the transaction below — never trusted from this snapshot.
    const existing = await prisma.bilan.findFirst({ where, select: { id: true } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Bilan not found' },
        { status: 404 }
      );
    }

    // Static part of the update — every field whose value never depends
    // on the bilan's current isPublished/reviewDecision.
    const staticUpdateData: Record<string, unknown> = {};

    if (body.reviewDecision !== undefined) {
      staticUpdateData.reviewDecision = body.reviewDecision;
      staticUpdateData.reviewedById = authResponse.user.id;
      staticUpdateData.reviewedAt = new Date();
    }
    if (body.status !== undefined) staticUpdateData.status = body.status;
    if (body.progress !== undefined) staticUpdateData.progress = body.progress;
    if (body.globalScore !== undefined) staticUpdateData.globalScore = body.globalScore;
    if (body.confidenceIndex !== undefined) staticUpdateData.confidenceIndex = body.confidenceIndex;
    if (body.ssn !== undefined) staticUpdateData.ssn = body.ssn;
    if (body.uai !== undefined) staticUpdateData.uai = body.uai;
    if (body.domainScores !== undefined) staticUpdateData.domainScores = body.domainScores;
    if (body.studentMarkdown !== undefined) staticUpdateData.studentMarkdown = body.studentMarkdown;
    if (body.parentsMarkdown !== undefined) staticUpdateData.parentsMarkdown = body.parentsMarkdown;
    if (body.nexusMarkdown !== undefined) staticUpdateData.nexusMarkdown = body.nexusMarkdown;
    if (body.analysisJson !== undefined) staticUpdateData.analysisJson = body.analysisJson;
    if (body.errorCode !== undefined) staticUpdateData.errorCode = body.errorCode;
    if (body.errorDetails !== undefined) staticUpdateData.errorDetails = body.errorDetails;
    if (body.retryCount !== undefined) staticUpdateData.retryCount = body.retryCount;
    if (body.ragUsed !== undefined) staticUpdateData.ragUsed = body.ragUsed;
    if (body.ragCollections !== undefined) staticUpdateData.ragCollections = body.ragCollections;
    if (body.sourceVersion !== undefined) staticUpdateData.sourceVersion = body.sourceVersion;
    if (body.engineVersion !== undefined) staticUpdateData.engineVersion = body.engineVersion;

    let notificationIntent: PeriodicBilanNotificationIntent | null = null;

    // Everything that depends on "is this bilan currently published, and
    // with what review decision" happens inside ONE locked transaction:
    // the false->true publish transition, the human-review gate, the
    // entitlement/parent-contact snapshot used to build the notification,
    // and the durable notification intent itself. `SELECT ... FOR UPDATE`
    // serializes concurrent PUTs on the same bilan — a second concurrent
    // request blocks here until the first commits, then sees the
    // already-published row and correctly skips both the gate and the
    // notification, instead of two requests racing off the same stale
    // pre-transaction `isPublished: false` snapshot.
    let updated;
    try {
      updated = await prisma.$transaction(async (transaction) => {
        const locked = await transaction.$queryRaw<LockedBilanRow[]>(Prisma.sql`
          SELECT id, "isPublished", "reviewDecision", "studentId", subject, type
          FROM "bilans" WHERE id = ${id} FOR UPDATE
        `);
        const row = locked[0];
        if (!row) {
          // Existed moments ago (the outer check); deleted concurrently
          // since. Surfaced as the same 404 by the outer catch below via
          // a thrown sentinel would need a new response type, so just
          // treat this exactly like "not found" was known from the start.
          throw new ReviewGateRequiredError('BILAN_DELETED_CONCURRENTLY');
        }

        const isPublishTransition = row.type === BilanType.ARIA_PERIODIC
          && body.isPublished === true
          && !row.isPublished;

        if (isPublishTransition) {
          const effectiveDecision = body.reviewDecision ?? row.reviewDecision;
          if (effectiveDecision !== BilanReviewDecision.APPROVED) {
            throw new ReviewGateRequiredError('REVIEW_NOT_APPROVED');
          }
        }

        const updateData = { ...staticUpdateData };
        if (body.isPublished !== undefined) {
          updateData.isPublished = body.isPublished;
          if (body.isPublished && !row.isPublished) {
            updateData.publishedAt = new Date();
          }
        }

        // ARIA_PERIODIC parent notification (P7c): resolved from the
        // SAME locked row and the SAME transaction that performs the
        // write below — never a pre-transaction snapshot. `null` means
        // no notification is owed at all (ineligible tier, or no real
        // parent contact) — not a failure.
        if (isPublishTransition && row.studentId) {
          notificationIntent = await resolvePeriodicBilanNotificationIntent(
            { bilanId: row.id, studentId: row.studentId, subject: row.subject },
            transaction,
          );
        }

        const updatedRow = await transaction.bilan.update({
          where: { id },
          data: updateData,
        });

        if (notificationIntent) {
          try {
            await enqueuePeriodicBilanNotification(transaction, notificationIntent);
          } catch (error) {
            if (!isDuplicateNotificationError(error)) throw error;
            // Already enqueued by a transaction that won a genuine
            // concurrent double-fire race — not a failure, and this
            // transaction's publish write is still correct to keep.
          }
        }

        return updatedRow;
      });
    } catch (error) {
      if (error instanceof ReviewGateRequiredError) {
        if (error.message === 'BILAN_DELETED_CONCURRENTLY') {
          return NextResponse.json({ success: false, error: 'Bilan not found' }, { status: 404 });
        }
        return reviewRequired();
      }
      throw error;
    }

    // The publish (or any other update) and the durable notification
    // intent commit atomically: either both land, or neither does. There
    // is no window in which the bilan is published but no notification
    // was durably recorded — a transient outbox failure now fails the
    // whole PUT (the caller can retry) instead of silently losing the
    // notification behind an already-committed publication.
    if (notificationIntent) {
      kickEmailOutboxDrain();
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Bilan updated successfully',
    });
  } catch (error) {
    console.error('[PUT /api/bilans/[id]] Error:', serializeError(error));
    return NextResponse.json(
      { success: false, error: 'Failed to update bilan' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bilans/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Auth check — ADMIN only for deletes
  const authResponse = await requireAnyRole(['ADMIN']);
  if (isErrorResponse(authResponse)) return authResponse;

  try {
    const parsedParams = routeParamsSchema.safeParse(await params);
    if (!parsedParams.success) return validationFailed();
    const { id } = parsedParams.data;

    // Check bilan exists
    const existing = await prisma.bilan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Bilan not found' },
        { status: 404 }
      );
    }

    // Delete bilan
    await prisma.bilan.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Bilan deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/bilans/[id]] Error:', serializeError(error));
    return NextResponse.json(
      { success: false, error: 'Failed to delete bilan' },
      { status: 500 }
    );
  }
}
