import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma, SessionStatus } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { extractSessionListQuery, mapSessionToResponse, normalizeSessionListQuery, sessionResponseInclude } from './contracts';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsedQuery = extractSessionListQuery(searchParams);

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsedQuery.error.format() },
        { status: 400 }
      );
    }

    const { role, status, startDate, endDate } = normalizeSessionListQuery(parsedQuery.data);

    const where: Prisma.SessionBookingWhereInput = {};

    if (status) {
      where.status = status as SessionStatus;
    }

    if (startDate || endDate) {
      const scheduledDateFilter: Prisma.DateTimeFilter = {};
      if (startDate) scheduledDateFilter.gte = startDate;
      if (endDate) scheduledDateFilter.lte = endDate;
      where.scheduledDate = scheduledDateFilter;
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
      include: sessionResponseInclude,
      orderBy: [
        { scheduledDate: 'desc' },
        { startTime: 'desc' }
      ]
    });

    return NextResponse.json({ sessions: sessions.map(mapSessionToResponse) });

  } catch (error) {
    console.error('List sessions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

