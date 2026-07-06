import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

const allowedInitiatorRoles = new Set<string>([UserRole.PARENT, UserRole.ADMIN, UserRole.ASSISTANTE]);

const clicToPayInitSchema = z.object({
  amount: z.number().positive().optional(),
  invoiceId: z.string().trim().min(1).max(191).optional(),
  description: z.string().trim().min(1).max(300).optional(),
}).strict();

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

    if (!allowedInitiatorRoles.has((session.user as { role?: string }).role ?? '')) {
      return NextResponse.json(
        { error: 'Accès refusé' },
        { status: 403 }
      );
    }

    if (process.env.NEXT_PUBLIC_ENABLE_CLICTOPAY_PUBLIC === 'true') {
      return NextResponse.json(
        {
          error: 'Configuration paiement incohérente',
          code: 'CLICTOPAY_PUBLIC_FLAG_INCONSISTENT',
        },
        { status: 503 }
      );
    }

    const parsedBody = clicToPayInitSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Données invalides' },
        { status: 400 }
      );
    }

    // 1. Valider le body (montant, description, userId)
    // 2. Créer un Payment PENDING + ClicToPayTransaction PENDING
    // 3. Appeler l'API ClicToPay pour obtenir l'URL de paiement
    // 4. Retourner { payUrl, orderId }

    void parsedBody;

    return NextResponse.json(
      {
        error: 'Service de paiement ClicToPay en cours de configuration',
        code: 'CLICTOPAY_NOT_CONFIGURED',
      },
      { status: 501 }
    );
  } catch (error) {
    console.error('[ClicToPay Init] Erreur:', serializeError(error));
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
