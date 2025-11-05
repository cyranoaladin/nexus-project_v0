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
    const { status } = body;

    const allowedStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Get the current request
    const currentRequest = await prisma.creditTransaction.findUnique({
      where: { id: requestId }
    });

    if (!currentRequest) {
      return NextResponse.json(
        { error: 'Credit request not found' },
        { status: 404 }
      );
    }

    // Update the credit request (store status within description for traceability)
    const updatedRequest = await prisma.creditTransaction.update({
      where: { id: requestId },
      data: {
        description: `${currentRequest.description ?? ''} [status:${status}]`
      }
    });

    // If approved, add credits to the student
    if (status === 'APPROVED') {
      await prisma.student.update({
        where: { id: currentRequest.studentId },
        data: {
          credits: {
            increment: Math.abs(currentRequest.amount) // Ensure positive amount
          }
        }
      });

      // Create a record of the credit addition
      await prisma.creditTransaction.create({
        data: {
          studentId: currentRequest.studentId,
          type: 'CREDIT_ADDITION',
          amount: Math.abs(currentRequest.amount),
          description: `Crédits ajoutés suite à l'approbation de la demande ${requestId}`
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Credit request ${requestId} ${status.toLowerCase()} successfully`,
      request: updatedRequest
    });

  } catch (error) {
    console.error('Error updating credit request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
