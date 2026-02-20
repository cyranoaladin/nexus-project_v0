import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { UserRole } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = await params;

    // 1. Get Metadata
    const document = await prisma.userDocument.findUnique({
      where: { id },
    });

    if (!document) {
      return new NextResponse('Document not found', { status: 404 });
    }

    // 2. Strict RBAC (Owner OR Staff)
    const userRole = session.user.role as UserRole;
    const isOwner = document.userId === session.user.id;
    // Allow COACH to see documents? The prompt said "Admin/Assistante or Owner".
    // I will stick to Admin/Assistante + Owner to be strict as requested.
    const isStaff = ([UserRole.ADMIN, UserRole.ASSISTANTE] as UserRole[]).includes(userRole);

    if (!isOwner && !isStaff) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // 3. Read File from Secure Storage
    try {
      const fileBuffer = await readFile(document.localPath);

      // 4. Return with Headers
      // 'inline' allows viewing in browser (PDF), 'attachment' forces download.
      // Use inline for UX, browser will handle download option.
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': document.mimeType,
          'Content-Disposition': `inline; filename="${encodeURIComponent(document.originalName)}"`,
          'Content-Length': document.sizeBytes.toString(),
          // Security headers
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (fsError) {
      console.error('[File Read Error] File missing on disk:', document.localPath);
      // Don't leak path in production response
      return new NextResponse('File content not found', { status: 404 });
    }

  } catch (error) {
    console.error('[Download Error]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
