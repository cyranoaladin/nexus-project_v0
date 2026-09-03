/**
 * POST /api/planning-studio/restore — restaure une révision antérieure (ADMIN).
 * La restauration crée une NOUVELLE révision ; l'historique n'est jamais
 * tronqué. Verrou optimiste : expectedRevision doit être la révision courante.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';
import { isErrorResponse } from '@/lib/guards';
import { planningErrorResponse, planningService } from '../_shared';

const schema = z.object({
  revision: z.number().int().min(1),
  expectedRevision: z.number().int().min(0),
});

export async function POST(request: NextRequest) {
  const guard = await apiGuard({ policy: 'planning-studio.restore' });
  if (isErrorResponse(guard)) return guard;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'PLANNING_BAD_REQUEST', message: 'Corps JSON invalide.' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'PLANNING_BAD_REQUEST', message: 'Requête invalide.', issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const result = await planningService.restoreRevision({
      revision: parsed.data.revision,
      expectedRevision: parsed.data.expectedRevision,
      actorId: guard.user.id,
    });
    return NextResponse.json(result);
  } catch (err) {
    return planningErrorResponse(err);
  }
}
