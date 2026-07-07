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
    const rawBody = await request.text();
    const signature = request.headers.get('x-clictopay-signature')?.trim() ?? '';
    if (!signature) {
      logger.warn('[ClicToPay Webhook] Missing signature');
      return NextResponse.json(
        { error: 'Signature requise', code: 'CLICTOPAY_SIGNATURE_REQUIRED' },
        { status: 401 }
      );
    }

    // HMAC signature verification (reject spoofed webhooks)
    const secret = process.env.CLICTOPAY_WEBHOOK_SECRET;
    if (secret) {
      const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
      let signatureValid = false;
      // Validate hex format BEFORE Buffer.from to prevent silent truncation
      if (/^[0-9a-f]{64}$/i.test(signature)) {
        try {
          const signatureBuffer = Buffer.from(signature, 'hex');
          const expectedBuffer = Buffer.from(expected, 'hex');
          signatureValid =
            signatureBuffer.length === expectedBuffer.length &&
            timingSafeEqual(signatureBuffer, expectedBuffer);
        } catch {
          // Malformed buffer — definitely invalid
        }
      }
      if (!signatureValid) {
        logger.warn('[ClicToPay Webhook] Invalid signature');
        return NextResponse.json(
          { error: 'Signature invalide', code: 'CLICTOPAY_SIGNATURE_INVALID' },
          { status: 401 }
        );
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
