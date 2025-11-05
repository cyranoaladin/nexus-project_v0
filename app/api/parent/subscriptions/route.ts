import { Prisma, SubscriptionStatus } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  DEFAULT_PREMIUM_SUBJECTS,
  getAriaAccessSnapshot,
  serializeSubjects
} from '@/lib/aria-access';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
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

    type StudentWithRelations = Prisma.StudentGetPayload<{
      include: {
        user: true;
        subscriptions: true;
        creditTransactions: true;
      };
    }>;

    const formattedChildren = children.map((child: StudentWithRelations) => {
      const creditBalance = child.creditTransactions.reduce((total, transaction) => total + transaction.amount, 0);

      const activeSubscription =
        child.subscriptions.find((sub) => sub.status === SubscriptionStatus.ACTIVE) ??
        child.subscriptions.find((sub) => sub.status === SubscriptionStatus.INACTIVE) ??
        null;

      const ariaAccess = getAriaAccessSnapshot(child);

      return {
        id: child.id,
        firstName: child.user.firstName,
        lastName: child.user.lastName,
        grade: child.grade,
        school: child.school,
        currentSubscription: activeSubscription?.planName ?? 'AUCUN',
        subscriptionStatus: activeSubscription?.status ?? SubscriptionStatus.INACTIVE,
        subscriptionExpiry: activeSubscription?.endDate ?? null,
        creditBalance,
        aria: {
          status: ariaAccess.status,
          subjects: ariaAccess.subjects,
          freemium: {
            tokensGranted: ariaAccess.freemium.tokensGranted,
            tokensUsed: ariaAccess.freemium.tokensUsed,
            remaining: ariaAccess.freemium.remaining,
            expiresAt: ariaAccess.freemium.expiresAt
              ? ariaAccess.freemium.expiresAt.toISOString()
              : null
          },
          activatedAt: ariaAccess.activatedAt ? ariaAccess.activatedAt.toISOString() : null,
          lastInteractionAt: ariaAccess.lastInteractionAt ? ariaAccess.lastInteractionAt.toISOString() : null
        }
      };
    });

    return NextResponse.json({
      children: formattedChildren
    });

  } catch (error) {
    console.error('Error fetching parent subscriptions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('Received subscription request:', body);
    const { studentId, planName, monthlyPrice, creditsPerMonth } = body;

    if (!studentId || !planName || !monthlyPrice) {
      console.log('Missing fields:', { studentId, planName, monthlyPrice });
      return NextResponse.json(
        { error: 'Missing required fields', received: body },
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
      }
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found or unauthorized' },
        { status: 404 }
      );
    }

    // Create subscription request
    const subscription = await prisma.subscription.create({
      data: {
        studentId: studentId,
        planName: planName,
        monthlyPrice: monthlyPrice,
        creditsPerMonth: creditsPerMonth || 0,
        status: 'INACTIVE', // Will be activated by assistant
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          ariaSubjects: serializeSubjects(DEFAULT_PREMIUM_SUBJECTS),
        ariaCost: 0 // Default cost
      },
      include: {
        student: {
          include: {
            user: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        planName: subscription.planName,
        status: subscription.status,
        message: 'Demande d\'abonnement envoyée. En attente d\'approbation par l\'assistant.'
      }
    });

  } catch (error) {
    console.error('Error creating subscription request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 