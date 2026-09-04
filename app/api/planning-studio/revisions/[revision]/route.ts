/**
 * GET /api/planning-studio/revisions/:revision — contenu d'une révision (ADMIN).
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { apiGuard } from '@/lib/api-guard';
import { isErrorResponse } from '@/lib/guards';
import { planningErrorResponse, planningService } from '../../_shared';

export async function GET(_request: NextRequest, context: { params: Promise<{ revision: string }> }) {
  const guard = await apiGuard({ policy: 'planning-studio.history' });
  if (isErrorResponse(guard)) return guard;
  const { revision: raw } = await context.params;
  const revision = Number(raw);
  if (!Number.isInteger(revision) || revision < 1) {
    return NextResponse.json({ error: 'PLANNING_BAD_REQUEST', message: 'Numéro de révision invalide.' }, { status: 400 });
  }
  try {
    const row = await planningService.getRevision(revision);
    return NextResponse.json(
      { revision: row.revision, action: row.action, summary: row.summary, createdAt: row.createdAt, payloadHash: row.payloadHash, payload: row.payload },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return planningErrorResponse(err);
  }
}
