export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Health check endpoint
 *
 * Returns a simple status indicating if the service and database are available.
 * Uses a custom response format (not standard API error format) since health
 * checks are infrastructure endpoints.
 */
export async function GET() {
  try {
    // Test a simple query to ensure DB is responsive (lightweight check)
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Log error server-side (sanitized)
    console.error('Health check error:', error instanceof Error ? error.message : 'Unknown error');

    // SECURITY: Return minimal info to client (no stack traces or internals)
    return NextResponse.json({
      status: 'error',
      message: 'Service temporarily unavailable',
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}
