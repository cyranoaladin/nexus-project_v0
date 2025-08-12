import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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

    const sessions = await prisma.session.findMany({
      where: {
        student: {
          userId: studentId
        }
      },
      include: {
        coach: {
          include: {
            user: true
          }
        }
      },
      orderBy: {
        scheduledAt: 'desc'
      }
    });

    const formattedSessions = sessions.map((session: any) => ({
      id: session.id,
      title: session.title,
      subject: session.subject,
      status: session.status,
      scheduledAt: session.scheduledAt,
      duration: session.duration,
      creditCost: session.creditCost,
      location: session.location,
      coach: {
        firstName: session.coach.user.firstName,
        lastName: session.coach.user.lastName,
        pseudonym: session.coach.pseudonym,
        tag: session.coach.tag
      }
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