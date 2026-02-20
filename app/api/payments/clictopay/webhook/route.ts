export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

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
    // TODO: Implémenter le traitement du webhook ClicToPay
    // 1. Vérifier la signature du webhook (HMAC ou IP whitelist)
    // 2. Parser le payload (orderId, bankReference, status)
    // 3. Mettre à jour ClicToPayTransaction (status, bankReference)
    // 4. Mettre à jour Payment (status → COMPLETED ou FAILED)
    // 5. Déclencher les side-effects (activation entitlements, notifications)

    void request; // Suppress unused parameter warning

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
