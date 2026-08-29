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
import { getFamilyQuoteView } from '@/lib/quotes/public-view.server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const blocked = await guardSensitiveRateLimit(request, { scope: 'quotes-public-read', dimensions: ['ip'] });
  if (blocked) return blocked;

  const { token: rawToken } = await params;
  const token = rawToken?.trim();
  if (!token || token.length > 200) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }

  const { quote } = await getFamilyQuoteView(token);
  if (!quote) {
    return NextResponse.json(
      { error: 'not_found' },
      { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  return NextResponse.json(
    { ok: true, quote },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
