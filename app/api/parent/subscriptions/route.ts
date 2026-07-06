import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getOperationalSubscriptionPlan } from '@/lib/operational-catalog';
import { z } from 'zod';

const parentSubscriptionRequestSchema = z.object({
  studentId: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
  planName: z.string().trim().min(1).max(120),
}).strict();

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || session.user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get parent profile
    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: userId },
    });

    if (!parentProfile) {
      return NextResponse.json(
        { error: 'Parent profile not found' },
        { status: 404 }
      );
    }

    // Get children with their subscriptions
    const children = await prisma.student.findMany({
      where: { parentId: parentProfile.id },
      include: {
        user: true,
        subscriptions: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        creditTransactions: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    const formattedChildren = children.map((child) => {
      const creditBalance = child.creditTransactions.reduce((total: number, transaction) => {
        return total + transaction.amount;
      }, 0);

      const activeSubscription = child.subscriptions.find((sub) => sub.status === 'ACTIVE') ||
                                child.subscriptions.find((sub) => sub.status === 'INACTIVE') ||
                                null;

      return {
        id: child.id,
        firstName: child.user.firstName,
        lastName: child.user.lastName,
        grade: child.grade,
        school: child.school,
        currentSubscription: activeSubscription?.planName || 'AUCUN',
        subscriptionStatus: activeSubscription?.status || 'INACTIVE',
        subscriptionExpiry: activeSubscription?.endDate,
        subscriptionDetails: activeSubscription ? {
          planName: activeSubscription.planName,
          monthlyPrice: activeSubscription.monthlyPrice ?? 0,
          status: activeSubscription.status,
          startDate: activeSubscription.startDate?.toISOString() ?? null,
          endDate: activeSubscription.endDate?.toISOString() ?? null,
        } : null,
        creditBalance: creditBalance,
        ariaSubjects: [] // Placeholder for ARIA subjects
      };
    });

    return NextResponse.json({
      children: formattedChildren
    });

  } catch (error) {
    console.error('Error fetching parent subscriptions:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || session.user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    const parsedBody = parentSubscriptionRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid subscription payload' },
        { status: 400 }
      );
    }
    const { studentId, planName } = parsedBody.data;

    const plan = getOperationalSubscriptionPlan(planName);
    if (!plan) {
      return NextResponse.json(
        { error: 'Plan d’abonnement invalide' },
        { status: 400 }
      );
    }

    // Verify student belongs to parent
    const userId = session.user.id;
    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: userId },
    });

    if (!parentProfile) {
      return NextResponse.json(
        { error: 'Parent profile not found' },
        { status: 404 }
      );
    }

    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        parentId: parentProfile.id
      },
      include: {
        user: true
      }
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found or unauthorized' },
        { status: 404 }
      );
    }

    const subscriptionRequest = await prisma.subscriptionRequest.create({
      data: {
        studentId: studentId,
        requestType: 'PLAN_CHANGE',
        planName: planName,
        monthlyPrice: plan.price,
        reason: '',
        status: 'PENDING',
        requestedBy: `${session.user.firstName} ${session.user.lastName}`,
        requestedByEmail: session.user.email ?? ''
      }
    });

    const assistants = await prisma.user.findMany({
      where: { role: 'ASSISTANTE' }
    });

    await Promise.all(assistants.map((assistant) =>
      prisma.notification.create({
        data: {
          userId: assistant.id,
          userRole: 'ASSISTANTE',
          type: 'SUBSCRIPTION_REQUEST',
          title: 'Nouvelle demande d\'abonnement',
          message: `Nouvelle demande de changement de formule pour ${student.user.firstName} ${student.user.lastName}`,
          data: JSON.stringify({
            requestId: subscriptionRequest.id,
            studentId,
            studentName: `${student.user.firstName} ${student.user.lastName}`,
            requestType: 'PLAN_CHANGE',
            planName,
            monthlyPrice: plan.price
          })
        }
      })
    ));

    return NextResponse.json({
      success: true,
      requestId: subscriptionRequest.id,
      message: 'Demande d\'abonnement envoyée. En attente d\'approbation par l\'assistante.'
    });

  } catch (error) {
    console.error('Error creating subscription request:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
