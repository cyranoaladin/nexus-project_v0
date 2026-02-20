export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/payments/check-pending?description=...&amount=...
 *
 * Checks if the current PARENT user already has a PENDING bank_transfer
 * payment matching the given description and amount.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== 'PARENT') {
      return NextResponse.json({ hasPending: false });
    }

    const { searchParams } = new URL(request.url);
    const description = searchParams.get('description');
    const amount = searchParams.get('amount');

    if (!description || !amount) {
      return NextResponse.json({ hasPending: false });
    }

    const existing = await prisma.payment.findFirst({
      where: {
        userId: session.user.id,
        method: 'bank_transfer',
        status: 'PENDING',
        description,
        amount: parseFloat(amount),
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({
      hasPending: !!existing,
      paymentId: existing?.id ?? null,
      createdAt: existing?.createdAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('[CheckPending] Erreur:', error);
    return NextResponse.json({ hasPending: false });
  }
}
