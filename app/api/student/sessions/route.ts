export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

function combineDateTime(date: Date, time: string): Date {
  const dateStr = date.toISOString().split('T')[0];
  return new Date(`${dateStr}T${time}`);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Prefer SessionBooking
    const bookings = await prisma.sessionBooking.findMany({
      where: { studentId: userId },
      include: {
        coach: { include: { coachProfile: true } },
      },
      orderBy: [{ scheduledDate: 'desc' }, { startTime: 'desc' }],
    });

    if (bookings.length > 0) {
      const data = bookings.map((b) => ({
        id: b.id,
        title: b.title,
        subject: b.subject,
        status: b.status as any,
        scheduledAt: combineDateTime(b.scheduledDate, b.startTime),
        duration: b.duration,
        creditCost: b.creditsUsed,
        location: b.location,
        coach: {
          firstName: b.coach.firstName,
          lastName: b.coach.lastName,
          pseudonym: (b.coach as any).coachProfile?.pseudonym,
          tag: (b.coach as any).coachProfile?.tag,
        },
      }));
      return NextResponse.json(data);
    }

    // Fallback to legacy Session
    const sessions = await prisma.session.findMany({
      where: { student: { userId } },
      include: { coach: { include: { user: true } } },
      orderBy: { scheduledAt: 'desc' },
    });

    const formattedSessions = sessions.map((s: any) => ({
      id: s.id,
      title: s.title,
      subject: s.subject,
      status: s.status,
      scheduledAt: s.scheduledAt,
      duration: s.duration,
      creditCost: s.creditCost,
      location: s.location,
      coach: {
        firstName: s.coach.user.firstName,
        lastName: s.coach.user.lastName,
        pseudonym: s.coach.pseudonym,
        tag: s.coach.tag,
      },
    }));

    return NextResponse.json(formattedSessions);
  } catch (error) {
    console.error('Error fetching student sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
