export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { UserRole } from '@prisma/client';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { readAuthorizedDocument } from '@/lib/documents/read-authority';
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

  let access: Awaited<ReturnType<typeof readAuthorizedDocument>>;
  try {
    access = await readAuthorizedDocument(id, session.user);
  } catch {
    console.error('STUDENT_DOCUMENT_AUTHORITY_READ_FAILED');
    return NextResponse.json({ error: 'File unavailable' }, { status: 500,
      headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } });
  }
  if (access.status === 'DENIED') {
    return NextResponse.json({ error: 'Not found' }, { status: access.response.status,
      headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } });
  }
  const doc = access.document;
  if (doc.unavailableReason) {
    return NextResponse.json({ error: 'File unavailable' }, { status: 410,
      headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } });
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
      return NextResponse.json({ error: 'File unavailable' }, { status: 404, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } });
    }
    console.error('[student/documents/download] unexpected error', { documentId: id });
    return NextResponse.json({ error: 'File unavailable' }, { status: 500, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } });
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
        Vary: 'Cookie, Authorization',
      },
    });
  } catch {
    try {
      await secureDoc.handle.close();
    } catch {
      console.error('STUDENT_DOCUMENT_HANDLE_CLOSE_FAILED');
    }
    console.error('[student/documents/download] stream error', { documentId: id });
    return NextResponse.json({ error: 'File unavailable' }, { status: 500, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } });
  }
}
