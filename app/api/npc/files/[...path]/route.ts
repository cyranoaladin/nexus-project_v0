import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { can } from '@/lib/rbac';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { readSecureFile, MIME_TO_EXT } from '@/lib/npc';
import { canReadSubmission } from '@/lib/npc/access';

// ─── Route Params ───

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

// ─── Auth Helper ───

function decodePathSegments(pathSegments: string[]): string | null {
  try {
    return pathSegments.map((segment) => decodeURIComponent(segment)).join('/');
  } catch {
    return null;
  }
}

function isSafeRelativeStoragePath(relativePath: string): boolean {
  if (!relativePath || relativePath.startsWith('/') || relativePath.includes('//')) {
    return false;
  }

  if (relativePath.includes('\\')) {
    return false;
  }

  return !relativePath.split('/').some((segment) => segment === '..' || segment === '');
}

// ─── GET Handler ───

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId, role } = session.user as { id: string; role: UserRole };

    // Check base permission
    if (!can(role, 'READ', 'COPY_SUBMISSION')) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    // Build relative path from route params
    const { path } = await params;
    const relativePath = decodePathSegments(path);

    // Validate path format (prevent directory traversal)
    if (!relativePath || !isSafeRelativeStoragePath(relativePath)) {
      console.warn('[NPC Files] Invalid storage path requested');
      return NextResponse.json(
        { error: 'Invalid path' },
        { status: 400 }
      );
    }

    const document = await prisma.copyPage.findFirst({
      where: {
        OR: [
          { originalFilePath: relativePath },
          { convertedFilePaths: { has: relativePath } },
        ],
      },
      select: {
        id: true,
        mimeType: true,
        submission: {
          select: {
            id: true,
            studentId: true,
            coachId: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const hasAccess = await canReadSubmission({ userId, role }, document.submission);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden - Access denied to this file' },
        { status: 403 }
      );
    }

    // Read file from secure storage
    const fileBuffer = await readSecureFile(relativePath);
    if (!fileBuffer) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Determine content type from extension
    const ext = relativePath.split('.').pop()?.toLowerCase() || '';
    const contentType = document.mimeType || Object.entries(MIME_TO_EXT).find(
      ([, e]) => e === ext
    )?.[0];

    // Return file with security headers
    const headers = new Headers();
    headers.set('Content-Type', contentType || 'application/octet-stream');
    headers.set('Content-Length', fileBuffer.length.toString());
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Cache-Control', 'private, max-age=3600'); // 1 hour cache

    // Prevent browsers from interpreting files as HTML/JS
    headers.set('Content-Security-Policy', "default-src 'none'");
    headers.set('X-Frame-Options', 'DENY');

    return new NextResponse(new Blob([new Uint8Array(fileBuffer)]), { status: 200, headers });
  } catch (error) {
    console.error('[NPC Files] Error serving file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
