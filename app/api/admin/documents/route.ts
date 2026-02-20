import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { createId } from '@paralleldrive/cuid2';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';

// Secure storage root (mapped to volume in docker-compose)
const STORAGE_ROOT = '/app/storage/documents';

export async function POST(request: NextRequest) {
  try {
    // 1. RBAC Check (Admin or Assistant only)
    const sessionOrResponse = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
    if (isErrorResponse(sessionOrResponse)) return sessionOrResponse;
    const session = sessionOrResponse;

    // 2. Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;

    if (!file || !userId) {
      return NextResponse.json({ error: 'File and userId required' }, { status: 400 });
    }

    // 3. Validate Target User
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
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
    const localPath = path.join(STORAGE_ROOT, secureFilename);

    // Ensure directory exists
    await mkdir(STORAGE_ROOT, { recursive: true });

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(localPath, buffer);

    // 5. Save Metadata to DB
    const document = await prisma.userDocument.create({
      data: {
        id: uniqueId, // Use same ID for consistency
        title: file.name, // Default title = filename
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        localPath: localPath,
        userId: userId,
        uploadedById: session.user.id,
      },
    });

    return NextResponse.json(document, { status: 201 });

  } catch (error) {
    console.error('[Upload Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
