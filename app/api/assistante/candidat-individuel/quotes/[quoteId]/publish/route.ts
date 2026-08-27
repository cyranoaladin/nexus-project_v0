/**
 * POST /api/assistante/candidat-individuel/quotes/:quoteId/publish — T5R,
 * RECETTE_FINDING_3. The single, explicit staff action that makes a
 * candidat-individuel Quote visible to the family via its signed link
 * ("Valider et rendre disponible à la famille"). Before this route, no
 * real staff action existed to do this — the ONLY way any test (T3A,
 * T5A) ever produced a family-visible quote was a direct Prisma write,
 * which is forbidden in production (mission: "aucun DB patch manuel").
 *
 * Reuses the existing regulatoryMaturity state machine (Quote model,
 * lib/quotes/emission-guard.ts) — no second "published" status
 * introduced. Server-side re-validates everything authoritatively via
 * lib/quotes/persistence.server.ts::promoteQuoteToFamilyVisible /
 * collectQuotePromotionBlockers — never trusts a client-side "ready"
 * flag. AUTHENTICATED + AUTHORIZED (requireInternalPipelineAccess, same
 * guard as every other route under this path) + SERVER_VALIDATED +
 * IDEMPOTENT (a repeat call on an already-promoted quote succeeds
 * without re-validating or double-auditing) + AUDITABLE (QuoteAuditLog).
 *
 * Scoped to quote.profilId != null (candidat-individuel-sourced rows) —
 * same scoping as the PDF route; the legacy engine's own quotes are out
 * of scope for this action.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isErrorResponse, type AuthSession } from '@/lib/guards';
import { requireInternalPipelineAccess } from '@/lib/quotes/candidat-individuel-guard.server';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { prisma } from '@/lib/prisma';
import { promoteQuoteToFamilyVisible } from '@/lib/quotes/persistence.server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ quoteId: string }> }) {
  const access = await requireInternalPipelineAccess();
  if (isErrorResponse(access)) return access;
  const session = access as AuthSession;

  const blocked = await guardSensitiveRateLimit(request, { scope: 'candidat-individuel-staff', identity: session.user.id });
  if (blocked) return blocked;

  const { quoteId } = await params;

  const existing = await prisma.quote.findUnique({ where: { id: quoteId }, select: { profilId: true } });
  if (!existing || existing.profilId == null) {
    // Same 404 whether unknown or a legacy (profilId null) quote — this
    // action only ever applies to the candidat-individuel pipeline's own
    // rows, same scoping as the PDF route.
    return NextResponse.json({ error: 'Devis candidat individuel introuvable' }, { status: 404 });
  }

  const result = await promoteQuoteToFamilyVisible(quoteId, session.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: 'Devis non éligible à la publication famille', reasons: result.reasons }, { status: 422 });
  }

  const q = result.quote;
  return NextResponse.json(
    {
      quote: { id: q.id, status: q.status, regulatoryMaturity: q.regulatoryMaturity, profilId: q.profilId },
      alreadyPromoted: result.alreadyPromoted,
    },
    { status: 200 },
  );
}
