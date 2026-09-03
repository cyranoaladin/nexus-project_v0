/**
 * GET /api/assistante/candidate-profiles/[id]/quotes/[quoteId]/pdf —
 * renders a candidat-individuel Quote's PDF (Track A, Section 2).
 * Staff-only. Uses the ONE existing PDF renderer (lib/quote/pdf.ts's
 * renderQuotePDF) via the persisted-Quote adapter — no new renderer.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { getQuoteById } from '@/lib/quotes/persistence.server';
import { getProfilCandidatById } from '@/lib/quotes/candidate-profile-persistence.server';
import { buildQuotePdfDataFromPersistedQuote } from '@/lib/quotes/pdf-adapter.server';
import { renderQuotePDF } from '@/lib/quote/pdf';

export const dynamic = 'force-dynamic';

const LEVEL_LABELS: Record<string, string> = { PREMIERE: 'Première', TERMINALE: 'Terminale' };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; quoteId: string }> },
) {
  const sessionOrError = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  const blocked = await guardSensitiveRateLimit(request, {
    scope: 'candidate-profile-read',
    identity: sessionOrError.user.id,
  });
  if (blocked) return blocked;

  const { id, quoteId } = await params;
  const quote = await getQuoteById(quoteId);
  // Never leak whether the mismatch is "quote not found" vs "quote belongs
  // to a different profile" — both are a routine 404 to the caller.
  if (!quote || quote.profilId !== id) {
    return NextResponse.json({ error: 'candidate_quote_not_found' }, { status: 404 });
  }

  const studentLabel = quote.student ? `${quote.student.user.firstName} ${quote.student.user.lastName}` : undefined;
  const profil = quote.profilId ? await getProfilCandidatById(quote.profilId) : null;

  const data = buildQuotePdfDataFromPersistedQuote(quote, quote.lines, {
    leadName: quote.contactLead?.name ?? 'Non renseigné',
    leadEmail: quote.contactLead?.email ?? '',
    leadPhone: quote.contactLead?.phone ?? '',
    advisorName: 'Nexus Réussite',
    levelLabel: profil ? LEVEL_LABELS[profil.level] : 'Candidat individuel',
    specialiteLabels: quote.lines.map((l) => l.subject),
    studentLabel,
  });

  const pdfBuffer = await renderQuotePDF(data);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Devis-Nexus-Candidat-Individuel-${quoteId}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}
