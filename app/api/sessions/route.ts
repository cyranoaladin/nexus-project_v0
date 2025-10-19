import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};

    if (status) where.status = status as any;
    if (startDate || endDate) {
      where.scheduledDate = {} as any;
      if (startDate) (where.scheduledDate as any).gte = new Date(startDate);
      if (endDate) (where.scheduledDate as any).lte = new Date(endDate);
    }

    // Scope by role
    if (role === 'assistant') {
      // Assistante can list all sessions
    } else if (role === 'coach') {
      where.coachId = session.user.id;
    } else if (role === 'student') {
      where.studentId = session.user.id;
    } else if (role === 'parent') {
      where.parentId = session.user.id;
    } else {
      // Default: only own sessions by role
      switch (session.user.role) {
        case 'COACH':
          where.coachId = session.user.id; break;
        case 'ELEVE':
          where.studentId = session.user.id; break;
        case 'PARENT':
          where.parentId = session.user.id; break;
        case 'ASSISTANTE':
          // no extra filters
          break;
        default:
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const sessions = await prisma.sessionBooking.findMany({
      where,
      include: {
        student: true,
        coach: true,
        parent: true,
      },
      orderBy: [
        { scheduledDate: 'desc' },
        { startTime: 'desc' }
      ]
    });

    const formatted = sessions.map((s: any) => ({
      id: s.id,
      title: s.title,
      subject: s.subject,
      scheduledDate: s.scheduledDate,
      startTime: s.startTime,
      endTime: s.endTime,
      duration: s.duration,
      status: s.status,
      type: s.type,
      modality: s.modality,
      creditsUsed: s.creditsUsed,
      student: { id: s.studentId, firstName: s.student?.firstName ?? '', lastName: s.student?.lastName ?? '' },
      coach: { id: s.coachId, firstName: s.coach?.firstName ?? '', lastName: s.coach?.lastName ?? '' },
      parent: s.parentId ? { id: s.parentId, firstName: s.parent?.firstName ?? '', lastName: s.parent?.lastName ?? '' } : null,
      createdAt: s.createdAt,
    }));

    return NextResponse.json({ sessions: formatted });

  } catch (error) {
    console.error('List sessions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

