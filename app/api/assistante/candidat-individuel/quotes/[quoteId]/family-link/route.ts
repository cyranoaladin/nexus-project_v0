/**
 * POST /api/assistante/candidat-individuel/quotes/:quoteId/family-link —
 * T5R2, RECETTE_FINDING (FAMILY_LINK_DISTRIBUTION, P1). The single staff
 * action that issues (first call) or rotates (subsequent calls) a
 * published candidat-individuel Quote's family link — "Générer le lien
 * famille" / "Renouveler le lien famille" in the staff UI.
 *
 * AUTHENTICATED + AUTHORIZED (requireInternalPipelineAccess, same guard
 * as every sibling route). SERVER_VALIDATED: collectFamilyLinkIssuanceBlockers
 * (lib/quotes/emission-guard.ts) re-verifies the Quote is genuinely
 * published and commercially valid — never trusts a client-side flag.
 * A rotation invalidates the previous link (publicTokenHash is a single
 * @unique column — overwriting it is the revocation).
 *
 * Reuses the existing token engine (generateQuotePublicToken) and the
 * existing family view (app/devis/[token]/page.tsx) — no second token
 * scheme, no second frontend. The raw token appears ONLY inside
 * `familyUrl` in this response — never as a separate field, never
 * logged, never persisted.
 *
 * Scoped to quote.profilId != null (candidat-individuel-sourced rows) —
 * same scoping as the PDF and publish routes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isErrorResponse, type AuthSession } from '@/lib/guards';
import { requireInternalPipelineAccess } from '@/lib/quotes/candidat-individuel-guard.server';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { prisma } from '@/lib/prisma';
import { issueOrRotateFamilyLink } from '@/lib/quotes/persistence.server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ quoteId: string }> }) {
  const access = await requireInternalPipelineAccess();
  if (isErrorResponse(access)) return access;
  const session = access as AuthSession;

  const blocked = await guardSensitiveRateLimit(request, { scope: 'candidat-individuel-staff', identity: session.user.id });
  if (blocked) return blocked;

  const { quoteId } = await params;

  const existing = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { profilId: true, updatedAt: true, publicTokenHash: true },
  });
  if (!existing || existing.profilId == null) {
    return NextResponse.json({ error: 'Devis candidat individuel introuvable' }, { status: 404 });
  }

  let result;
  try {
    result = await issueOrRotateFamilyLink(quoteId, session.user.id, {
      updatedAt: existing.updatedAt,
      publicTokenHash: existing.publicTokenHash,
    });
  } catch (error) {
    // getTrustedApplicationOrigin fails closed on a missing/invalid
    // NEXTAUTH_URL — never a fabricated URL.
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Configuration serveur invalide — lien famille non généré', message }, { status: 500 });
  }

  if (!result.ok && 'conflict' in result) {
    return NextResponse.json(
      { error: 'Le devis a changé. Actualisez avant de renouveler le lien famille.' },
      { status: 409 },
    );
  }

  if (!result.ok) {
    return NextResponse.json({ error: 'Lien famille non émis', reasons: result.reasons }, { status: 422 });
  }

  return NextResponse.json({ familyUrl: result.familyUrl, expiresAt: result.expiresAt, action: result.action }, { status: 200 });
}
