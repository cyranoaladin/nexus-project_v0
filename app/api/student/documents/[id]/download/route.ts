export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { UserRole } from '@prisma/client';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { getDocumentStorageRoot, LEGACY_STORAGE_PREFIX } from '@/lib/documents/storage-root';
import {
  resolveSecurePath,
  SecureFileAccessError,
  safeContentType,
  safeFilename,
} from '@/lib/documents/secure-file-access';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionOrError = await requireRole(UserRole.ELEVE);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  const session = sessionOrError;
  const { id } = await params;

  const doc = await prisma.userDocument.findFirst({
    where: {
      id,
      userId: session.user.id, // strict ownership — prevents access to other students' docs
    },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      localPath: true,
    },
  });

  if (!doc) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const storageRoot = getDocumentStorageRoot();
    const { canonicalPath } = await resolveSecurePath(storageRoot, doc.localPath, {
      legacyPrefixToStrip: LEGACY_STORAGE_PREFIX,
    });

    const buffer = await readFile(canonicalPath);
    const safeName = safeFilename(doc.originalName);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': safeContentType(doc.mimeType),
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err) {
    if (err instanceof SecureFileAccessError) {
      console.error('[student/documents/download] containment check failed', {
        documentId: id,
        code: err.code,
      });
      return NextResponse.json({ error: 'File unavailable' }, { status: 404 });
    }
    const code = err instanceof Error && 'code' in err
      ? String((err as NodeJS.ErrnoException).code)
      : 'UNKNOWN';
    console.error('[student/documents/download] file read failed', { documentId: id, code });
    return NextResponse.json({ error: 'File unavailable' }, { status: 500 });
  }
}
