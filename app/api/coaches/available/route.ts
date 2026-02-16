export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ELEVE' && session.user.role !== 'PARENT' ) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');
    const date = searchParams.get('date');

    // Build where clause for coaches
    const whereClause: Prisma.CoachProfileWhereInput = {};

    if (subject) {
      whereClause.subjects = {
        array_contains: [subject]
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

    const formattedCoaches = coaches.map((coach) => ({
      id: coach.userId, // Use userId as the coach ID for consistency
      firstName: coach.user.firstName,
      lastName: coach.user.lastName,
      coachSubjects: (coach.subjects as unknown as string[] ?? []),
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
