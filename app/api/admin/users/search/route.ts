import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { serializeError } from '@/lib/utils/serialize-error';

export async function GET(request: NextRequest) {
  try {
    // RBAC: admin user search is intentionally admin-only to limit PII enumeration.
    const sessionOrResponse = await requireAnyRole([UserRole.ADMIN]);
    if (isErrorResponse(sessionOrResponse)) return sessionOrResponse;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
        // Target roles for documents: Students & Parents
        role: { in: [UserRole.ELEVE, UserRole.PARENT] }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
      take: 10,
    });

    return NextResponse.json(users);

  } catch (error) {
    console.error('User search error:', serializeError(error));
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
