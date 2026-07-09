import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { UserRole, DocumentVisibilityScope } from '@prisma/client';
import { serializeError } from '@/lib/utils/serialize-error';
import { assertCoachCanAccessStudent } from '@/lib/rbac/coach-student-access';
import { z } from 'zod';

// Storage root: env-configurable, defaults to cwd/storage/documents.
// Accepts legacy /app/storage/documents/ prefix from existing DB rows.
const STORAGE_ROOT = process.env.DOCUMENT_STORAGE_ROOT
  || resolve(process.cwd(), 'storage', 'documents');
const LEGACY_PREFIX = '/app/storage/documents/';

const routeParamsSchema = z.object({
  id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
});

const STAFF_ROLES = new Set<string>([UserRole.ADMIN, UserRole.ASSISTANTE]);

const COACH_VISIBLE_SCOPES = new Set<string>([
  DocumentVisibilityScope.STUDENT_AND_COACH,
  DocumentVisibilityScope.STUDENT_PARENT_COACH,
]);

const PARENT_VISIBLE_SCOPES = new Set<string>([
  DocumentVisibilityScope.STUDENT_AND_PARENT,
  DocumentVisibilityScope.STUDENT_PARENT_COACH,
]);

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

/**
 * GET /api/documents/[id]/download
 *
 * Serves a document file with full RBAC:
 * - Staff (ADMIN/ASSISTANTE): access any document
 * - Coach: only documents of assigned students, with matching visibilityScope
 * - Parent: only documents of their children, with matching visibilityScope
 * - Elève: only their own documents
 */
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
    const role = (session.user.role as string) ?? '';

    // Fetch document with owner and student relationships
    const document = await prisma.userDocument.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        localPath: true,
        mimeType: true,
        originalName: true,
        sizeBytes: true,
        visibilityScope: true,
        user: {
          select: {
            id: true,
            student: { select: { id: true, parentId: true } },
          },
        },
      },
    });

    if (!document) {
      return new NextResponse('Not Found', { status: 404 });
    }

    // ── RBAC checks ──
    if (STAFF_ROLES.has(role)) {
      // Staff can access any document — no further checks
    } else if (role === UserRole.COACH) {
      // Coach must be assigned to the student AND scope must allow coach access
      if (!COACH_VISIBLE_SCOPES.has(document.visibilityScope)) {
        return new NextResponse('Not Found', { status: 404 });
      }
      const studentProfile = document.user?.student;
      if (!studentProfile) {
        return new NextResponse('Not Found', { status: 404 });
      }
      try {
        await assertCoachCanAccessStudent({
          coachUserId: session.user.id,
          studentId: studentProfile.id,
        });
      } catch {
        return new NextResponse('Not Found', { status: 404 });
      }
    } else if (role === UserRole.PARENT) {
      // Parent must own the student AND scope must allow parent access
      if (!PARENT_VISIBLE_SCOPES.has(document.visibilityScope)) {
        return new NextResponse('Not Found', { status: 404 });
      }
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      const studentProfile = document.user?.student;
      if (!parentProfile || !studentProfile || studentProfile.parentId !== parentProfile.id) {
        return new NextResponse('Not Found', { status: 404 });
      }
    } else if (role === UserRole.ELEVE) {
      // Student can only access their own documents
      if (document.userId !== session.user.id) {
        return new NextResponse('Not Found', { status: 404 });
      }
    } else {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // ── Serve file ──
    // URL-based documents don't have local files
    if (document.localPath.startsWith('http')) {
      return new NextResponse('Not Found', { status: 404 });
    }

    // Resolve stored path to filesystem:
    // Legacy rows store /app/storage/documents/... — strip prefix and resolve relative to STORAGE_ROOT
    // New rows store relative paths like documents/user/file.pdf
    let relativePath = document.localPath;
    if (relativePath.startsWith(LEGACY_PREFIX)) {
      relativePath = relativePath.slice(LEGACY_PREFIX.length);
    } else if (relativePath.startsWith('/')) {
      // Absolute path not matching legacy prefix — strip leading / for resolve
      relativePath = relativePath.slice(1);
    }
    const resolvedPath = resolve(STORAGE_ROOT, relativePath);

    // Path traversal containment: resolved path must stay within STORAGE_ROOT
    const normalizedRoot = resolve(STORAGE_ROOT) + '/';
    if (!resolvedPath.startsWith(normalizedRoot)) {
      return new NextResponse('Not Found', { status: 404 });
    }

    try {
      const fileBuffer = await readFile(resolvedPath);
      return new NextResponse(fileBuffer as unknown as BodyInit, {
        headers: {
          'Content-Type': safeContentType(document.mimeType),
          'Content-Disposition': `inline; filename="${safeFilename(document.originalName)}"`,
          'Content-Length': fileBuffer.length.toString(),
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, no-store',
        },
      });
    } catch (fsError) {
      const code = fsError instanceof Error && 'code' in fsError
        ? String((fsError as NodeJS.ErrnoException).code)
        : 'UNKNOWN';
      console.error('[Document Download] File not found on disk', { documentId: id, code });
      return new NextResponse('File content not found', { status: 404 });
    }
  } catch (error) {
    console.error('[Document Download] Error:', serializeError(error));
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
