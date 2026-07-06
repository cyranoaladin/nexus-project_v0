import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import type { CreditTransaction } from '@prisma/client';
import { z } from 'zod';

const ALLOWED_STAFF_CREDIT_TYPES = new Set([
  'CREDIT_ADD',
  'CREDIT_REFUND',
  'MANUAL_ADJUSTMENT',
  'MONTHLY_ALLOCATION',
]);
const staffCreditTypeSchema = z.enum([
  'CREDIT_ADD',
  'CREDIT_REFUND',
  'MANUAL_ADJUSTMENT',
  'MONTHLY_ALLOCATION',
]);
const idSchema = z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/);
const studentCreditsQuerySchema = z.object({
  studentId: idSchema.optional(),
}).strict();
const addStudentCreditsSchema = z.object({
  studentId: idSchema,
  amount: z.coerce.number().finite().positive().max(1000),
  type: staffCreditTypeSchema,
  description: z.string().trim().min(1).max(500),
}).strict();

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsedQuery = studentCreditsQuerySchema.safeParse({
      studentId: searchParams.get('studentId') ?? undefined,
    });
    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }
    const { studentId } = parsedQuery.data;

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
    console.error('Error fetching student credits:', serializeError(error));
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

    const rawBody = await request.json().catch(() => null);
    const parsedBody = addStudentCreditsSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid credit payload' },
        { status: 400 }
      );
    }
    const { studentId, amount, type, description } = parsedBody.data;

    if (!ALLOWED_STAFF_CREDIT_TYPES.has(type)) {
      return NextResponse.json(
        { error: 'Invalid credit type' },
        { status: 400 }
      );
    }

    const parsedAmount = amount;
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid credit amount' },
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
        amount: parsedAmount,
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
    console.error('Error adding student credits:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
