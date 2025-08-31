import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
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

    const formattedCoaches = coaches.map((coach: any) => ({
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
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type invalide. Utilisez application/json.' }, { status: 415 });
    }
    let raw = '';
    try { raw = await request.text(); } catch { raw = ''; }
    if (!raw || raw.trim().length === 0) {
      return NextResponse.json({ error: 'Requête invalide: corps vide.' }, { status: 400 });
    }
    let body: any;
    try { body = JSON.parse(raw); } catch {
      return NextResponse.json({ error: 'Requête invalide: JSON mal formé.' }, { status: 400 });
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
    const result = await prisma.$transaction(async (tx: any) => {
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
          subjects: JSON.stringify(subjects || []),
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