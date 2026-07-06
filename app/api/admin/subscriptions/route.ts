import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isErrorResponse, requireRole } from '@/lib/guards';
import { SubscriptionStatus, UserRole, type Prisma } from '@prisma/client';
import { z } from 'zod';

type SubscriptionWithStudent = Prisma.SubscriptionGetPayload<{
  select: {
    id: true;
    planName: true;
    monthlyPrice: true;
    status: true;
    startDate: true;
    endDate: true;
    createdAt: true;
    student: {
      select: {
        id: true;
        grade: true;
        school: true;
        user: { select: { firstName: true; lastName: true; email: true } };
        parent: { select: { user: { select: { firstName: true; lastName: true; email: true } } } };
      };
    };
  };
}>;

const statusFilterSchema = z.union([z.nativeEnum(SubscriptionStatus), z.literal('ALL')]);
const adminSubscriptionsQuerySchema = z.object({
  status: statusFilterSchema.default(SubscriptionStatus.ACTIVE),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).default(''),
}).strict();

const subscriptionUpdateSchema = z.object({
  subscriptionId: z.string().trim().min(1).max(191),
  status: z.nativeEnum(SubscriptionStatus).optional(),
  endDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional(),
}).strict();

export async function GET(request: NextRequest) {
  try {
    const sessionOrError = await requireRole(UserRole.ADMIN);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const { searchParams } = new URL(request.url);
    const parsedQuery = adminSubscriptionsQuerySchema.safeParse(
      Object.fromEntries(searchParams.entries())
    );
    if (!parsedQuery.success) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }
    const { status: statusParam, page, limit, search } = parsedQuery.data;

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: Prisma.SubscriptionWhereInput = {};
    
    if (statusParam !== 'ALL') {
      whereClause.status = statusParam;
    }
    
    if (search) {
      whereClause.OR = [
        {
          student: {
            user: {
              OR: [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { email: { contains: search } }
              ]
            }
          }
        },
        {
          planName: { contains: search }
        }
      ];
    }

    // Get subscriptions with pagination
    const [subscriptions, totalSubscriptions] = (await Promise.all([
      prisma.subscription.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          planName: true,
          monthlyPrice: true,
          status: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          student: {
            select: {
              id: true,
              grade: true,
              school: true,
              user: { select: { firstName: true, lastName: true, email: true } },
              parent: {
                select: { user: { select: { firstName: true, lastName: true, email: true } } }
              }
            }
          }
        }
      }),
      prisma.subscription.count({ where: whereClause })
    ])) as [SubscriptionWithStudent[], number];

    const formattedSubscriptions = subscriptions.map((subscription) => ({
      id: subscription.id,
      planName: subscription.planName,
      monthlyPrice: subscription.monthlyPrice,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      createdAt: subscription.createdAt,
      student: {
        id: subscription.student.id,
        firstName: subscription.student.user.firstName,
        lastName: subscription.student.user.lastName,
        email: subscription.student.user.email,
        grade: subscription.student.grade,
        school: subscription.student.school
      },
      parent: {
        firstName: subscription.student.parent.user.firstName,
        lastName: subscription.student.parent.user.lastName,
        email: subscription.student.parent.user.email
      }
    }));

    return NextResponse.json({
      subscriptions: formattedSubscriptions,
      pagination: {
        page,
        limit,
        total: totalSubscriptions,
        totalPages: Math.ceil(totalSubscriptions / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching subscriptions:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const sessionOrError = await requireRole(UserRole.ADMIN);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const parsedBody = subscriptionUpdateSchema.safeParse(json);
    if (!parsedBody.success) {
      const hasInvalidStatus = parsedBody.error.issues.some((issue) => issue.path[0] === 'status');
      const hasMissingSubscriptionId = parsedBody.error.issues.some((issue) => issue.path[0] === 'subscriptionId');
      return NextResponse.json(
        {
          error: hasInvalidStatus
            ? 'Invalid status value'
            : hasMissingSubscriptionId
              ? 'Subscription ID is required'
              : 'Invalid payload',
        },
        { status: 400 }
      );
    }
    const { subscriptionId, status, endDate } = parsedBody.data;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    // Update subscription
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status,
        endDate: endDate ? new Date(endDate) : undefined
      },
      select: {
        id: true,
        status: true,
        endDate: true,
        student: {
          select: { user: { select: { firstName: true, lastName: true } } }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription updated successfully',
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        endDate: updatedSubscription.endDate,
        studentName: `${updatedSubscription.student.user.firstName} ${updatedSubscription.student.user.lastName}`
      }
    });

  } catch (error) {
    console.error('Error updating subscription:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
