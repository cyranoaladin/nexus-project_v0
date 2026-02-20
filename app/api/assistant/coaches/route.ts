export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const coaches = await prisma.coachProfile.findMany({
      include: {
        user: true,
        sessions: {
          where: {
            scheduledAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)) // Today
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedCoaches = coaches.map((coach) => ({
      id: coach.id,
      userId: coach.userId,
      firstName: coach.user.firstName,
      lastName: coach.user.lastName,
      email: coach.user.email,
      pseudonym: coach.pseudonym,
      tag: coach.tag,
      description: coach.description,
      philosophy: coach.philosophy,
      expertise: coach.expertise,
      subjects: coach.subjects,
      availableOnline: coach.availableOnline,
      availableInPerson: coach.availableInPerson,
      todaySessions: coach.sessions.length,
      createdAt: coach.createdAt
    }));

    return NextResponse.json(formattedCoaches);

  } catch (error) {
    console.error('Error fetching coaches:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      password,
      pseudonym,
      tag,
      description,
      philosophy,
      expertise,
      subjects,
      availableOnline,
      availableInPerson
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !pseudonym) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Check if pseudonym already exists
    const existingCoach = await prisma.coachProfile.findUnique({
      where: { pseudonym }
    });

    if (existingCoach) {
      return NextResponse.json(
        { error: 'Pseudonym already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create coach in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role: 'COACH'
        }
      });

      // Create coach profile
      const coach = await tx.coachProfile.create({
        data: {
          userId: user.id,
          pseudonym,
          tag,
          description,
          philosophy,
          expertise,
          subjects: subjects || [],
          availableOnline: availableOnline ?? true,
          availableInPerson: availableInPerson ?? true
        },
        include: {
          user: true
        }
      });

      return coach;
    });

    return NextResponse.json({
      success: true,
      coach: {
        id: result.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        email: result.user.email,
        pseudonym: result.pseudonym,
        tag: result.tag
      }
    });

  } catch (error) {
    console.error('Error creating coach:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
