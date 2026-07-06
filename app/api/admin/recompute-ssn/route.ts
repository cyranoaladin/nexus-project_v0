/**
 * POST /api/admin/recompute-ssn
 *
 * Batch recompute SSN for all assessments of a given type.
 * Protected: ADMIN role only.
 *
 * Body: { type: "MATHS" | "NSI" | "GENERAL" }
 * Returns: { updated, cohort, auditLog }
 */

import { NextRequest, NextResponse } from 'next/server';
import { recomputeSSNBatch } from '@/lib/core/ssn/computeSSN';
import { computeCohortStatsWithAudit } from '@/lib/core/statistics/cohort';
import { isErrorResponse, requireRole } from '@/lib/guards';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

const VALID_TYPES = ['MATHS', 'NSI', 'GENERAL'] as const;
const recomputeSsnSchema = z.object({
  type: z.enum(VALID_TYPES),
}).strict();

export async function POST(request: NextRequest) {
  try {
    // RBAC Guard: ADMIN only
    const sessionOrError = await requireRole(UserRole.ADMIN);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const rateLimited = await guardRateLimitAsync(request, {
      preset: 'api',
      keySuffix: 'admin-recompute-ssn',
    });
    if (rateLimited) return rateLimited;

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: `Type invalide. Valeurs acceptées : ${VALID_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const parsedBody = recomputeSsnSchema.safeParse(json);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Type invalide. Valeurs acceptées : ${VALID_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }
    const { type } = parsedBody.data;

    // Compute audit log (before/after stats)
    const auditEntry = await computeCohortStatsWithAudit(type);

    // Batch recompute
    const result = await recomputeSSNBatch(type);

    return NextResponse.json({
      success: true,
      type,
      updated: result.updated,
      cohort: result.cohort,
      audit: {
        previousMean: auditEntry.previousStats?.mean ?? null,
        previousStd: auditEntry.previousStats?.std ?? null,
        currentMean: auditEntry.stats.mean,
        currentStd: auditEntry.stats.std,
        delta: auditEntry.delta ?? null,
      },
    });
  } catch (error) {
    console.error('[recompute-ssn] Error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
