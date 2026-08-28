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
import { getQuoteForFamilyView } from '@/lib/quotes/public-view.server';
import { commercialWarningsFromLines } from '@/lib/quotes/pdf-adapter.server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const blocked = await guardSensitiveRateLimit(request, { scope: 'quotes-public-read', dimensions: ['ip'] });
  if (blocked) return blocked;

  const { token: rawToken } = await params;
  const token = rawToken?.trim();
  if (!token || token.length > 200) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }

  const { quote } = await getQuoteForFamilyView(token);
  if (!quote) {
    return NextResponse.json(
      { error: 'not_found' },
      { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  // Public projection: only family-facing fields. No pricingVersion/
  // examPolicyVersion/diagnosticChecksum/createdByUserId/idempotencyKey —
  // those are internal snapshot bookkeeping, not something a family needs.
  // T5R5 §FINDING_12 (FAMILY_VIEW_INTERNAL_REASONING = FORBIDDEN): the
  // per-line `reason` is staff-only pricing-engine reasoning (priority
  // coefficients, group thresholds, bascule logic) — never exposed here.
  // Only the safe, pre-vetted commercial warnings extracted by
  // commercialWarningsFromLines (the same function the PDF uses) surface.
  const studentUser = quote.student?.user;
  const studentName = studentUser ? [studentUser.firstName, studentUser.lastName].filter(Boolean).join(' ') || null : null;

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
        // Nullable: devis émis avant D4 (modèle 0% d'acompte) n'ont pas ces
        // valeurs — jamais reconstituées, affichées comme état historique.
        deposit: quote.deposit,
        lastInstallmentAmount: quote.lastInstallmentAmount,
        validUntil: quote.validUntil,
        studentName,
        warnings: commercialWarningsFromLines(quote.lines),
        lines: quote.lines
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((line) => ({
            subject: line.subject,
            modality: line.modality,
            hoursPerMonth: line.hoursPerMonth,
            unitPrice: line.unitPrice,
            months: line.months,
            lineTotal: line.lineTotal,
          })),
      },
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
