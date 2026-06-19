import { NextResponse } from 'next/server';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { captureContactLead, ContactLeadValidationError } from '@/lib/crm/contact-leads';

export async function POST(request: Request) {
  try {
    const blocked = await guardRateLimitAsync(request, { preset: 'api', keySuffix: 'newsletter' });
    if (blocked) return blocked;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }

    const lead = await captureContactLead({ ...(payload as object), type: 'newsletter' });
    return NextResponse.json({ ok: true, leadId: lead.id });
  } catch (error) {
    if (error instanceof ContactLeadValidationError) {
      return NextResponse.json({ ok: false, error: error.code }, { status: 400 });
    }

    console.error('[newsletter] error', error);
    return NextResponse.json({ ok: false, error: 'newsletter_capture_failed' }, { status: 500 });
  }
}
