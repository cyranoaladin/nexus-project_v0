export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Subject } from '@/types/enums';

const coachCreateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  pseudonym: z.string().min(1),
  tag: z.string().optional(),
  description: z.string().optional(),
  philosophy: z.string().optional(),
  expertise: z.string().optional(),
  subjects: z.array(z.nativeEnum(Subject)).optional().default([]),
  availableOnline: z.boolean().optional(),
  availableInPerson: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const coaches = await prisma.coachProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
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
      coachSubjects: typeof coach.subjects === 'string' ? JSON.parse(coach.subjects) : (coach.subjects ?? []),
      availableOnline: coach.availableOnline,
      availableInPerson: coach.availableInPerson,
      todaySessions: coach.sessions.length,
      createdAt: coach.createdAt
    }));

    return NextResponse.json({ coaches: formattedCoaches });

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
    
    if (!session || !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const parsed = coachCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid coach payload', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
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
    } = parsed.data;

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
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
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
