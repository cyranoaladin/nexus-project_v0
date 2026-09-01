/**
 * GET /api/quotes/public/[token]/pdf — candidat-individuel family-facing PDF
 * download (mission "vers un produit complet" §4/§6). Reuses the exact
 * same read path as the HTML page (getQuoteForFamilyView) so the PDF and
 * the on-screen quote always reflect the same revision and the same gate:
 * a candidat-individuel quote that isn't CARTE_VALIDATED_DEFINITIVE yet, or
 * whose Responsable/Élève has been detached or diverges from its
 * ProfilCandidat (FAMILY_VISIBILITY_INVARIANTS, lib/quotes/family-
 * visibility.ts), already returns "not found" from that function — this
 * route inherits that block automatically, it does not re-implement it.
 *
 * Legacy quotes (profilId null) have no PDF on this surface today (the
 * legacy family page never had a download link either, per the existing
 * app/devis/[token]/page.tsx) — this route 404s for them, matching the
 * page's own scope.
 *
 * P0-B closeout: FAMILY_VISIBILITY_INVARIANTS already guarantees
 * contactLeadId/studentId are non-null and coherent for any quote reaching
 * this point — the identity rows are looked up here only to render their
 * actual name/email/phone (the PDF's content), never as a second existence
 * check. If a lookup ever comes back empty despite that guarantee, this
 * route fails closed (404) rather than silently printing a placeholder.
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { getQuoteForFamilyView } from '@/lib/quotes/public-view.server';
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const blocked = await guardSensitiveRateLimit(request, { scope: 'quotes-public-read', dimensions: ['ip'] });
  if (blocked) return blocked;

  const { token: rawToken } = await params;
  const token = rawToken?.trim();
  if (!token || token.length > 200) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }

  const { quote } = await getQuoteForFamilyView(token);
  if (!quote || quote.profilId == null) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  }

  const [contactLead, student] = await Promise.all([
    prisma.contactLead.findUnique({ where: { id: quote.contactLeadId! }, select: { name: true, email: true, phone: true } }),
    prisma.student.findUnique({ where: { id: quote.studentId! }, include: { user: { select: { firstName: true, lastName: true } } } }),
  ]);

  if (!contactLead || !student) {
    // FAMILY_VISIBILITY_INVARIANTS already guarantees both rows exist —
    // this should be unreachable. Fail closed rather than print a
    // placeholder if that guarantee is ever violated.
    console.error('[quotes/public/pdf] identity missing despite passing FAMILY_VISIBILITY_INVARIANTS', { quoteId: quote.id });
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  }

  const studentName = [student.user?.firstName, student.user?.lastName].filter(Boolean).join(' ') || 'Non renseigné';

  const pdfData = buildQuotePdfDataFromPersistedQuote({
    quote,
    parentName: contactLead.name,
    parentEmail: contactLead.email,
    parentPhone: contactLead.phone ?? 'Non renseigné',
    studentName,
    advisorName: 'Nexus Réussite',
  });

  const pdfBuffer = await renderQuotePDF(pdfData);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Devis-Nexus-${sanitizeFilenamePart(studentName)}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}
