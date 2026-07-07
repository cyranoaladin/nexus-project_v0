import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import type { CreditTransaction } from '@prisma/client';
import { normalizeStudentLevelAndTrack } from '@/lib/utils/grade-utils';
import crypto from 'crypto';
import { z } from 'zod';

const createChildSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  grade: z.string().trim().min(1).max(80),
  school: z.string().trim().max(120).optional().default(''),
}).strict();

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();

    if (!session || session.user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // First get the parent profile
    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: userId },
    });

    if (!parentProfile) {
      return NextResponse.json(
        { error: 'Parent profile not found' },
        { status: 404 }
      );
    }

    const children = await prisma.student.findMany({
      where: { parentId: parentProfile.id },
      include: {
        user: true,
        creditTransactions: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        sessions: {
          where: {
            scheduledAt: {
              gte: new Date()
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
            scheduledAt: 'asc'
          }
        }
      }
    });

    const formattedChildren = children.map((child) => {
      const creditBalance = child.creditTransactions.reduce((total: number, transaction: CreditTransaction) => {
        return total + transaction.amount;
      }, 0);

      return {
        id: child.id,
        firstName: child.user.firstName,
        lastName: child.user.lastName,
        email: child.user.email,
        grade: child.grade,
        school: child.school,
        creditBalance: creditBalance,
        upcomingSessions: child.sessions.length,
        createdAt: child.createdAt
      };
    });

    return NextResponse.json(formattedChildren);

  } catch (error) {
    console.error('Error fetching children:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || session.user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    const parsedBody = createChildSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid child payload' },
        { status: 400 }
      );
    }
    const { firstName, lastName, grade, school } = parsedBody.data;

    // Generate email in the same format as bilan-gratuit
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@nexus-student.local`;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Un enfant avec ce nom existe déjà' },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // First get the parent profile
    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: userId },
    });

    if (!parentProfile) {
      return NextResponse.json(
        { error: 'Parent profile not found' },
        { status: 404 }
      );
    }

    // Normaliser le niveau scolaire
    const gTrack = normalizeStudentLevelAndTrack(grade);
    if (!gTrack) {
      return NextResponse.json(
        { error: `Niveau scolaire non reconnu : ${grade}` },
        { status: 400 }
      );
    }

    // Générer un token d'activation unique (validité 72h)
    const rawActivationToken = `act_${crypto.randomBytes(16).toString('hex')}`;
    const hashedActivationToken = crypto.createHash('sha256').update(rawActivationToken).digest('hex');
    const activationExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000);

    // Create child in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user in inactive state. The student chooses a password later via activation.
      const user = await tx.user.create({
        data: {
          email,
          password: null,
          firstName,
          lastName,
          role: 'ELEVE',
          activatedAt: null,
          activationToken: hashedActivationToken,
          activationExpiry: activationExpiry,
        }
      });

      // Create student
      const student = await tx.student.create({
        data: {
          userId: user.id,
          parentId: parentProfile.id,
          gradeLevel: gTrack.level,
          academicTrack: gTrack.track,
          grade,
          school: school || ''
        },
        include: {
          user: true
        }
      });

      return student;
    });

    const baseUrl = process.env.NEXTAUTH_URL || 'https://nexusreussite.academy';
    const activationUrl = `${baseUrl}/auth/activate?token=${encodeURIComponent(rawActivationToken)}`;

    return NextResponse.json({
      success: true,
      child: {
        id: result.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        email: result.user.email,
        grade: result.grade,
        school: result.school
      },
      activation: {
        activationUrl,
        expiresAt: activationExpiry.toISOString(),
        message: "Lien d'activation généré pour le parent authentifié. À transmettre uniquement à l'élève concerné."
      }
    });

  } catch (error) {
    console.error('Error creating child:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
