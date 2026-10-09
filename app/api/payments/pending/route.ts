import { privateFinancialJson } from '@/lib/invoice/private-response';
export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/payments/pending
 *
 * Liste les paiements PENDING (virements bancaires) pour validation par ASSISTANTE/ADMIN.
 */
export async function GET() {
  try {
    const session = await auth();

    if (
      !session?.user?.id ||
      !['ADMIN', 'ASSISTANTE'].includes(session.user.role)
    ) {
      return privateFinancialJson(
        { error: 'Accès non autorisé' },
        { status: 401 }
      );
    }

    const payments = await prisma.payment.findMany({
      where: {
        status: 'PENDING',
        method: 'bank_transfer',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return privateFinancialJson({ payments });
  } catch {
    console.error('PENDING_PAYMENTS_READ_FAILED');
    return privateFinancialJson(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
