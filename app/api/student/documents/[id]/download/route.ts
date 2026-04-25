export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { UserRole } from '@prisma/client';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

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
    // localPath is an absolute path outside the public directory (secure storage)
    const resolvedPath = path.resolve(doc.localPath);
    const buffer = await readFile(resolvedPath);

    const safeName = encodeURIComponent(doc.originalName).replace(/['"]/g, '');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': doc.mimeType ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[documents/download] file read failed', { id, err });
    return NextResponse.json({ error: 'File unavailable' }, { status: 500 });
  }
}
