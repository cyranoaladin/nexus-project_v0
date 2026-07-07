import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { z } from 'zod';

class AlreadyProcessedError extends Error {}

const creditRequestDecisionSchema = z.object({
  requestId: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
  action: z.enum(['approve', 'reject']),
  reason: z.string().trim().max(500).optional(),
}).strict();

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
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

    const formattedRequests = creditRequests.map((request) => ({
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
    console.error('Error fetching credit requests:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    const parsedBody = creditRequestDecisionSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid credit request payload' },
        { status: 400 }
      );
    }
    const { requestId, action, reason } = parsedBody.data;

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
      await prisma.$transaction(async (tx) => {
        // Update the credit request
        const updated = await tx.creditTransaction.updateMany({
          where: { id: requestId, type: 'CREDIT_REQUEST' },
          data: {
            type: 'CREDIT_ADD',
            description: `Crédits approuvés par ${session.user.firstName} ${session.user.lastName}. ${reason ? `Raison: ${reason}` : ''}`
          }
        });

        if (updated.count !== 1) {
          throw new AlreadyProcessedError('Credit request already processed');
        }

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
    if (error instanceof AlreadyProcessedError) {
      return NextResponse.json(
        { error: 'Demande déjà traitée' },
        { status: 409 }
      );
    }

    console.error('Error processing credit request:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
