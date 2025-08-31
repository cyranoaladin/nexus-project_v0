export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ELEVE' && session.user.role !== 'PARENT') {
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
            coachAvailabilities: {
              where: {
                dayOfWeek: date ? new Date(date).getDay() : undefined
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedCoaches = coaches.map((coach: any) => ({
      id: coach.userId, // Use userId as the coach ID for consistency
      firstName: coach.user.firstName,
      lastName: coach.user.lastName,
      coachSubjects: JSON.parse(coach.subjects || '[]'), // Parse the JSON string to match component interface
      availability: coach.user.coachAvailabilities,
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
