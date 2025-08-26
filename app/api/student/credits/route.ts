export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const studentId = session.user.id;

    const student = await prisma.student.findUnique({
      where: { userId: studentId },
      include: {
        creditTransactions: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Calculate current balance
    const balance = student.creditTransactions.reduce((total: number, transaction: any) => {
      return total + transaction.amount;
    }, 0);

    const formattedTransactions = student.creditTransactions.map((transaction: any) => ({
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      sessionId: transaction.sessionId,
      expiresAt: transaction.expiresAt,
      createdAt: transaction.createdAt,
    }));

    return NextResponse.json({
      balance,
      transactions: formattedTransactions,
    });
  } catch (error) {
    console.error('Error fetching student credits:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
