/**
 * POST /api/quotes/margin — staff-only (CDC §10/§28).
 *
 * Recomputes the recommendation server-side (never trusts client-submitted
 * lines for a money figure, same discipline as /api/quotes) and returns the
 * contributive margin per scenario. This response shape is structurally
 * separate from RecommendationResult/QuoteScenario — the public endpoints
 * can never accidentally start returning this.
 */
import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { isErrorResponse, requireAnyRole } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { buildRecommendation } from '@/lib/quotes/recommendation';
import { getCommercialCostPolicy, computeMargin } from '@/lib/quotes/margin.server';
import { situationSchema, budgetSchema } from '@/lib/quotes/http-schemas';
import { serializeError } from '@/lib/utils/serialize-error';

export const dynamic = 'force-dynamic';

const requestSchema = z
  .object({
    situation: situationSchema,
    budget: budgetSchema,
  })
  .strict();

export async function POST(request: Request) {
  const session = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(session)) return session;

  const blocked = await guardSensitiveRateLimit(request, {
    scope: 'quotes-send', // margin review shares the "expensive staff action" tier
    identity: session.user.id,
  });
  if (blocked) return blocked;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  try {
    const recommendation = buildRecommendation({
      situation: parsed.data.situation,
      diagnosticDomainScores: null,
      budget: parsed.data.budget,
    });
    const policy = await getCommercialCostPolicy();

    const marginByTier = Object.fromEntries(
      recommendation.scenarios.map((scenario) => [scenario.tier, computeMargin(scenario.lines, policy)]),
    );

    return NextResponse.json({ ok: true, marginByTier }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[quotes/margin] error', serializeError(error));
    return NextResponse.json({ error: 'margin_computation_failed' }, { status: 400 });
  }
}
