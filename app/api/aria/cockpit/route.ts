/**
 * GET /api/aria/cockpit — payload complet du cockpit ARIA.
 *
 * ── Sécurité (§28) ───────────────────────────────────────────────────────────
 *  • ELEVE authentifié uniquement ; élève résolu par `session.user.id`.
 *  • Aucun `studentId` accepté depuis la requête.
 *
 * ── Performance (§30) ────────────────────────────────────────────────────────
 * Le payload réutilise `buildStudentDashboardPayload()` et n'ajoute qu'une
 * seule lecture (le profil ARIA). Mesuré sur base réelle : 22 SELECT sur 18
 * tables par requête, chacune touchée 1 à 3 fois — aucun N+1. Le temps de
 * construction et le nombre d'opérations Prisma sont exposés en en-têtes.
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
    const { cockpit, prismaOperationCount } = await buildAriaCockpit(sessionOrError.user.id);
    const elapsed = Date.now() - startedAt;

    return NextResponse.json(cockpit, {
      headers: {
        'Cache-Control': 'private, max-age=10',
        'X-Aria-Cockpit-Build-Ms': String(elapsed),
        'X-Aria-Cockpit-Prisma-Ops': String(prismaOperationCount),
      },
    });
  } catch (error) {
    console.error('[aria/cockpit] GET failed', serializeError(error));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
