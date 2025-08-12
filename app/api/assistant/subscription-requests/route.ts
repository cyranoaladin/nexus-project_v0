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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const skip = (page - 1) * limit;

    // Get subscription requests
    const requests = await prisma.subscriptionRequest.findMany({
      where: {
        status: status
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
      },
      skip: skip,
      take: limit
    });

    const total = await prisma.subscriptionRequest.count({
      where: {
        status: status
      }
    });

    return NextResponse.json({
      requests: requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching subscription requests:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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

    if (!['APPROVED', 'REJECTED'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Get the request
    const subscriptionRequest = await prisma.subscriptionRequest.findUnique({
      where: { id: requestId },
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
      }
    });

    if (!subscriptionRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    if (subscriptionRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Request already processed' },
        { status: 400 }
      );
    }

    // Update request status
    await prisma.subscriptionRequest.update({
      where: { id: requestId },
      data: {
        status: action,
        processedBy: `${session.user.firstName} ${session.user.lastName}`,
        processedAt: new Date(),
        rejectionReason: action === 'REJECTED' ? reason : null
      }
    });

    // If approved, apply the changes
    if (action === 'APPROVED') {
      if (subscriptionRequest.requestType === 'PLAN_CHANGE') {
        // Update subscription
        await prisma.subscription.updateMany({
          where: {
            studentId: subscriptionRequest.studentId,
            status: 'ACTIVE'
          },
          data: {
            planName: subscriptionRequest.planName,
            monthlyPrice: subscriptionRequest.monthlyPrice,
            updatedAt: new Date()
          }
        });
      } else if (subscriptionRequest.requestType === 'ARIA_ADDON') {
        // Add ARIA addon to student
        await prisma.student.update({
          where: { id: subscriptionRequest.studentId },
          data: {
            ariaAddons: {
              push: subscriptionRequest.planName
            }
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Demande ${action === 'APPROVED' ? 'approuvée' : 'rejetée'} avec succès`
    });

  } catch (error) {
    console.error('Error processing subscription request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 