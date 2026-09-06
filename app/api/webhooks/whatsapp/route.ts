import { readBoundedRequestBody, RequestBodyTooLargeError } from '@/lib/http/bounded-request-body';
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { applyWhatsAppStatusEvents, verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
const MAX_BYTES = 256 * 1024;

export async function GET(request: Request) {
  const token = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!token || token.length < 16) return NextResponse.json({ error: 'Service indisponible' }, { status: 503, headers });
  const params = new URL(request.url).searchParams;
  const supplied = Buffer.from(params.get('hub.verify_token') ?? '');
  const expected = Buffer.from(token);
  const challenge = params.get('hub.challenge');
  if (params.get('hub.mode') !== 'subscribe' || !challenge || challenge.length > 200
    || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403, headers });
  }
  return new Response(challenge, { headers: { ...headers, 'Content-Type': 'text/plain' } });
}

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_META_APP_SECRET?.trim();
  const sender = process.env.WHATSAPP_META_PHONE_NUMBER_ID?.trim();
  if (!secret || secret.length < 32 || !sender || !/^\d+$/.test(sender)) {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 503, headers });
  }
  let raw: string;
  try { raw = await readBoundedRequestBody(request, MAX_BYTES); }
  catch (error) {
    return NextResponse.json({ error: error instanceof RequestBodyTooLargeError ? 'Requête trop volumineuse' : 'Requête invalide' }, { status: error instanceof RequestBodyTooLargeError ? 413 : 400, headers });
  }
  if (!verifyMetaWebhookSignature(raw, request.headers.get('x-hub-signature-256'), secret)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401, headers });
  }
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Requête invalide' }, { status: 400, headers }); }
  try {
    const updated = await applyWhatsAppStatusEvents(payload, sender);
    return NextResponse.json({ received: true, updated }, { headers });
  } catch {
    // Meta retries 5xx. Never log raw payload, destination, token, or provider errors.
    return NextResponse.json({ error: 'Traitement indisponible' }, { status: 503, headers });
  }
}
