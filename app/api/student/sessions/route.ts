import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ELEVE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const studentId = session.user.id;

    const sessions = await prisma.sessionBooking.findMany({
      where: {
        studentId: studentId
      },
      orderBy: [
        { scheduledDate: 'desc' },
        { startTime: 'desc' }
      ]
    });

    const formattedSessions = sessions.map((session: any) => ({
      id: session.id,
      title: session.title,
      subject: session.subject,
      status: session.status,
      scheduledAt: new Date(`${session.scheduledDate.toISOString().split('T')[0]}T${session.startTime}`),
      duration: session.duration,
      creditsUsed: session.creditsUsed,
      modality: session.modality,
      type: session.type
    }));

    return NextResponse.json(formattedSessions);

  } catch (error) {
    console.error('Error fetching student sessions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
