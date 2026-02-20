export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { reportSubmissionSchema } from '@/lib/validation/session-report';
import { NotificationType, SessionStatus } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await auth();

    if (!session || session.user.role !== 'COACH') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const coachUserId = session.user.id;
    const { sessionId } = await params;

    const body = await request.json();
    const validationResult = reportSubmissionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input',
          details: validationResult.error.issues 
        },
        { status: 400 }
      );
    }

    const reportData = validationResult.data;

    const sessionBooking = await prisma.sessionBooking.findFirst({
      where: {
        id: sessionId,
      },
      include: {
        student: true,
        coach: true,
        parent: true,
      }
    });

    if (!sessionBooking) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (sessionBooking.coachId !== coachUserId) {
      return NextResponse.json(
        { error: 'Forbidden: You are not the coach for this session' },
        { status: 403 }
      );
    }

    if (!['CONFIRMED', 'IN_PROGRESS'].includes(sessionBooking.status)) {
      return NextResponse.json(
        { 
          error: 'Invalid session status',
          message: 'Only CONFIRMED or IN_PROGRESS sessions can have reports submitted' 
        },
        { status: 400 }
      );
    }

    const existingReport = await prisma.sessionReport.findUnique({
      where: { sessionId }
    });

    if (existingReport) {
      return NextResponse.json(
        { 
          error: 'Report already exists',
          message: 'A report has already been submitted for this session' 
        },
        { status: 409 }
      );
    }

    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: coachUserId }
    });

    if (!coachProfile) {
      return NextResponse.json(
        { error: 'Coach profile not found' },
        { status: 404 }
      );
    }

    const studentEntity = await prisma.student.findFirst({
      where: { userId: sessionBooking.studentId }
    });

    if (!studentEntity) {
      return NextResponse.json(
        { error: 'Student entity not found' },
        { status: 404 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const report = await tx.sessionReport.create({
        data: {
          sessionId: sessionId,
          studentId: studentEntity.id,
          coachId: coachProfile.id,
          summary: reportData.summary,
          topicsCovered: reportData.topicsCovered,
          performanceRating: reportData.performanceRating,
          progressNotes: reportData.progressNotes,
          recommendations: reportData.recommendations,
          attendance: reportData.attendance,
          engagementLevel: reportData.engagementLevel || null,
          homeworkAssigned: reportData.homeworkAssigned || null,
          nextSessionFocus: reportData.nextSessionFocus || null,
        }
      });

      await tx.sessionBooking.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.COMPLETED,
          completedAt: new Date(),
          coachNotes: reportData.summary,
          rating: reportData.performanceRating,
          studentAttended: reportData.attendance,
        }
      });

      const parentUserId = sessionBooking.parentId;
      if (parentUserId) {
        await tx.sessionNotification.create({
          data: {
            sessionId: sessionId,
            userId: parentUserId,
            type: NotificationType.SESSION_COMPLETED,
            title: 'Compte-rendu de session disponible',
            message: `Le coach a soumis le compte-rendu de la session de ${sessionBooking.subject} du ${sessionBooking.scheduledDate.toLocaleDateString('fr-FR')}.`,
          }
        });
      }

      return report;
    });

    setImmediate(async () => {
      try {
        const { sendSessionReportNotification } = await import('@/lib/email-service');
        if (sessionBooking.parent) {
          await sendSessionReportNotification(
            sessionBooking,
            sessionBooking.student,
            sessionBooking.coach,
            result,
            sessionBooking.parent.email
          );
        }
      } catch (emailError) {
        console.error('Failed to send session report email notification:', emailError);
      }
    });

    return NextResponse.json(
      { 
        success: true,
        reportId: result.id,
        message: 'Report submitted successfully' 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error submitting session report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId } = await params;

    const report = await prisma.sessionReport.findUnique({
      where: { sessionId },
      include: {
        student: true,
        coach: true,
        session: true,
      }
    });

    if (!report) {
      return NextResponse.json(
        { report: null },
        { status: 200 }
      );
    }

    const sessionBooking = await prisma.sessionBooking.findUnique({
      where: { id: sessionId }
    });

    if (!sessionBooking) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (
      sessionBooking.coachId !== session.user.id &&
      sessionBooking.studentId !== session.user.id &&
      sessionBooking.parentId !== session.user.id &&
      session.user.role !== 'ADMIN' &&
      session.user.role !== 'ASSISTANTE'
    ) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have access to this report' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { report },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error fetching session report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
