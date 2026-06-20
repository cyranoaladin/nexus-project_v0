export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';

/**
 * POST /api/payments/clictopay/webhook
 *
 * Webhook appelé par ClicToPay (Banque Zitouna) après un paiement.
 * Met à jour le statut de la transaction et du Payment associé.
 *
 * @status 501 — En attente d'activation des clés API ClicToPay.
 */
export async function POST(request: NextRequest) {
  try {
    // HMAC signature verification (reject spoofed webhooks)
    const secret = process.env.CLICTOPAY_WEBHOOK_SECRET;
    if (secret) {
      const signature = request.headers.get('x-clictopay-signature') ?? '';
      const rawBody = await request.text();
      const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
      let signatureValid = false;
      try {
        signatureValid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      } catch {
        // Length mismatch — definitely invalid
      }
      if (!signatureValid) {
        logger.warn('[ClicToPay Webhook] Invalid signature');
        return NextResponse.json({ error: 'Signature invalide' }, { status: 401 });
      }
    }

    // 1. Parser le payload (orderId, bankReference, status)
    // 2. Mettre à jour ClicToPayTransaction (status, bankReference)
    // 3. Mettre à jour Payment (status → COMPLETED ou FAILED)
    // 4. Déclencher les side-effects (activation entitlements, notifications)

    return NextResponse.json(
      {
        error: 'Webhook ClicToPay en cours de configuration',
        code: 'CLICTOPAY_NOT_CONFIGURED',
      },
      { status: 501 }
    );
  } catch (error) {
    logger.error({ err: error }, '[ClicToPay Webhook] Erreur');
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
