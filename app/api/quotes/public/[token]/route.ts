/**
 * GET /api/quotes/public/[token] — the family-facing quote link (CDC §26).
 *
 * Returns ONLY data meant for the family: no teacher cost, no margin, no
 * internal notes, no raw Prisma ids beyond the quote's own. Auto-advances
 * DEVIS_ENVOYE -> DEVIS_CONSULTE on first view (best-effort; a failed
 * transition here must never break the read).
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { getQuoteByPublicToken, transitionQuoteStatus } from '@/lib/quotes/persistence.server';
import { canTransition } from '@/lib/quotes/status';
import { serializeError } from '@/lib/utils/serialize-error';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const blocked = await guardSensitiveRateLimit(request, { scope: 'quotes-public-read', dimensions: ['ip'] });
  if (blocked) return blocked;

  const { token: rawToken } = await params;
  const token = rawToken?.trim();
  if (!token || token.length > 200) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }

  const { quote } = await getQuoteByPublicToken(token);
  if (!quote) {
    return NextResponse.json(
      { error: 'not_found' },
      { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  if (canTransition(quote.status, 'DEVIS_CONSULTE')) {
    try {
      await transitionQuoteStatus({ quoteId: quote.id, toStatus: 'DEVIS_CONSULTE' });
    } catch (error) {
      console.error('[quotes/public] auto-consult transition failed', serializeError(error));
    }
  }

  // Public projection: only family-facing fields. No pricingVersion/
  // examPolicyVersion/diagnosticChecksum/createdByUserId/idempotencyKey —
  // those are internal snapshot bookkeeping, not something a family needs.
  return NextResponse.json(
    {
      ok: true,
      quote: {
        status: quote.status,
        examSession: quote.examSession,
        budget: quote.budget,
        strategy: quote.strategy,
        matchedOfferId: quote.matchedOfferId,
        currency: quote.currency,
        monthlyTotal: quote.monthlyTotal,
        grandTotal: quote.grandTotal,
        validUntil: quote.validUntil,
        revisionNumber: quote.revisionNumber,
        lines: quote.lines
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((line) => ({
            subject: line.subject,
            modality: line.modality,
            hoursPerMonth: line.hoursPerMonth,
            unitPrice: line.unitPrice,
            months: line.months,
            lineTotal: line.lineTotal,
            reason: line.reason,
          })),
      },
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
