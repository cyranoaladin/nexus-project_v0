export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { STUDENT_DOCUMENT_SCOPES } from '@/lib/documents/student-visibility';

const privateHeaders = { 'Cache-Control': 'private, no-store' };

/**
 * GET /api/student/documents
 *
 * Returns student-readable UserDocument entries for the authenticated student.
 * Documents are sorted by creation date (newest first).
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401, headers: privateHeaders });
    }

    const documents = await prisma.userDocument.findMany({
      where: { userId: session.user.id, visibilityScope: { in: [...STUDENT_DOCUMENT_SCOPES] } },
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

    return NextResponse.json({ documents }, { headers: privateHeaders });
  } catch {
    console.error('STUDENT_DOCUMENT_LIST_FAILED');
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500, headers: privateHeaders });
  }
}
