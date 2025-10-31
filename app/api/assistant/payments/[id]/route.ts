import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { mapPaymentToResponse, paymentResponseInclude } from '@/app/api/sessions/contracts';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; }; }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const paymentId = params.id;
    const body = await request.json();
    const { status } = body;

    const allowedStatuses = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Update the payment status
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: status as any,
        updatedAt: new Date()
      },
      include: paymentResponseInclude,
    });

    return NextResponse.json({
      success: true,
      message: `Payment ${paymentId} updated successfully`,
      payment: mapPaymentToResponse(updatedPayment)
    });

  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
