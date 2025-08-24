export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const allowBypass = process.env.E2E === '1' || process.env.E2E_RUN === '1' || process.env.NEXT_PUBLIC_E2E === '1' || process.env.NODE_ENV === 'development';

    if (!allowBypass && (!session || (session.user.role !== 'ELEVE' && session.user.role !== 'PARENT'))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');
    const date = searchParams.get('date');

    // Build where clause for coaches
    const whereClause: any = {};

    if (subject) {
      whereClause.subjects = {
        contains: subject
      };
    }

    const coaches = await prisma.coachProfile.findMany({
      where: whereClause,
      include: {
        user: {
          include: {
            coachAvailabilities: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const dayFilter = date ? new Date(date).getDay() : undefined;
    const formattedCoaches = coaches.map((coach: any) => ({
      id: coach.userId,
      firstName: coach.user.firstName,
      lastName: coach.user.lastName,
      coachSubjects: JSON.parse(coach.subjects || '[]'), // Parse the JSON string to match component interface
      availability: coach.user.coachAvailabilities.filter((a: any) => (dayFilter === undefined ? true : a.dayOfWeek === dayFilter)),
      bio: coach.description,
      philosophy: coach.philosophy,
      expertise: coach.expertise
    }));

    return NextResponse.json({
      success: true,
      coaches: formattedCoaches
    });

  } catch (error) {
    console.error('Error fetching available coaches:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
