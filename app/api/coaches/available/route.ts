export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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

    /**
     * Parse the subjects Json field safely.
     * It may be stored as a real JSON array or a string-encoded JSON array.
     */
    function parseSubjects(raw: unknown): string[] {
      if (Array.isArray(raw)) return raw as string[];
      if (typeof raw === 'string') {
        try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
      }
      return [];
    }

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
