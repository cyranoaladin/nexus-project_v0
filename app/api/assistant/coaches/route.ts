export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['ASSISTANTE', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const coaches = await prisma.coachProfile.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: true },
      take: 200,
    });

    return NextResponse.json({ coaches });
  } catch (error) {
    console.error('GET /api/assistant/coaches error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      availableInPerson,
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !pseudonym) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    // Check if pseudonym already exists
    const existingCoach = await prisma.coachProfile.findUnique({
      where: { pseudonym },
    });

    if (existingCoach) {
      return NextResponse.json({ error: 'Pseudonym already exists' }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create coach in transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role: 'COACH',
        },
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
          subjects: JSON.stringify(subjects || []),
          availableOnline: availableOnline ?? true,
          availableInPerson: availableInPerson ?? true,
        },
        include: {
          user: true,
        },
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
        tag: result.tag,
      },
    });
  } catch (error) {
    console.error('Error creating coach:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
