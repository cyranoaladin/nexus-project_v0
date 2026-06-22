export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { SUBSCRIPTION_PLANS } from '@/lib/constants';

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
    console.error('Error fetching parent subscriptions:', error);
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

    const body = (await request.json()) as {
      studentId?: string;
      planName?: string;
      monthlyPrice?: number;
      creditsPerMonth?: number;
    };
    const { studentId, planName } = body;

    if (!studentId || !planName) {
      return NextResponse.json(
        { error: 'Missing required fields: studentId, planName' },
        { status: 400 }
      );
    }

    const plan = SUBSCRIPTION_PLANS[planName as keyof typeof SUBSCRIPTION_PLANS];
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
        monthlyPrice: plan.price,
        creditsPerMonth: plan.credits,
        status: 'INACTIVE', // Will be activated by assistant
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        ariaSubjects: '[]', // Default empty array
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
