import { NextResponse } from 'next/server';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { captureContactLead, ContactLeadValidationError } from '@/lib/crm/contact-leads';
import { serializeError } from '@/lib/utils/serialize-error';

export async function POST(request: Request) {
  try {
    const blocked = await guardSensitiveRateLimit(request, {
      scope: 'newsletter-subscribe',
      dimensions: ['ip'],
    });
    if (blocked) return blocked;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }

    const rawEmail = payload && typeof payload === 'object' && 'email' in payload
      ? (payload as Record<string, unknown>).email
      : undefined;
    // Only a validated string email may feed the identity/quota key — otherwise
    // a non-string value (e.g. an array containing a real address) could
    // coerce into someone else's identity and consume their quota.
    const identity = typeof rawEmail === 'string' ? rawEmail : null;
    if (rawEmail !== undefined && typeof rawEmail !== 'string') {
      // A non-string `email` would otherwise reach captureContactLead's own
      // String() coercion (e.g. an object whose toString isn't callable),
      // surfacing as an uncaught 500 instead of the documented 400.
      return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
    }
    const identityBlocked = await guardSensitiveRateLimit(request, {
      scope: 'newsletter-subscribe',
      identity,
      dimensions: ['identity'],
    });
    if (identityBlocked) return identityBlocked;

    const lead = await captureContactLead({ ...(payload as object), type: 'newsletter' });
    return NextResponse.json({ ok: true, leadId: lead.id });
  } catch (error) {
    if (error instanceof ContactLeadValidationError) {
      return NextResponse.json({ ok: false, error: error.code }, { status: 400 });
    }

    console.error('[newsletter] error', serializeError(error));
    return NextResponse.json({ ok: false, error: 'newsletter_capture_failed' }, { status: 500 });
  }
}
