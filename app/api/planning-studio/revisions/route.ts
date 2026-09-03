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
  const limitRaw = Number(request.nextUrl.searchParams.get('limit') ?? '50');
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
  try {
    const revisions = await planningService.listRevisions(limit);
    return NextResponse.json({ revisions }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return planningErrorResponse(err);
  }
}
