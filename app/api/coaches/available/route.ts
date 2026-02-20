export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { parseSubjects } from '@/lib/utils/subjects';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || session.user.role !== 'ELEVE' && session.user.role !== 'PARENT' ) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');
    const date = searchParams.get('date');

    // Fetch all coaches (subject filtering done in JS to avoid @> on Json column)
    const coaches = await prisma.coachProfile.findMany({
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

    const formattedCoaches = coaches
      .filter((coach) => {
        if (!subject) return true;
        const subs = parseSubjects(coach.subjects);
        return subs.includes(subject);
      })
      .map((coach) => ({
        id: coach.userId, // Use userId as the coach ID for consistency
        firstName: coach.user.firstName,
        lastName: coach.user.lastName,
        coachSubjects: parseSubjects(coach.subjects),
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
