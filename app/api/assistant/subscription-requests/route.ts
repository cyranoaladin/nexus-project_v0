import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const skip = (page - 1) * limit;

    // Get subscription requests
    const requests = await prisma.subscriptionRequest.findMany({
      where: {
        status: status,
      },
      include: {
        student: {
          include: {
            user: true,
            parent: {
              include: {
                user: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: skip,
      take: limit,
    });

    const total = await prisma.subscriptionRequest.count({
      where: {
        status: status,
      },
    });

    return NextResponse.json({
      requests: requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching subscription requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      requestId,
      action,
      reason,
      planName: planNameInput,
      monthlyPrice: monthlyPriceInput,
    } = body;

    if (!requestId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['APPROVED', 'REJECTED'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
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
                user: true,
              },
            },
          },
        },
      },
    });

    if (!subscriptionRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (subscriptionRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
    }

    // Update request status
    await prisma.subscriptionRequest.update({
      where: { id: requestId },
      data: {
        status: action,
        processedBy: `${session.user.firstName} ${session.user.lastName}`,
        processedAt: new Date(),
        rejectionReason: action === 'REJECTED' ? reason : null,
      },
    });

    // If approved, apply the changes
    if (action === 'APPROVED') {
      if (subscriptionRequest.requestType === 'PLAN_CHANGE') {
        // Use planName/monthlyPrice from body if provided, else from stored request
        const targetPlanName = planNameInput || subscriptionRequest.planName;
        const targetMonthlyPrice =
          typeof monthlyPriceInput === 'number'
            ? monthlyPriceInput
            : subscriptionRequest.monthlyPrice;

        if (!targetPlanName) {
          return NextResponse.json(
            { error: 'Plan name is required for plan change requests' },
            { status: 400 }
          );
        }

        // Update subscription
        await prisma.subscription.updateMany({
          where: {
            studentId: subscriptionRequest.studentId,
            status: 'ACTIVE',
          },
          data: {
            planName: targetPlanName,
            monthlyPrice: targetMonthlyPrice,
            updatedAt: new Date(),
          },
        });
      } else if (subscriptionRequest.requestType === 'ARIA_ADDON') {
        const addonName = planNameInput || subscriptionRequest.planName;
        if (!addonName) {
          return NextResponse.json(
            { error: 'Plan name is required for ARIA addon requests' },
            { status: 400 }
          );
        }

        // Add ARIA addon to subscription
        const currentSubscription = await prisma.subscription.findFirst({
          where: {
            studentId: subscriptionRequest.studentId,
            status: 'ACTIVE',
          },
        });

        if (currentSubscription) {
          const currentAriaSubjects = JSON.parse(currentSubscription.ariaSubjects || '[]');
          const newAriaSubjects = [...currentAriaSubjects, addonName];

          await prisma.subscription.update({
            where: { id: currentSubscription.id },
            data: {
              ariaSubjects: JSON.stringify(newAriaSubjects),
              updatedAt: new Date(),
            },
          });
        }
      }
    }

    // Garantie Bac: activer si un abonnement premium est actif
    try {
      const activeSub = await prisma.subscription.findFirst({
        where: { studentId: subscriptionRequest.studentId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });
      if (activeSub && ['IMMERSION', 'HYBRIDE'].includes(activeSub.planName)) {
        await prisma.student.update({
          where: { id: subscriptionRequest.studentId },
          data: {
            guaranteeEligible: true,
            guaranteeActivatedAt: new Date(),
          },
        });
      }
    } catch (e) {
      // Ne pas bloquer la requête pour un échec non-critique
    }

    return NextResponse.json({
      success: true,
      message: `Demande ${action === 'APPROVED' ? 'approuvée' : 'rejetée'} avec succès`,
    });
  } catch (error) {
    console.error('Error processing subscription request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
