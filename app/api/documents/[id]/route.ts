import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { serializeError } from '@/lib/utils/serialize-error';
import { z } from 'zod';
import { readAuthorizedDocument } from '@/lib/documents/read-authority';
import { getDocumentStorageRoot, LEGACY_STORAGE_PREFIX } from '@/lib/documents/storage-root';
import {
  openSecureDocument,
  SecureFileAccessError,
  safeContentType,
  safeFilename,
} from '@/lib/documents/secure-file-access';

const routeParamsSchema = z.object({
  id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const parsedParams = routeParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return new NextResponse('Bad Request', { status: 400 });
    }
    const { id } = parsedParams.data;
    const access = await readAuthorizedDocument(id, session.user);
    if (access.status === 'DENIED') return access.response;
    const document = access.document;
    if (document.unavailableReason) return new NextResponse(document.unavailableReason, { status: 410 });

    let secureDoc;
    try {
      const storageRoot = getDocumentStorageRoot();
      secureDoc = await openSecureDocument(storageRoot, document.localPath, {
        legacyPrefixToStrip: LEGACY_STORAGE_PREFIX,
      });
    } catch (err) {
      if (err instanceof SecureFileAccessError) {
        console.error('[documents] containment check failed', { documentId: document.id, code: err.code });
        return new NextResponse('File content not found', { status: 404 });
      }
      console.error('[documents] unexpected error', { documentId: document.id });
      return new NextResponse('File content not found', { status: 404 });
    }

    try {
      const stream = secureDoc.handle.createReadStream();
      const webStream = Readable.toWeb(stream) as ReadableStream;

      return new NextResponse(webStream, {
        headers: {
          'Content-Type': safeContentType(document.mimeType),
          'Content-Disposition': `inline; filename="${safeFilename(document.originalName)}"`,
          'Content-Length': secureDoc.sizeBytes.toString(),
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, no-store',
        },
      });
    } catch {
      await secureDoc.handle.close().catch(() => {});
      return new NextResponse('File content not found', { status: 404 });
    }
  } catch (error) {
    console.error('[Download Error]', serializeError(error));
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
