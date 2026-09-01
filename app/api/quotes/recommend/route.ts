/**
 * POST /api/quotes/recommend — public, no PII required (CDC §16/§23).
 *
 * Computes the three scenarios (ESSENTIEL/RECOMMANDE/COMPLET) from a
 * situation + optional diagnostic + budget. Never writes to the DB, never
 * requires the caller to be authenticated — a real diagnosticId is only
 * honored when the caller is signed in and owns it (or is staff), via the
 * same ownership rules the diagnostic feature already enforces.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, isErrorResponse } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { buildRecommendation } from '@/lib/quotes/recommendation';
import { loadRawDomainScores } from '@/lib/quotes/diagnostic.server';
import type { RawDomainScores } from '@/lib/quotes/diagnostic';
import { situationSchema, budgetSchema, eligibilityAnswersSchema } from '@/lib/quotes/http-schemas';
import { serializeError } from '@/lib/utils/serialize-error';

export const dynamic = 'force-dynamic';

const requestSchema = z
  .object({
    situation: situationSchema,
    diagnosticId: z.string().trim().min(1).max(80).optional(),
    budget: budgetSchema,
    monthsRemaining: z.number().int().min(1).max(10).optional(),
    bacAccelereEligibilityAnswers: eligibilityAnswersSchema,
  })
  .strict();

export async function POST(request: Request) {
  const blocked = await guardSensitiveRateLimit(request, { scope: 'quotes-recommend', dimensions: ['ip'] });
  if (blocked) return blocked;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload', issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  let diagnosticDomainScores: RawDomainScores | null = null;
  let overconfidentDomainKeys: Set<string> | undefined;

  if (input.diagnosticId) {
    const session = await requireAuth();
    if (!isErrorResponse(session)) {
      const loaded = await loadRawDomainScores(session, input.diagnosticId);
      // Ownership/not-found on the diagnostic must not break the whole
      // estimation — fall back to no-diagnostic rather than surfacing an
      // unrelated 403/404 from a public pricing endpoint.
      if (!isErrorResponse(loaded)) {
        diagnosticDomainScores = loaded.raw;
        overconfidentDomainKeys = loaded.overconfidentDomainKeys;
      }
    }
  }

  try {
    const result = buildRecommendation({
      situation: input.situation,
      diagnosticDomainScores,
      overconfidentDomainKeys,
      budget: input.budget,
      // ADR-MID-YEAR-BILLING-MODEL.md: this public wire field keeps its
      // established name for compatibility; the canonical engine calls it
      // pedagogicalUrgencyMonths and never lets it affect the payment
      // schedule — see the ADR and
      // __tests__/architecture/pedagogical-urgency-commercial-schedule-isolation.test.ts.
      pedagogicalUrgencyMonths: input.monthsRemaining,
      bacAccelereEligibilityAnswers: input.bacAccelereEligibilityAnswers,
    });
    return NextResponse.json({ ok: true, result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[quotes/recommend] error', serializeError(error));
    return NextResponse.json({ error: 'recommendation_failed' }, { status: 400 });
  }
}
