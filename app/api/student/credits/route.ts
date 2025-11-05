import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ELEVE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const studentId = session.user.id;

    const student = await prisma.student.findUnique({
      where: { userId: studentId },
      include: {
        creditTransactions: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    // Calculate current balance
    type StudentWithTransactions = Prisma.StudentGetPayload<{
      include: {
        creditTransactions: true;
      };
    }>;

    const typedStudent = student as StudentWithTransactions;

    const balance = typedStudent.creditTransactions.reduce((total, transaction) => total + transaction.amount, 0);

    const formattedTransactions = typedStudent.creditTransactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      sessionId: transaction.sessionId,
      expiresAt: transaction.expiresAt,
      createdAt: transaction.createdAt
    }));

    return NextResponse.json({
      balance,
      transactions: formattedTransactions
    });

  } catch (error) {
    console.error('Error fetching student credits:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 