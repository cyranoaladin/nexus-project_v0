import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { UserRole } from '@prisma/client';
import { serializeError } from '@/lib/utils/serialize-error';
import { z } from 'zod';
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

function isStaffRole(role: string | undefined): boolean {
  return role === UserRole.ADMIN || role === UserRole.ASSISTANTE;
}

function buildDocumentOwnershipWhere(id: string, userId: string, role: string | undefined) {
  if (isStaffRole(role)) {
    return { id };
  }
  return { id, userId };
}

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
    const userRole = session.user.role as UserRole | undefined;

    const document = await prisma.userDocument.findFirst({
      where: buildDocumentOwnershipWhere(id, session.user.id, userRole),
      select: {
        id: true,
        userId: true,
        localPath: true,
        mimeType: true,
        originalName: true,
        sizeBytes: true,
      },
    });

    if (!document) {
      return new NextResponse('Document not found', { status: 404 });
    }

    // Ownership check: staff can access any; others only their own
    if (!isStaffRole(userRole) && document.userId !== session.user.id) {
      return new NextResponse('Document not found', { status: 404 });
    }

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
