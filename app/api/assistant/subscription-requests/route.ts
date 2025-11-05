import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import {
  activateAriaSubscription,
  DEFAULT_PREMIUM_SUBJECTS,
  serializeSubjects
} from '@/lib/aria-access';

type SubscriptionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all subscription requests with student information
    const requests = await prisma.subscriptionRequest.findMany({
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format the response
    const formattedRequests = requests.map(request => ({
      id: request.id,
      studentId: request.studentId,
      planName: request.planName,
      monthlyPrice: request.monthlyPrice,
      creditsPerMonth: 0,
      status: request.status,
      notes: request.rejectionReason ?? request.reason ?? null,
      createdAt: request.createdAt.toISOString(),
      student: request.student ? {
        firstName: request.student.user.firstName,
        lastName: request.student.user.lastName,
        email: request.student.user.email
      } : null
    }));

    return NextResponse.json(formattedRequests);

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId, action, notes } = await request.json();
    if (!requestId || !action) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const current = await prisma.subscriptionRequest.findUnique({ where: { id: requestId } });
    if (!current) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const status: SubscriptionRequestStatus = action === 'APPROVED'
      ? 'APPROVED'
      : action === 'REJECTED'
        ? 'REJECTED'
        : 'PENDING';
    const updated = await prisma.subscriptionRequest.update({
      where: { id: requestId },
      data: {
        status,
        processedBy: session.user.id,
        processedAt: new Date(),
        ...(status === 'REJECTED' ? { rejectionReason: notes ?? current.rejectionReason } : {})
      }
    });

    if (status === 'APPROVED') {
      const start = new Date();
      const end = new Date();
      end.setMonth(end.getMonth() + 1);
      const subjects = DEFAULT_PREMIUM_SUBJECTS;

      await prisma.subscription.create({
        data: {
          studentId: current.studentId,
          planName: current.planName!,
          monthlyPrice: current.monthlyPrice,
          creditsPerMonth: 0,
          status: 'ACTIVE',
          startDate: start,
          endDate: end,
          ariaSubjects: serializeSubjects(subjects),
          ariaCost: 0,
        }
      });
      await prisma.subscription.updateMany({ where: { studentId: current.studentId, status: 'INACTIVE' }, data: { status: 'CANCELLED' } });

      await activateAriaSubscription({
        studentId: current.studentId,
        subjects
      });
    }

    return NextResponse.json({ success: true, request: updated });
  } catch (error) {
    console.error('Error updating subscription request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
