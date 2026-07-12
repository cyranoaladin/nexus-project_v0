export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';
import { redactForLogging } from '@/lib/security/redact-for-logging';

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

    // Validate hex format before any cryptographic operation.
    // HMAC-SHA256 produces 64 hex characters. Reject malformed signatures
    // before Buffer.from() to prevent silent truncation.
    if (!/^[0-9a-f]{64}$/i.test(signature)) {
      logger.warn('[ClicToPay Webhook] Signature format invalide');
      return NextResponse.json({ error: 'Signature invalide' }, { status: 401 });
    }

    // NOW consume the body for HMAC verification.
    // Decode hex signature to binary (32 bytes) — regex already validated format.
    // Compare decoded buffers, not hex strings, per cryptographic best practice.
    const rawBody = await request.text();
    const expectedBuf = createHmac('sha256', secret).update(rawBody).digest();
    const signatureBuf = Buffer.from(signature.toLowerCase(), 'hex');
    let signatureValid = false;
    try {
      signatureValid = timingSafeEqual(signatureBuf, expectedBuf);
    } catch {
      // Length mismatch — should not happen since both are 32 bytes after hex decode
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
    const safeErr = error instanceof Error
      ? { name: error.name, message: error.message }
      : { message: 'Unknown error' };
    logger.error(redactForLogging(safeErr), '[ClicToPay Webhook] Erreur');
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
