// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { can } from '@/lib/rbac';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { readSecureFile, MIME_TO_EXT } from '@/lib/npc';

// ─── Route Params ───

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

// ─── Auth Helper ───

async function canAccessFile(
  userId: string,
  role: UserRole,
  relativePath: string
): Promise<boolean> {
  // Extract studentId from path (format: {studentId}/{submissionId}/...)
  const pathParts = relativePath.split('/');
  const studentIdPrefix = pathParts[0];

  if (!studentIdPrefix) return false;

  // Find student by matching the prefix
  const student = await prisma.student.findFirst({
    where: {
      id: { startsWith: studentIdPrefix },
    },
    include: {
      user: true,
      parent: { include: { user: true } },
      coachAssignments: { include: { coach: { include: { user: true } } } },
    },
  });

  if (!student) return false;

  // Role-based access check
  if (role === UserRole.ADMIN) return true;

  if (role === UserRole.ELEVE) {
    return student.userId === userId;
  }

  if (role === UserRole.PARENT) {
    return student.parent.userId === userId;
  }

  if (role === UserRole.COACH) {
    const coachIds = student.coachAssignments.map((a) => a.coach.userId);
    return coachIds.includes(userId);
  }

  if (role === UserRole.ASSISTANTE) {
    // Assistente can view but we track access
    return true;
  }

  return false;
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
    const relativePath = path.join('/');

    // Validate path format (prevent directory traversal)
    if (
      relativePath.includes('..') ||
      relativePath.startsWith('/') ||
      relativePath.includes('//')
    ) {
      console.warn('[NPC Files] Path traversal attempt:', relativePath);
      return NextResponse.json(
        { error: 'Invalid path' },
        { status: 400 }
      );
    }

    // Authorize access to this specific file
    const hasAccess = await canAccessFile(userId, role, relativePath);
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
    const contentType = Object.entries(MIME_TO_EXT).find(
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

    return new NextResponse(fileBuffer as any, { status: 200, headers });
  } catch (error) {
    console.error('[NPC Files] Error serving file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
