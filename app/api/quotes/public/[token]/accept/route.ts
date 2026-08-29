import { NextRequest, NextResponse } from 'next/server';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { getQuoteForFamilyView } from '@/lib/quotes/public-view.server';
import { transitionQuoteStatus } from '@/lib/quotes/persistence.server';
import { serializeError } from '@/lib/utils/serialize-error';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const blocked = await guardSensitiveRateLimit(request, { scope: 'quotes-accept', dimensions: ['ip'] });
  if (blocked) return blocked;

  const { token: rawToken } = await params;
  const token = rawToken?.trim();
  if (!token || token.length > 200) {
    return NextResponse.json({ error: 'invalid_link' }, { status: 400 });
  }

  const { quote } = await getQuoteForFamilyView(token);
  if (!quote) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    await transitionQuoteStatus({ quoteId: quote.id, toStatus: 'ACCEPTE' });
    return NextResponse.json({ ok: true, message: 'Devis accepté' });
  } catch (error) {
    console.error('[quotes/public-accept] error', serializeError(error));
    return NextResponse.json({ error: 'accept_failed' }, { status: 409 });
  }
}
