import { NextResponse } from 'next/server';

import {
  captureManuelOrder,
  ManuelOrderValidationError,
} from '@/lib/manuels/order';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { serializeError } from '@/lib/utils/serialize-error';

export async function POST(request: Request) {
  try {
    const blocked = await guardSensitiveRateLimit(request, {
      scope: 'manuels-order',
      dimensions: ['ip'],
    });
    if (blocked) return blocked;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }

    // Seule une adresse déjà validée comme chaîne peut servir de clé de quota :
    // une valeur d'un autre type empoisonnerait le compteur d'une vraie adresse.
    const contact =
      payload && typeof payload === 'object' && 'contact' in payload
        ? (payload as Record<string, unknown>).contact
        : undefined;
    const rawEmail =
      contact && typeof contact === 'object' && 'email' in contact
        ? (contact as Record<string, unknown>).email
        : undefined;
    if (rawEmail !== undefined && typeof rawEmail !== 'string') {
      return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
    }
    const identityBlocked = await guardSensitiveRateLimit(request, {
      scope: 'manuels-order',
      identity: typeof rawEmail === 'string' ? rawEmail : null,
      dimensions: ['identity'],
    });
    if (identityBlocked) return identityBlocked;

    const { reference, quote, whatsapp } = await captureManuelOrder(payload);

    return NextResponse.json({ ok: true, reference, quote, whatsapp });
  } catch (error) {
    if (error instanceof ManuelOrderValidationError) {
      return NextResponse.json({ ok: false, error: error.code }, { status: 400 });
    }
    console.error('[manuels/commande] error', serializeError(error));
    return NextResponse.json({ ok: false, error: 'order_capture_failed' }, { status: 500 });
  }
}
