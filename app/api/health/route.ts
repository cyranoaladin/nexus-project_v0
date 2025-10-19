import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  // Mode rapide: si DISABLE_DB_HEALTH=true, ne pas toucher la DB
  if (process.env.DISABLE_DB_HEALTH === 'true') {
    return NextResponse.json({ status: 'ok', mode: 'api-only', timestamp: new Date().toISOString() });
  }

  try {
    await prisma.$connect();
    const userCount = await prisma.user.count();
    return NextResponse.json({
      status: 'success',
      message: 'API and database are working!',
      database: { connected: true, userCount },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({ status: 'error', message: 'Database connection failed' }, { status: 500 });
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}
