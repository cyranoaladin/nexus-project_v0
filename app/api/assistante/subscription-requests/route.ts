export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getAriaAddonCatalogItem, getSubscriptionCatalogPlan } from '@/lib/operational-catalog';

class AlreadyProcessedError extends Error {}
class NoActiveSubscriptionError extends Error {}

function getRequestCatalogFields(request: { requestType: string; planName: string | null; monthlyPrice: number }) {
  if (request.requestType === 'PLAN_CHANGE') {
    const plan = getSubscriptionCatalogPlan(request.planName);
    return {
      catalogMonthlyPrice: plan?.price ?? request.monthlyPrice,
      catalogCreditsPerMonth: plan?.credits ?? 0,
      catalogAriaCost: 0,
    };
  }

  if (request.requestType === 'ARIA_ADDON') {
    const addon = getAriaAddonCatalogItem(request.planName);
    return {
      catalogMonthlyPrice: addon?.price ?? request.monthlyPrice,
      catalogCreditsPerMonth: 0,
      catalogAriaCost: addon?.price ?? request.monthlyPrice,
    };
  }

  return {
    catalogMonthlyPrice: request.monthlyPrice,
    catalogCreditsPerMonth: 0,
    catalogAriaCost: 0,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
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

    const formattedRequests = requests.map((subscriptionRequest) => ({
      ...subscriptionRequest,
      ...getRequestCatalogFields(subscriptionRequest),
    }));

    return NextResponse.json({
      requests: formattedRequests,
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
    const session = await auth();

    if (!session || !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
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

    const plan = subscriptionRequest.requestType === 'PLAN_CHANGE'
      ? getSubscriptionCatalogPlan(subscriptionRequest.planName)
      : null;
    const addon = subscriptionRequest.requestType === 'ARIA_ADDON'
      ? getAriaAddonCatalogItem(subscriptionRequest.planName)
      : null;

    if (action === 'APPROVED' && subscriptionRequest.requestType === 'PLAN_CHANGE' && !plan) {
      return NextResponse.json({ error: 'Plan d’abonnement invalide' }, { status: 400 });
    }
    if (action === 'APPROVED' && subscriptionRequest.requestType === 'ARIA_ADDON' && !addon) {
      return NextResponse.json({ error: 'Add-on ARIA invalide' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.subscriptionRequest.updateMany({
        where: { id: requestId, status: 'PENDING' },
        data: {
          status: action,
          processedBy: `${session.user.firstName} ${session.user.lastName}`,
          processedAt: new Date(),
          ...(action === 'REJECTED' ? { rejectionReason: reason ?? '' } : {})
        }
      });

      if (updatedRequest.count !== 1) {
        throw new AlreadyProcessedError('Subscription request already processed');
      }

      if (action !== 'APPROVED') return;

      if (subscriptionRequest.requestType === 'PLAN_CHANGE' && plan) {
        const updatedSubscription = await tx.subscription.updateMany({
          where: { studentId: subscriptionRequest.studentId, status: 'ACTIVE' },
          data: {
            planName: subscriptionRequest.planName!,
            monthlyPrice: plan.price,
            creditsPerMonth: plan.credits,
            updatedAt: new Date()
          }
        });

        if (updatedSubscription.count === 0) {
          await tx.subscription.create({
            data: {
              studentId: subscriptionRequest.studentId,
              planName: subscriptionRequest.planName!,
              monthlyPrice: plan.price,
              creditsPerMonth: plan.credits,
              status: 'ACTIVE',
              startDate: new Date(),
              endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              ariaSubjects: '[]',
              ariaCost: 0
            }
          });
        }

        if (plan.credits > 0) {
          await tx.creditTransaction.create({
            data: {
              studentId: subscriptionRequest.studentId,
              type: 'CREDIT_ADD',
              amount: plan.credits,
              description: `Crédits inclus dans l'abonnement ${subscriptionRequest.planName} (demande approuvée par ${session.user.firstName} ${session.user.lastName})`
            }
          });
        }
      } else if (subscriptionRequest.requestType === 'ARIA_ADDON' && addon) {
        const updatedSubscription = await tx.subscription.updateMany({
          where: { studentId: subscriptionRequest.studentId, status: 'ACTIVE' },
          data: {
            ariaSubjects: subscriptionRequest.planName ? JSON.stringify([subscriptionRequest.planName]) : undefined,
            ariaCost: addon.price
          }
        });

        if (updatedSubscription.count === 0) {
          throw new NoActiveSubscriptionError('No active subscription for ARIA add-on');
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Demande ${action === 'APPROVED' ? 'approuvée' : 'rejetée'} avec succès`
    });

  } catch (error) {
    if (error instanceof AlreadyProcessedError) {
      return NextResponse.json(
        { error: 'Demande déjà traitée' },
        { status: 409 }
      );
    }

    if (error instanceof NoActiveSubscriptionError) {
      return NextResponse.json(
        { error: 'Aucun abonnement actif trouvé' },
        { status: 400 }
      );
    }

    console.error('Error processing subscription request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
