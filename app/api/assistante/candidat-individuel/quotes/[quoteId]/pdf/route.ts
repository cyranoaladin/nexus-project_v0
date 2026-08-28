/**
 * GET /api/assistante/candidat-individuel/quotes/:quoteId/pdf — closes the
 * PDF integration gap for the candidat-individuel pipeline (mission "vers
 * un produit complet" §4). Reuses the existing PDF engine (lib/quote/pdf.ts
 * ::renderQuotePDF) and Quote model unchanged — no second PDF engine, no
 * second quote model. Builds strictly from the persisted revision
 * (Quote + lines + snapshotCarte), never from a recomputation against
 * current catalogue/pricing.
 *
 * Scoped to quote.profilId != null (candidat-individuel-sourced rows) —
 * the legacy engine keeps its own established client-driven PDF flow
 * (POST /api/assistante/quotes/pdf) untouched.
 *
 * The "brouillon interne / définitif" distinction is server-enforced by
 * lib/quotes/pdf-adapter.server.ts, which reads collectQuoteEmissionBlockers
 * (the same single canonical gate already used for send/accept) — this
 * route never trusts a client flag for that decision.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isErrorResponse, type AuthSession } from '@/lib/guards';
import { requireInternalPipelineAccess } from '@/lib/quotes/candidat-individuel-guard.server';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { prisma } from '@/lib/prisma';
import { renderQuotePDF } from '@/lib/quote/pdf';
import { buildQuotePdfDataFromPersistedQuote } from '@/lib/quotes/pdf-adapter.server';

export const dynamic = 'force-dynamic';

function sanitizeFilenamePart(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'candidat';
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ quoteId: string }> }) {
  const access = await requireInternalPipelineAccess();
  if (isErrorResponse(access)) return access;
  const session = access as AuthSession;

  const blocked = await guardSensitiveRateLimit(request, { scope: 'quotes-pdf', identity: session.user.id });
  if (blocked) return blocked;

  const { quoteId } = await params;

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      lines: true,
      contactLead: { select: { name: true, email: true, phone: true } },
      student: { include: { user: { select: { firstName: true, lastName: true } } } },
      profil: { select: { level: true, specialite1: true, specialite2: true } },
    },
  });

  if (!quote || quote.profilId == null) {
    // Same 404 whether the id is unknown or belongs to a legacy quote
    // (profilId null) — this route is not a general-purpose PDF endpoint
    // for every Quote, only for the candidat-individuel pipeline's own
    // rows. Legacy quotes keep using their existing PDF flow.
    return NextResponse.json({ error: 'Devis candidat individuel introuvable' }, { status: 404 });
  }

  const studentUser = quote.student?.user;
  const studentName = studentUser
    ? [studentUser.firstName, studentUser.lastName].filter(Boolean).join(' ') || 'Non renseigné'
    : 'Non renseigné';
  const advisorName = [session.user.firstName, session.user.lastName].filter(Boolean).join(' ') || session.user.email || 'Nexus Réussite';

  const pdfData = buildQuotePdfDataFromPersistedQuote({
    quote,
    profil: quote.profil,
    parentName: quote.contactLead?.name ?? 'Non renseigné',
    parentEmail: quote.contactLead?.email ?? 'Non renseigné',
    parentPhone: quote.contactLead?.phone ?? 'Non renseigné',
    studentName,
    advisorName,
  });

  const pdfBuffer = await renderQuotePDF(pdfData);
  const student = sanitizeFilenamePart(studentName);
  const quoteNumber = sanitizeFilenamePart(quote.id);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Devis-Nexus-${student}-${quoteNumber}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}
