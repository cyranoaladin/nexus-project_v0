import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

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

    const requestId = params.id;
    const body = await request.json();
    const { status, notes } = body;

    const allowedStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Get the current request
    const currentRequest = await prisma.subscriptionRequest.findUnique({
      where: { id: requestId }
    });

    if (!currentRequest) {
      return NextResponse.json(
        { error: 'Subscription request not found' },
        { status: 404 }
      );
    }

    // Update the subscription request
    const updatedRequest = await prisma.subscriptionRequest.update({
      where: { id: requestId },
      data: {
        status: status as any,
        processedBy: session.user.id,
        processedAt: new Date(),
        ...(status === 'REJECTED' ? { rejectionReason: notes ?? currentRequest.rejectionReason } : {})
      }
    });

    // If approved, create the subscription
    if (status === 'APPROVED') {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

      await prisma.subscription.create({
        data: {
          studentId: currentRequest.studentId,
          planName: currentRequest.planName!,
          monthlyPrice: currentRequest.monthlyPrice,
          creditsPerMonth: 0,
          status: 'ACTIVE',
          startDate: startDate,
          endDate: endDate,
          ariaSubjects: '[]',
          ariaCost: 0
        }
      });

      // Add initial credits to the student
      // Pas d'ajout automatique de crédits ici (géré par allocation mensuelle)

      // L'allocation mensuelle de crédits sera gérée par un job dédié
    }

    return NextResponse.json({
      success: true,
      message: `Subscription request ${requestId} ${status.toLowerCase()} successfully`,
      request: updatedRequest
    });

  } catch (error) {
    console.error('Error updating subscription request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
