/**
 * Assessment Test API
 * 
 * GET /api/assessments/test
 * 
 * Simple test endpoint to verify that the Assessment model is accessible
 * and the Prisma client is properly generated.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { serializeError } from '@/lib/utils/serialize-error';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Test 1: Count assessments
    const count = await prisma.assessment.count();

    // Test 2: Check if we can query (with limit to avoid loading too much data)
    const recentAssessments = await prisma.assessment.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        subject: true,
        grade: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Assessment model is accessible',
      data: {
        totalCount: count,
        recentAssessments,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Assessment Test] Error:', serializeError(error));

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
