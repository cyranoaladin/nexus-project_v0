export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { UserRole } from '@prisma/client';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { getDocumentStorageRoot, LEGACY_STORAGE_PREFIX } from '@/lib/documents/storage-root';
import {
  openSecureDocument,
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
      userId: session.user.id, // strict ownership
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

  let secureDoc;
  try {
    const storageRoot = getDocumentStorageRoot();
    secureDoc = await openSecureDocument(storageRoot, doc.localPath, {
      legacyPrefixToStrip: LEGACY_STORAGE_PREFIX,
    });
  } catch (err) {
    if (err instanceof SecureFileAccessError) {
      console.error('[student/documents/download] containment check failed', {
        documentId: id,
        code: err.code,
      });
      return NextResponse.json({ error: 'File unavailable' }, { status: 404 });
    }
    console.error('[student/documents/download] unexpected error', { documentId: id });
    return NextResponse.json({ error: 'File unavailable' }, { status: 500 });
  }

  try {
    const stream = secureDoc.handle.createReadStream();
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': safeContentType(doc.mimeType),
        'Content-Disposition': `attachment; filename="${safeFilename(doc.originalName)}"`,
        'Content-Length': secureDoc.sizeBytes.toString(),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    await secureDoc.handle.close().catch(() => {});
    console.error('[student/documents/download] stream error', { documentId: id });
    return NextResponse.json({ error: 'File unavailable' }, { status: 500 });
  }
}
