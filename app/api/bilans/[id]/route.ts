import { serializeError } from '@/lib/utils/serialize-error';
/**
 * Bilan Individual API
 * GET /api/bilans/[id] — Get bilan by ID
 * PUT /api/bilans/[id] — Update bilan
 * DELETE /api/bilans/[id] — Delete bilan
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { parseJsonBody } from '@/lib/api/helpers';
import {
  buildBilanReadWhere,
  buildBilanWriteWhere,
  sanitizeBilanForRole,
} from '@/lib/security/ownership';
import { BilanStatus, BilanReviewDecision } from '@/lib/bilan/types';
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

    // Check bilan exists
    const existing = await prisma.bilan.findFirst({ where });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Bilan not found' },
        { status: 404 }
      );
    }

    // ARIA_PERIODIC human-review gate (P7b-2): publishing requires an
    // already-APPROVED review decision — either persisted from an earlier
    // call, or supplied APPROVED in this very call. Every other BilanType
    // predates this gate and is unaffected. Checked before any write.
    if (
      existing.type === 'ARIA_PERIODIC'
      && body.isPublished === true
      && !existing.isPublished
    ) {
      const effectiveDecision = body.reviewDecision ?? existing.reviewDecision;
      if (effectiveDecision !== BilanReviewDecision.APPROVED) return reviewRequired();
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.reviewDecision !== undefined) {
      updateData.reviewDecision = body.reviewDecision;
      updateData.reviewedById = authResponse.user.id;
      updateData.reviewedAt = new Date();
    }
    if (body.status !== undefined) updateData.status = body.status;
    if (body.progress !== undefined) updateData.progress = body.progress;
    if (body.globalScore !== undefined) updateData.globalScore = body.globalScore;
    if (body.confidenceIndex !== undefined) updateData.confidenceIndex = body.confidenceIndex;
    if (body.ssn !== undefined) updateData.ssn = body.ssn;
    if (body.uai !== undefined) updateData.uai = body.uai;
    if (body.domainScores !== undefined) updateData.domainScores = body.domainScores;
    if (body.studentMarkdown !== undefined) updateData.studentMarkdown = body.studentMarkdown;
    if (body.parentsMarkdown !== undefined) updateData.parentsMarkdown = body.parentsMarkdown;
    if (body.nexusMarkdown !== undefined) updateData.nexusMarkdown = body.nexusMarkdown;
    if (body.analysisJson !== undefined) updateData.analysisJson = body.analysisJson;
    if (body.isPublished !== undefined) {
      updateData.isPublished = body.isPublished;
      if (body.isPublished && !existing.isPublished) {
        updateData.publishedAt = new Date();
      }
    }
    if (body.errorCode !== undefined) updateData.errorCode = body.errorCode;
    if (body.errorDetails !== undefined) updateData.errorDetails = body.errorDetails;
    if (body.retryCount !== undefined) updateData.retryCount = body.retryCount;
    if (body.ragUsed !== undefined) updateData.ragUsed = body.ragUsed;
    if (body.ragCollections !== undefined) updateData.ragCollections = body.ragCollections;
    if (body.sourceVersion !== undefined) updateData.sourceVersion = body.sourceVersion;
    if (body.engineVersion !== undefined) updateData.engineVersion = body.engineVersion;

    // ARIA_PERIODIC parent notification (P7c): resolved BEFORE the write,
    // as a pure read (see resolvePeriodicBilanNotificationIntent) — it
    // decides only WHETHER a notification is owed (parent exists, has an
    // email, and the child's ARIA tier grants `parentReporting`) and
    // builds its content, without touching the database. `null` means no
    // notification is owed at all (ineligible tier, or no real parent
    // contact) — not a failure.
    const notificationIntent: PeriodicBilanNotificationIntent | null =
      existing.type === 'ARIA_PERIODIC'
      && body.isPublished === true
      && !existing.isPublished
      && existing.studentId
        ? await resolvePeriodicBilanNotificationIntent({
            bilanId: existing.id,
            studentId: existing.studentId,
            subject: existing.subject,
          })
        : null;

    // The publish (or any other update) and the durable notification
    // intent commit atomically: either both land, or neither does. There
    // is no window in which the bilan is published but no notification
    // was durably recorded — a transient outbox failure now fails the
    // whole PUT (the caller can retry) instead of silently losing the
    // notification behind an already-committed publication.
    const updated = await prisma.$transaction(async (transaction) => {
      const row = await transaction.bilan.update({
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
      return row;
    });

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
