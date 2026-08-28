/**
 * GET /api/aria/cockpit — payload complet du cockpit ARIA.
 *
 * ── Sécurité (§28) ───────────────────────────────────────────────────────────
 *  • ELEVE authentifié uniquement ; élève résolu par `session.user.id`.
 *  • Aucun `studentId` accepté depuis la requête.
 *
 * ── Performance (§30) ────────────────────────────────────────────────────────
 * Le payload réutilise `buildStudentDashboardPayload()` : ≈9 requêtes au total,
 * sans N+1. Le temps de construction et le nombre de requêtes sont exposés en
 * en-têtes pour instrumentation.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { isErrorResponse, requireRole } from '@/lib/guards';
import { serializeError } from '@/lib/utils/serialize-error';
import { buildAriaCockpit } from '@/lib/aria/cockpit/builder';

export async function GET() {
  const sessionOrError = await requireRole(UserRole.ELEVE);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  try {
    const startedAt = Date.now();
    const { cockpit, queryCount } = await buildAriaCockpit(sessionOrError.user.id);
    const elapsed = Date.now() - startedAt;

    return NextResponse.json(cockpit, {
      headers: {
        'Cache-Control': 'private, max-age=10',
        'X-Aria-Cockpit-Build-Ms': String(elapsed),
        'X-Aria-Cockpit-Query-Count': String(queryCount),
      },
    });
  } catch (error) {
    console.error('[aria/cockpit] GET failed', serializeError(error));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
