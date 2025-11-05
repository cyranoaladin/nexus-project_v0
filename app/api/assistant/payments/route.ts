import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { mapPaymentToResponse, paymentResponseInclude } from '@/app/api/sessions/contracts';
export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all payments with user information
    const payments = await prisma.payment.findMany({
      include: paymentResponseInclude,
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(payments.map(mapPaymentToResponse));

  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
