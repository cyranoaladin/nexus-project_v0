import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { readFile, realpath, stat } from 'fs/promises';
import { resolve, sep } from 'path';
import { getDocumentStorageRoot, LEGACY_STORAGE_PREFIX } from '@/lib/documents/storage-root';
import { z } from 'zod';
import { readAuthorizedDocument } from '@/lib/documents/read-authority';

const routeParamsSchema = z.object({
  id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
});

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
 * Serves a document file with full RBAC.
 *
 * Containment: realpath on BOTH root and candidate path — handles symlinks
 * (e.g., /app/storage → /mnt/volume). Link races (TOCTOU symlink) are out of
 * threat model: they require local FS write access. realpath-before-read is
 * the retained level.
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
    const access = await readAuthorizedDocument(id, session.user);
    if (access.status === 'DENIED') return access.response;
    const document = access.document;

    // ── Serve file ──
    // Référence tombstonée : le fichier a été perdu lors de la migration Docker
    // et ne peut pas être restauré. Répondre franchement plutôt que de laisser
    // croire à une panne passagère.
    if (document.unavailableReason) {
      return new NextResponse(document.unavailableReason, { status: 410 });
    }

    const rawPath = document.localPath;

    if (/^https?:\/\//i.test(rawPath)) {
      return new NextResponse('Not Found', { status: 404 });
    }

    const storageRoot = getDocumentStorageRoot();

    // Resolve the raw path to an absolute, normalized path.
    // Upload writes absolute cwd-based paths; DB stores legacy /app/storage/documents/...
    let resolvedPath: string;
    if (rawPath.startsWith(LEGACY_STORAGE_PREFIX)) {
      resolvedPath = resolve(storageRoot, rawPath.slice(LEGACY_STORAGE_PREFIX.length));
    } else if (rawPath.startsWith('/')) {
      resolvedPath = resolve(rawPath);
    } else {
      resolvedPath = resolve(storageRoot, rawPath);
    }

    // Containment by realpath: canonicalize BOTH root and candidate.
    // Both sides must be canonical — if STORAGE_ROOT is a symlink (e.g.,
    // /app/storage → /mnt/volume), realpath on only the candidate would
    // fail containment for ALL legitimate files.
    let canonicalRoot: string;
    let canonicalPath: string;
    try {
      canonicalRoot = await realpath(storageRoot);
      canonicalPath = await realpath(resolvedPath);
    } catch {
      // realpath ENOENT: path does not exist on disk → 404
      return new NextResponse('File content not found', { status: 404 });
    }

    const canonicalPrefix = canonicalRoot.endsWith(sep) ? canonicalRoot : `${canonicalRoot}${sep}`;
    if (!canonicalPath.startsWith(canonicalPrefix)) {
      return new NextResponse('Not Found', { status: 404 });
    }

    const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
    try {
      const fileStat = await stat(canonicalPath);
      if (fileStat.size > MAX_DOWNLOAD_BYTES) {
        return new NextResponse('File too large', { status: 413 });
      }
    } catch {
      return new NextResponse('File content not found', { status: 404 });
    }

    try {
      const fileBuffer = await readFile(canonicalPath);
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
  } catch {
    console.error('[documents] unexpected download error', { code: 'DOCUMENT_READ_UNEXPECTED_ERROR', route: 'download' });
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
