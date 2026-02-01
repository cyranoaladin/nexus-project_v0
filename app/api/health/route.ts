import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Test a simple query to ensure DB is responsive (lightweight check)
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Log full error server-side for debugging
    console.error('Health check error:', error instanceof Error ? error.message : 'Unknown error');

    // Return minimal info to client (no stack traces or internals)
    return NextResponse.json({
      status: 'error',
      message: 'Service temporarily unavailable',
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}
