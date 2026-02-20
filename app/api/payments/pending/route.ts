export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

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
      return NextResponse.json(
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

    return NextResponse.json({ payments });
  } catch (error) {
    console.error('[Payments Pending] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
