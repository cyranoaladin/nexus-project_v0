import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { createId } from '@paralleldrive/cuid2';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { serializeError } from '@/lib/utils/serialize-error';
import { getDocumentStorageRoot, toRelativeStoragePath } from '@/lib/documents/storage-root';
import { z } from 'zod';

function getStorageRoot() { return getDocumentStorageRoot(); }
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
]);

const targetUserIdSchema = z.string().min(1).max(128);

const safeDocumentSelect = {
  id: true,
  title: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  userId: true,
  uploadedById: true,
  createdAt: true,
} as const;

function sanitizeOriginalName(value: string): string {
  return value.replace(/[\\/\r\n"]/g, '_').slice(0, 200) || 'document';
}

function safeErrorSummary(error: unknown) {
  const serialized = serializeError(error);
  if (serialized && typeof serialized === 'object' && !Array.isArray(serialized)) {
    return {
      name: typeof serialized.name === 'string' ? serialized.name : 'Error',
      message: typeof serialized.message === 'string' ? serialized.message : 'unknown',
    };
  }
  return { name: 'Error', message: String(serialized) };
}

export async function POST(request: NextRequest) {
  try {
    // 1. RBAC Check (Admin or Assistant only)
    const sessionOrResponse = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
    if (isErrorResponse(sessionOrResponse)) return sessionOrResponse;
    const session = sessionOrResponse;

    // 2. Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const parsedUserId = targetUserIdSchema.safeParse(formData.get('userId'));

    if (!file || !parsedUserId.success) {
      return NextResponse.json({ error: 'File and userId required' }, { status: 400 });
    }
    const userId = parsedUserId.data;

    if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.type) || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Type ou taille de fichier invalide' }, { status: 400 });
    }

    // 3. Validate Target User
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    // 4. Secure File Processing
    // Generate secure filename (cuid + extension) to prevent traversal
    // e.g. cl9...xyz.pdf
    const fileExt = path.extname(file.name) || '.bin';
    const uniqueId = createId();
    const secureFilename = `${uniqueId}${fileExt}`;
    // Using path.join ensures we stick to the OS separator, 
    // and combined with uniqueId prevents directory traversal like ../../
    const localPath = path.join(getStorageRoot(), secureFilename);
    const originalName = sanitizeOriginalName(file.name);

    // Ensure directory exists
    await mkdir(getStorageRoot(), { recursive: true });

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(localPath, buffer);

    // 5. Save Metadata to DB
    const document = await prisma.userDocument.create({
      data: {
        id: uniqueId, // Use same ID for consistency
        title: originalName, // Default title = filename
        originalName,
        mimeType: file.type,
        sizeBytes: file.size,
        localPath: toRelativeStoragePath(localPath),
        userId: userId,
        uploadedById: session.user.id,
      },
      select: safeDocumentSelect,
    });

    const safeDocument = { ...(document as Record<string, unknown>) };
    delete safeDocument.localPath;

    return NextResponse.json({ success: true, document: safeDocument }, { status: 201 });

  } catch (error) {
    console.error('[Upload Error]', safeErrorSummary(error));
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
