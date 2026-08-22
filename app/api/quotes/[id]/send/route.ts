/**
 * POST /api/quotes/[id]/send — staff-only, transitions ESTIMATION/
 * BILAN_A_FAIRE/BILAN_TERMINE -> DEVIS_ENVOYE (CDC §25/§28).
 */
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { isErrorResponse, requireAnyRole } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { transitionQuoteStatus } from '@/lib/quotes/persistence.server';
import { serializeError } from '@/lib/utils/serialize-error';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ note: z.string().trim().max(500).optional() }).strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(session)) return session;

  const blocked = await guardSensitiveRateLimit(request, {
    scope: 'quotes-send',
    identity: session.user.id,
  });
  if (blocked) return blocked;

  let payload: unknown = {};
  const rawBody = await request.text();
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  try {
    const quote = await transitionQuoteStatus({
      quoteId: id,
      toStatus: 'DEVIS_ENVOYE',
      actorUserId: session.user.id,
      note: parsed.data.note,
    });
    return NextResponse.json({ ok: true, status: quote.status, sentAt: quote.sentAt });
  } catch (error) {
    console.error('[quotes/send] error', serializeError(error));
    const message = error instanceof Error ? error.message : 'send_failed';
    const isNotFound = typeof error === 'object' && error != null && (error as { code?: string }).code === 'P2025';
    const status = isNotFound ? 404 : message.includes('Invalid quote status transition') ? 409 : 500;
    return NextResponse.json({ error: isNotFound ? 'not_found' : 'send_failed', message }, { status });
  }
}
