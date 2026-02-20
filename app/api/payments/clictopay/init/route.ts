export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

/**
 * POST /api/payments/clictopay/init
 *
 * Initialise une transaction ClicToPay (Banque Zitouna).
 * Retourne l'URL de redirection vers la page de paiement ClicToPay.
 *
 * @status 501 — En attente d'activation des clés API ClicToPay.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      );
    }

    // TODO: Implémenter l'intégration ClicToPay une fois les clés API activées
    // 1. Valider le body (montant, description, userId)
    // 2. Créer un Payment PENDING + ClicToPayTransaction PENDING
    // 3. Appeler l'API ClicToPay pour obtenir l'URL de paiement
    // 4. Retourner { payUrl, orderId }

    void request; // Suppress unused parameter warning

    return NextResponse.json(
      {
        error: 'Service de paiement ClicToPay en cours de configuration',
        code: 'CLICTOPAY_NOT_CONFIGURED',
      },
      { status: 501 }
    );
  } catch (error) {
    console.error('[ClicToPay Init] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
