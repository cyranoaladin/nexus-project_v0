import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { drainWhatsAppInvitations } from '@/lib/whatsapp/invitation-worker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };

/** Protected scheduler target. Deployers schedule POSTs with a dedicated bearer secret.
 * It intentionally does not accept arbitrary recipient, template, or provider arguments.
 */
export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_WORKER_SECRET?.trim();
  if (!secret || secret.length < 32) return NextResponse.json({ error: 'Service indisponible' }, { status: 503, headers });
  const supplied = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401, headers });
  }
  try {
    return NextResponse.json(await drainWhatsAppInvitations(), { headers });
  } catch {
    return NextResponse.json({ error: 'Traitement indisponible' }, { status: 503, headers });
  }
}
