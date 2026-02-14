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

export async function GET() {
  try {
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
    console.error('[Assessment Test] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to access Assessment model',
        message: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Make sure to run: npx prisma migrate deploy && npx prisma generate',
      },
      { status: 500 }
    );
  }
}
