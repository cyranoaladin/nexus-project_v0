/**
 * POST /api/quotes/[id]/accept — the family accepts their devis, using the
 * same public token as the read link (no staff auth required, but the
 * token must match the quote id being accepted — CDC §25/§26).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { transitionQuoteStatus } from '@/lib/quotes/persistence.server';
import { getQuoteForFamilyView } from '@/lib/quotes/public-view.server';
import { serializeError } from '@/lib/utils/serialize-error';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ token: z.string().trim().min(1).max(200) }).strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const blocked = await guardSensitiveRateLimit(request, { scope: 'quotes-accept', dimensions: ['ip'] });
  if (blocked) return blocked;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  // FAMILY_VISIBILITY_INVARIANTS (lib/quotes/public-view.server.ts) — the
  // same gate the family read path uses, so an accept can never succeed on
  // a quote whose Responsable/Élève has been detached or that isn't
  // family-visible for any other reason (mission P0-B: family read and
  // acceptance must never diverge).
  const { quote } = await getQuoteForFamilyView(parsed.data.token);
  if (!quote || quote.id !== id) {
    // Deliberately the same response whether the token is wrong or just
    // doesn't match this quote id — never confirm which part failed.
    return NextResponse.json({ error: 'invalid_token' }, { status: 404 });
  }

  try {
    const updated = await transitionQuoteStatus({ quoteId: quote.id, toStatus: 'ACCEPTE' });
    return NextResponse.json({ ok: true, status: updated.status });
  } catch (error) {
    console.error('[quotes/accept] error', serializeError(error));
    // QuoteNotEmittableError (Lot 5 correctif §1) falls through this same
    // generic response deliberately — internal reasons are logged above,
    // never returned to a public, unauthenticated caller.
    return NextResponse.json({ error: 'accept_failed' }, { status: 409 });
  }
}
