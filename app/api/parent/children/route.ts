import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import type { CreditTransaction } from '@prisma/client';
// bcrypt inutilisé ici

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

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
    console.error('Error fetching children:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      grade,
      school
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !grade) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

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

    // Get parent's password to use for the child
    const parentUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!parentUser || !parentUser.password) {
      return NextResponse.json(
        { error: 'Parent password not found' },
        { status: 404 }
      );
    }

    // Create child in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user with parent's password
      const user = await tx.user.create({
        data: {
          email,
          password: parentUser.password, // Use parent's password
          firstName,
          lastName,
          role: 'ELEVE'
        }
      });

      // Create student
      const student = await tx.student.create({
        data: {
          userId: user.id,
          parentId: parentProfile.id,
          grade,
          school: school || ''
        },
        include: {
          user: true
        }
      });

      return student;
    });

    return NextResponse.json({
      success: true,
      child: {
        id: result.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        email: result.user.email,
        grade: result.grade,
        school: result.school
      }
    });

  } catch (error) {
    console.error('Error creating child:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
