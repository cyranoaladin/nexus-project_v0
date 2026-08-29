import { NextRequest, NextResponse } from 'next/server';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { acceptQuoteByPublicToken } from '@/lib/quotes/persistence.server';
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

  try {
    const result = await acceptQuoteByPublicToken(token);
    if (!result.ok) {
      const status = result.reason === 'NOT_ACCEPTABLE' ? 409 : 404;
      return NextResponse.json({ error: status === 404 ? 'not_found' : 'accept_failed' }, { status });
    }
    return NextResponse.json({ ok: true, message: 'Devis accepté' });
  } catch (error) {
    console.error('[quotes/public-accept] error', serializeError(error));
    return NextResponse.json({ error: 'accept_failed' }, { status: 409 });
  }
}
