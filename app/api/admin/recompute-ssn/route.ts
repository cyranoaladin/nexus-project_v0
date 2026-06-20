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
import { auth } from '@/auth';
import { recomputeSSNBatch } from '@/lib/core/ssn/computeSSN';
import { computeCohortStatsWithAudit } from '@/lib/core/statistics/cohort';

const VALID_TYPES = ['MATHS', 'NSI', 'GENERAL'];

export async function POST(request: NextRequest) {
  try {
    // RBAC Guard: ADMIN only
    const session = await auth();
    const userRole = (session?.user as { role?: string })?.role;

    if (!session || userRole !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Accès non autorisé. Rôle ADMIN requis.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { type } = body;

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Type invalide. Valeurs acceptées : ${VALID_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

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
