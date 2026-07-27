export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { checkCsrf, checkBodySize } from '@/lib/csrf';
import { serializeError } from '@/lib/utils/serialize-error';
import {
  captureBilanGratuitLead,
  isBilanLeadValidationError,
} from '@/lib/crm/bilan-leads';

export async function POST(request: NextRequest) {
  try {
    const csrfResponse = checkCsrf(request);
    if (csrfResponse) return csrfResponse;

    const bodySizeResponse = checkBodySize(request);
    if (bodySizeResponse) return bodySizeResponse;

    const blocked = await guardRateLimitAsync(request, { preset: 'api', keySuffix: 'bilan-gratuit' });
    if (blocked) return blocked;

    const body = await request.json();

    // Honeypot — bots fill hidden fields; humans don't
    if (body.website || body.url || body.honeypot) {
      return NextResponse.json({ success: true, message: 'Inscription réussie !' });
    }

    const lead = await captureBilanGratuitLead(body);

    return NextResponse.json({
      success: true,
      message: 'Votre demande de bilan a bien été enregistrée. Notre équipe vous recontacte sous 24h.',
      leadId: lead.id,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Erreur inscription bilan gratuit:', serializeError(error));
    }

    if (isBilanLeadValidationError(error)) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Données invalides', details: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
