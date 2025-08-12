import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get pending credit requests
    const creditRequests = await prisma.creditTransaction.findMany({
      where: {
        type: 'CREDIT_REQUEST'
      },
      include: {
        student: {
          include: {
            user: true,
            parent: {
              include: {
                user: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedRequests = creditRequests.map((request: any) => ({
      id: request.id,
      amount: request.amount,
      description: request.description,
      createdAt: request.createdAt,
      student: {
        id: request.student.id,
        firstName: request.student.user.firstName,
        lastName: request.student.user.lastName,
        grade: request.student.grade,
        school: request.student.school
      },
      parent: {
        firstName: request.student.parent.user.firstName,
        lastName: request.student.parent.user.lastName,
        email: request.student.parent.user.email
      }
    }));

    return NextResponse.json({
      creditRequests: formattedRequests
    });

  } catch (error) {
    console.error('Error fetching credit requests:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { requestId, action, reason } = body;

    if (!requestId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get the credit request
    const creditRequest = await prisma.creditTransaction.findUnique({
      where: { id: requestId },
      include: {
        student: true
      }
    });

    if (!creditRequest) {
      return NextResponse.json(
        { error: 'Credit request not found' },
        { status: 404 }
      );
    }

    if (creditRequest.type !== 'CREDIT_REQUEST') {
      return NextResponse.json(
        { error: 'Invalid credit request' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // Update the credit request status and add credits to student
      await prisma.$transaction(async (tx: any) => {
        // Update the credit request
        await tx.creditTransaction.update({
          where: { id: requestId },
          data: {
            type: 'CREDIT_ADD',
            description: `Crédits approuvés par ${session.user.firstName} ${session.user.lastName}. ${reason ? `Raison: ${reason}` : ''}`
          }
        });

        // Add credits to student
        await tx.creditTransaction.create({
          data: {
            studentId: creditRequest.studentId,
            type: 'CREDIT_ADD',
            amount: creditRequest.amount,
            description: `Crédits ajoutés par ${session.user.firstName} ${session.user.lastName} (demande approuvée)`
          }
        });
      });

      return NextResponse.json({
        success: true,
        message: 'Demande de crédits approuvée et crédits ajoutés'
      });

    } else if (action === 'reject') {
      // Update the credit request status
      await prisma.creditTransaction.update({
        where: { id: requestId },
        data: {
          type: 'CREDIT_REJECTED',
          description: `Demande rejetée par ${session.user.firstName} ${session.user.lastName}. ${reason ? `Raison: ${reason}` : ''}`
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Demande de crédits rejetée'
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error processing credit request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 