import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server/authz';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
    
    const bilans = await prisma.bilanPremium.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(bilans);
  } catch (error: any) {
    if (error.name === 'HttpError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to fetch bilans:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
