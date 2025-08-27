export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/assistant/payments
// Liste des paiements en attente de validation (Wise/Konnect)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pending = await prisma.payment.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
      take: 100,
    });

    const formatted = pending.map((p: any) => ({
      id: p.id,
      method: p.method,
      type: p.type,
      amount: p.amount,
      currency: p.currency,
      description: p.description,
      createdAt: p.createdAt,
      parent: {
        id: p.user.id,
        email: p.user.email,
        firstName: p.user.firstName,
        lastName: p.user.lastName,
      },
      metadata: p.metadata,
    }));

    return NextResponse.json({ payments: formatted });
  } catch (error) {
    console.error('Error fetching pending payments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
