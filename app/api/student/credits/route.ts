export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { RateLimitPresets } from '@/lib/middleware/rateLimit';
import { createLogger } from '@/lib/middleware/logger';
import { successResponse, handleApiError } from '@/lib/api/errors';
import { assertExists } from '@/lib/api/helpers';
import type { CreditTransaction } from '@prisma/client';
import { UserRole } from '@/types/enums';

/**
 * GET /api/student/credits - Get credit balance and transaction history
 */
export async function GET(request: NextRequest) {
  let logger = createLogger(request);

  try {
    // Rate limiting
    const rateLimitResult = RateLimitPresets.api(request, 'student-credits');
    if (rateLimitResult) return rateLimitResult;

    // Require ELEVE role
    const session = await requireRole(UserRole.ELEVE);
    if (isErrorResponse(session)) return session;

    // Update logger with session context
    logger = createLogger(request, session);
    logger.info('Fetching student credits');

    const studentId = session.user.id;

    // Fetch student with credit transactions
    const student = await prisma.student.findUnique({
      where: { userId: studentId },
      include: {
        creditTransactions: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 50  // Limit to last 50 transactions for performance
        }
      }
    });

    assertExists(student, 'Student profile');

    // Calculate current balance
    const balance = student.creditTransactions.reduce((total: number, transaction: CreditTransaction) => {
      return total + transaction.amount;
    }, 0);

    // Format transactions
    const formattedTransactions = student.creditTransactions.map((transaction: CreditTransaction) => ({
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      sessionId: transaction.sessionId,
      expiresAt: transaction.expiresAt,
      createdAt: transaction.createdAt
    }));

    logger.logRequest(200, {
      balance,
      transactionCount: formattedTransactions.length
    });

    return successResponse({
      balance,
      transactions: formattedTransactions
    });

  } catch (error) {
    logger.error('Failed to fetch student credits', error);
    logger.logRequest(500);
    return await handleApiError(error, 'GET /api/student/credits');
  }
}
