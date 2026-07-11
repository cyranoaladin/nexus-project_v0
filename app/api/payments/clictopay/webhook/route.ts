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
    const secret = process.env.CLICTOPAY_WEBHOOK_SECRET;

    // No secret configured → feature disabled, return 501 WITHOUT consuming body
    if (!secret) {
      return NextResponse.json(
        { error: 'Webhook ClicToPay en cours de configuration', code: 'CLICTOPAY_NOT_CONFIGURED' },
        { status: 501 }
      );
    }

    // Read signature header BEFORE consuming body
    const signature = request.headers.get('x-clictopay-signature') ?? '';
    if (!signature) {
      return NextResponse.json({ error: 'Signature manquante' }, { status: 401 });
    }

    // NOW consume the body for HMAC verification
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

    // TODO: 1. Parse payload (orderId, bankReference, status)
    // TODO: 2. Update ClicToPayTransaction
    // TODO: 3. Update Payment (COMPLETED/FAILED)
    // TODO: 4. Side-effects (activation, notifications)

    return NextResponse.json(
      { error: 'Webhook ClicToPay en cours de configuration', code: 'CLICTOPAY_NOT_CONFIGURED' },
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
