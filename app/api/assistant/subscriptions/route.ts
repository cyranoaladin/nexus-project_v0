import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get pending subscription requests (INACTIVE subscriptions that need approval)
    const pendingSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'INACTIVE'
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

    // Get all subscriptions for overview
    const allSubscriptions = await prisma.subscription.findMany({
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

    const formattedPendingSubscriptions = pendingSubscriptions.map((sub) => ({
      id: sub.id,
      planName: sub.planName,
      monthlyPrice: sub.monthlyPrice,
      creditsPerMonth: sub.creditsPerMonth,
      status: sub.status,
      createdAt: sub.createdAt,
      student: {
        id: sub.student.id,
        firstName: sub.student.user.firstName,
        lastName: sub.student.user.lastName,
        grade: sub.student.grade,
        school: sub.student.school
      },
      parent: {
        firstName: sub.student.parent.user.firstName,
        lastName: sub.student.parent.user.lastName,
        email: sub.student.parent.user.email
      }
    }));

    const formattedAllSubscriptions = allSubscriptions.map((sub) => ({
      id: sub.id,
      planName: sub.planName,
      monthlyPrice: sub.monthlyPrice,
      creditsPerMonth: sub.creditsPerMonth,
      status: sub.status,
      createdAt: sub.createdAt,
      startDate: sub.startDate,
      endDate: sub.endDate,
      student: {
        id: sub.student.id,
        firstName: sub.student.user.firstName,
        lastName: sub.student.user.lastName,
        grade: sub.student.grade
      },
      parent: {
        firstName: sub.student.parent.user.firstName,
        lastName: sub.student.parent.user.lastName
      }
    }));

    return NextResponse.json({
      pendingSubscriptions: formattedPendingSubscriptions,
      allSubscriptions: formattedAllSubscriptions
    });

  } catch (error) {
    console.error('Error fetching subscription requests:', error);
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
    const { subscriptionId, action, reason: _reason } = body;

    if (!subscriptionId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get the subscription
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        student: true
      }
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    if (subscription.status !== 'INACTIVE') {
      return NextResponse.json(
        { error: 'Subscription is not pending approval' },
        { status: 400 }
      );
    }

    // status must be a valid SubscriptionStatus from schema
    let newStatus: 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'EXPIRED';
    let creditAmount: number = 0;

    if (action === 'approve') {
      newStatus = 'ACTIVE';
      creditAmount = subscription.creditsPerMonth || 0;
    } else if (action === 'reject') {
      newStatus = 'INACTIVE';
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Update subscription status
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: newStatus
      }
    });

    // If approved, add credits to student
    if (action === 'approve' && creditAmount > 0) {
      await prisma.creditTransaction.create({
        data: {
          studentId: subscription.studentId,
          type: 'CREDIT_ADD',
          amount: creditAmount,
          description: `Crédits inclus dans l'abonnement ${subscription.planName} (approuvé par ${session.user.firstName} ${session.user.lastName})`
        }
      });
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        message: action === 'approve'
          ? 'Abonnement approuvé et crédits ajoutés'
          : 'Abonnement rejeté'
      }
    });

  } catch (error) {
    console.error('Error processing subscription request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
