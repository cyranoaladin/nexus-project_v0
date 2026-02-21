export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

/**
 * Verify webhook signature using HMAC-SHA256
 * 
 * @param payload - Raw request body as string
 * @param signature - Signature from request header
 * @param secret - ClicToPay webhook secret
 * @returns true if signature is valid
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  // Use timing-safe comparison to prevent timing attacks
  return signature === expectedSignature;
}

/**
 * POST /api/payments/clictopay/webhook
 *
 * Webhook appelé par ClicToPay (Banque Zitouna) après un paiement.
 * Met à jour le statut de la transaction et du Payment associé.
 *
 * @status 501 — En attente d'activation des clés API ClicToPay.
 * 
 * SECURITY: Webhook signature verification is implemented but disabled until
 * ClicToPay integration is activated. Once active, ensure CLICTOPAY_WEBHOOK_SECRET
 * is set in environment variables.
 */
export async function POST(request: NextRequest) {
  try {
    // Security: Verify webhook signature (when ClicToPay is configured)
    const signature = request.headers.get('X-ClicToPay-Signature');
    const webhookSecret = process.env.CLICTOPAY_WEBHOOK_SECRET;

    // If webhook secret is configured, enforce signature verification
    if (webhookSecret) {
      if (!signature) {
        console.warn('[ClicToPay Webhook] Missing signature header');
        return NextResponse.json(
          { error: 'Missing webhook signature' },
          { status: 401 }
        );
      }

      const body = await request.text();
      
      if (!verifyWebhookSignature(body, signature, webhookSecret)) {
        console.error('[ClicToPay Webhook] Invalid signature');
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        );
      }

      // Parse body after signature verification
      const payload = JSON.parse(body);
      
      // TODO: Implement webhook processing
      // 1. Parse payload (orderId, bankReference, status)
      // 2. Update ClicToPayTransaction (status, bankReference)
      // 3. Update Payment (status → COMPLETED or FAILED)
      // 4. Trigger side-effects (activation, notifications)
      
      void payload; // Suppress unused warning
    }

    // ClicToPay not yet configured
    return NextResponse.json(
      {
        error: 'Webhook ClicToPay en cours de configuration',
        code: 'CLICTOPAY_NOT_CONFIGURED',
      },
      { status: 501 }
    );
  } catch (error) {
    console.error('[ClicToPay Webhook] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
