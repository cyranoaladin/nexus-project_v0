export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

type PlanningEventSource = 'SESSION_BOOKING' | 'STAGE_SESSION';

type PlanningEvent = {
  id: string;
  source: PlanningEventSource;
  title: string;
  subject: string;
  startAt: string;
  endAt: string;
  location: string | null;
  status?: string;
  stage?: { id: string; title: string; slug: string } | null;
  student?: { id: string; firstName: string | null; lastName: string | null } | null;
  coach?: { id: string; firstName: string | null; lastName: string | null; pseudonym: string | null } | null;
};

function parseLocalDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((v) => parseInt(v, 10));
  if (!y || !m || !d) {
    throw new Error('Invalid date format');
  }
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date value');
  }
  return date;
}

function combineDateAndTime(date: Date, time: string): Date {
  const [h, m] = time.split(':').map((v) => parseInt(v, 10));
  const dt = new Date(date);
  dt.setHours(Number.isNaN(h) ? 0 : h, Number.isNaN(m) ? 0 : m, 0, 0);
  return dt;
}

export async function GET(req: NextRequest) {
  const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
  if (sessionOrError instanceof NextResponse) return sessionOrError;

  try {
    const sp = req.nextUrl.searchParams;
    const fromStr = sp.get('from');
    const toStr = sp.get('to');
    const studentId = sp.get('studentId');
    const includeStages = sp.get('includeStages') !== 'false';
    const includeSessions = sp.get('includeSessions') !== 'false';

    if (!fromStr || !toStr) {
      return NextResponse.json(
        { error: 'Missing required query params: from, to' },
        { status: 400 }
      );
    }

    const from = parseLocalDateOnly(fromStr);
    from.setHours(0, 0, 0, 0);
    const to = parseLocalDateOnly(toStr);
    to.setHours(23, 59, 59, 999);

    const maxRangeDays = 45;
    const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    if (rangeDays > maxRangeDays) {
      return NextResponse.json(
        { error: `Date range too large (max ${maxRangeDays} days)` },
        { status: 400 }
      );
    }

    let studentUserId: string | null = null;
    if (studentId) {
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { userId: true },
      });
      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }
      studentUserId = student.userId;
    }

    const [stageSessions, sessionBookings] = await Promise.all([
      includeStages
        ? prisma.stageSession.findMany({
            where: {
              startAt: { gte: from, lte: to },
              ...(studentId
                ? {
                    stage: {
                      reservations: {
                        some: {
                          studentId,
                          NOT: [{ richStatus: 'CANCELLED' }, { status: 'CANCELLED' }],
                        },
                      },
                    },
                  }
                : {}),
            },
            include: {
              stage: { select: { id: true, title: true, slug: true } },
              coach: { select: { id: true, pseudonym: true, user: { select: { firstName: true, lastName: true } } } },
            },
            orderBy: { startAt: 'asc' },
          })
        : Promise.resolve([]),
      includeSessions
        ? prisma.sessionBooking.findMany({
            where: {
              scheduledDate: { gte: from, lte: to },
              ...(studentUserId ? { studentId: studentUserId } : {}),
            },
            include: {
              student: { select: { id: true, firstName: true, lastName: true } },
              coach: { select: { id: true, firstName: true, lastName: true, coachProfile: { select: { pseudonym: true } } } },
            },
            orderBy: [{ scheduledDate: 'asc' }, { startTime: 'asc' }],
          })
        : Promise.resolve([]),
    ]);

    const events: PlanningEvent[] = [];

    for (const s of stageSessions) {
      events.push({
        id: `stageSession:${s.id}`,
        source: 'STAGE_SESSION',
        title: s.title,
        subject: String(s.subject),
        startAt: s.startAt.toISOString(),
        endAt: s.endAt.toISOString(),
        location: s.location ?? null,
        stage: s.stage ? { id: s.stage.id, title: s.stage.title, slug: s.stage.slug } : null,
        coach: s.coach
          ? {
              id: s.coach.id,
              firstName: s.coach.user?.firstName ?? null,
              lastName: s.coach.user?.lastName ?? null,
              pseudonym: s.coach.pseudonym ?? null,
            }
          : null,
      });
    }

    for (const b of sessionBookings) {
      const startAt = combineDateAndTime(b.scheduledDate, b.startTime);
      const endAt = combineDateAndTime(b.scheduledDate, b.endTime);
      events.push({
        id: `sessionBooking:${b.id}`,
        source: 'SESSION_BOOKING',
        title: b.title,
        subject: String(b.subject),
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        location: b.location ?? null,
        status: String(b.status),
        student: b.student ? { id: b.student.id, firstName: b.student.firstName ?? null, lastName: b.student.lastName ?? null } : null,
        coach: b.coach
          ? {
              id: b.coach.id,
              firstName: b.coach.firstName ?? null,
              lastName: b.coach.lastName ?? null,
              pseudonym: b.coach.coachProfile?.pseudonym ?? null,
            }
          : null,
      });
    }

    events.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      events,
    });
  } catch (error) {
    console.error('[GET /api/assistante/planning]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

