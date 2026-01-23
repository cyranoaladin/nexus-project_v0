import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { CreditTransaction } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (studentId) {
      // Get specific student credits
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
          user: true,
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

      const creditBalance = student.creditTransactions.reduce((total: number, transaction: CreditTransaction) => {
        return total + transaction.amount;
      }, 0);

      return NextResponse.json({
        student: {
          id: student.id,
          firstName: student.user.firstName,
          lastName: student.user.lastName,
          email: student.user.email,
          grade: student.grade,
          school: student.school
        },
        creditBalance,
        transactions: student.creditTransactions.map((transaction: CreditTransaction) => ({
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          createdAt: transaction.createdAt
        }))
      });
    } else {
      // Get all students with credit balances
      const students = await prisma.student.findMany({
        include: {
          user: true,
          creditTransactions: true
        }
      });

      const studentsWithCredits = students.map((student) => {
        const creditBalance = student.creditTransactions.reduce((total: number, transaction: CreditTransaction) => {
          return total + transaction.amount;
        }, 0);

        return {
          id: student.id,
          firstName: student.user.firstName,
          lastName: student.user.lastName,
          email: student.user.email,
          grade: student.grade,
          school: student.school,
          creditBalance
        };
      });

      return NextResponse.json(studentsWithCredits);
    }

  } catch (error) {
    console.error('Error fetching student credits:', error);
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

    const body = await request.json();
    const { studentId, amount, type, description } = body;

    if (!studentId || !amount || !type || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    // Create credit transaction
    const transaction = await prisma.creditTransaction.create({
      data: {
        studentId,
        type,
        amount: parseFloat(amount),
        description: `${description} (par ${session.user.firstName} ${session.user.lastName})`
      },
      include: {
        student: {
          include: {
            user: true
          }
        }
      }
    });

    // Calculate new balance
    const allTransactions = await prisma.creditTransaction.findMany({
      where: { studentId }
    });

    const newBalance = allTransactions.reduce((total: number, t: CreditTransaction) => {
      return total + t.amount;
    }, 0);

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        createdAt: transaction.createdAt
      },
      newBalance,
      student: {
        firstName: transaction.student.user.firstName,
        lastName: transaction.student.user.lastName
      }
    });

  } catch (error) {
    console.error('Error adding student credits:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
