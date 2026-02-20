export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * GET /api/student/documents
 *
 * Returns all UserDocument entries for the authenticated student (ELEVE role).
 * Documents are sorted by creation date (newest first).
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const documents = await prisma.userDocument.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('[GET /api/student/documents] Error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
