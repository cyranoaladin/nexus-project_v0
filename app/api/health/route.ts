import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    // Test database connection
    await prisma.$connect();
    
    // Test a simple query
    const userCount = await prisma.user.count();
    
    logger.info({ userCount }, 'Healthcheck OK');
    return NextResponse.json({
      status: 'success',
      message: 'API and database are working!',
      database: {
        connected: true,
        userCount
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ error }, 'Health check error');
    return NextResponse.json({
      status: 'error',
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
