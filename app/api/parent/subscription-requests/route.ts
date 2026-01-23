import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      studentId?: string;
      requestType?: 'PLAN_CHANGE' | 'ARIA_ADDON' | 'INVOICE_DETAILS';
      planName?: string | null;
      monthlyPrice?: number;
      reason?: string;
    };
    const { studentId, requestType, planName, monthlyPrice, reason } = body;

    if (!studentId || !requestType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Create subscription change request
    const subscriptionRequest = await prisma.subscriptionRequest.create({
      data: {
        studentId: studentId,
        requestType: requestType, // PLAN_CHANGE, ARIA_ADDON, INVOICE_DETAILS
        planName: planName || null,
        monthlyPrice: monthlyPrice || 0,
        reason: reason || '',
        status: 'PENDING',
        requestedBy: `${session.user.firstName} ${session.user.lastName}`,
        requestedByEmail: session.user.email
      }
    });

    // Create notifications for all assistants
    const assistants = await prisma.user.findMany({
      where: {
        role: 'ASSISTANTE'
      }
    });

    const notificationPromises = assistants.map((assistant) =>
      prisma.notification.create({
        data: {
          userId: assistant.id,
          userRole: 'ASSISTANTE',
          type: 'SUBSCRIPTION_REQUEST',
          title: 'Nouvelle demande d\'abonnement',
          message: `Nouvelle demande de ${requestType === 'PLAN_CHANGE' ? 'changement de formule' : 'service ARIA+'} pour ${student.user.firstName} ${student.user.lastName}`,
          data: JSON.stringify({
            requestId: subscriptionRequest.id,
            studentId: studentId,
            studentName: `${student.user.firstName} ${student.user.lastName}`,
            requestType: requestType,
            planName: planName,
            monthlyPrice: monthlyPrice
          })
        }
      })
    );

    await Promise.all(notificationPromises);

    return NextResponse.json({
      success: true,
      message: 'Demande envoyée à l\'assistant. Vous recevrez une notification une fois traitée.',
      requestId: subscriptionRequest.id
    });

  } catch (error) {
    console.error('Error creating subscription request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json(
        { error: 'Student ID is required' },
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

    // Get subscription requests for this student
    const requests = await prisma.subscriptionRequest.findMany({
      where: {
        studentId: studentId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      requests: requests
    });

  } catch (error) {
    console.error('Error fetching subscription requests:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
