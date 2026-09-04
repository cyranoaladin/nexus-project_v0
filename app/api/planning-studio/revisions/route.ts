/**
 * GET /api/planning-studio/revisions — historique des révisions (ADMIN).
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { apiGuard } from '@/lib/api-guard';
import { isErrorResponse } from '@/lib/guards';
import { planningErrorResponse, planningService } from '../_shared';

export async function GET(request: NextRequest) {
  const guard = await apiGuard({ policy: 'planning-studio.history' });
  if (isErrorResponse(guard)) return guard;
  const limitParam = request.nextUrl.searchParams.get('limit');
  let limit = 50;
  if (limitParam !== null) {
    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return NextResponse.json(
        { error: 'PLANNING_BAD_REQUEST', message: 'Le paramètre limit doit être un entier strictement positif.' },
        { status: 400 },
      );
    }
    limit = parsed;
  }
  try {
    const revisions = await planningService.listRevisions(limit);
    return NextResponse.json({ revisions }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return planningErrorResponse(err);
  }
}
