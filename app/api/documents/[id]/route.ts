import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { UserRole } from '@prisma/client';
import { serializeError } from '@/lib/utils/serialize-error';
import { z } from 'zod';
import { getDocumentStorageRoot, LEGACY_STORAGE_PREFIX } from '@/lib/documents/storage-root';
import {
  resolveSecurePath,
  SecureFileAccessError,
} from '@/lib/documents/secure-file-access';

const routeParamsSchema = z.object({
  id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
});

const documentDownloadSelect = {
  id: true,
  userId: true,
  localPath: true,
  mimeType: true,
  originalName: true,
  sizeBytes: true,
} as const;

type DocumentDownloadRecord = {
  id: string;
  userId: string;
  localPath: string;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
};

function isStaffRole(role: string | undefined): boolean {
  return role === UserRole.ADMIN || role === UserRole.ASSISTANTE;
}

function buildDocumentOwnershipWhere(id: string, userId: string, role: string | undefined) {
  if (isStaffRole(role)) {
    return { id };
  }
  return { id, userId };
}

function hasDocumentOwnership(document: DocumentDownloadRecord, userId: string, role: string | undefined): boolean {
  return isStaffRole(role) || document.userId === userId;
}

function safeFilename(name: string): string {
  return encodeURIComponent(name.replace(/[\\/\r\n"]/g, '_'));
}

function safeContentType(mimeType: string | null | undefined): string {
  if (!mimeType) return 'application/octet-stream';
  const allowed = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
  ]);
  return allowed.has(mimeType) ? mimeType : 'application/octet-stream';
}

export async function GET(
  request: NextRequest,
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

    // Scope the metadata query before any file-system read.
    const document = await prisma.userDocument.findFirst({
      where: buildDocumentOwnershipWhere(id, session.user.id, userRole),
      select: documentDownloadSelect,
    });

    if (!document) {
      return new NextResponse('Document not found', { status: 404 });
    }

    if (!hasDocumentOwnership(document, session.user.id, userRole)) {
      return new NextResponse('Document not found', { status: 404 });
    }

    try {
      const storageRoot = getDocumentStorageRoot();
      const { canonicalPath, sizeBytes } = await resolveSecurePath(
        storageRoot,
        document.localPath,
        { legacyPrefixToStrip: LEGACY_STORAGE_PREFIX },
      );

      const fileBuffer = await readFile(canonicalPath);

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': safeContentType(document.mimeType),
          'Content-Disposition': `inline; filename="${safeFilename(document.originalName)}"`,
          'Content-Length': sizeBytes.toString(),
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, no-store',
        },
      });
    } catch (err) {
      if (err instanceof SecureFileAccessError) {
        console.error('[documents] containment check failed', { documentId: document.id, code: err.code });
        return new NextResponse('File content not found', { status: 404 });
      }
      const code = err instanceof Error && 'code' in err
        ? String((err as NodeJS.ErrnoException).code)
        : 'UNKNOWN';
      console.error('[File Read Error] File content unavailable', { documentId: document.id, code });
      return new NextResponse('File content not found', { status: 404 });
    }

  } catch (error) {
    console.error('[Download Error]', serializeError(error));
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
