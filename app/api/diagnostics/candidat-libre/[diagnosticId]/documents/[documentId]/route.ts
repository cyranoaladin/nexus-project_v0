import { NextResponse } from 'next/server';
import { readFile, unlink } from 'fs/promises';
import path from 'path';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getDocumentStorageRoot } from '@/lib/documents/storage-root';
import { isErrorResponse } from '@/lib/guards';
import { getDiagnosticForActor, requireDiagnosticActor, actorRole, isDocumentVisibleToViewer } from '@/lib/diagnostics/candidat-libre/access.server';

interface Params { params: Promise<{ diagnosticId: string; documentId: string }> }

function safeAbsolutePath(storageKey: string) {
  const root = path.resolve(getDocumentStorageRoot());
  const absolute = path.resolve(root, storageKey);
  if (!absolute.startsWith(`${root}${path.sep}`)) throw new Error('UNSAFE_STORAGE_PATH');
  return absolute;
}

export async function GET(_request: Request, { params }: Params) {
  const { diagnosticId, documentId } = await params;
  const sessionOrError = await requireDiagnosticActor();
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  const diagnosticOrError = await getDiagnosticForActor(sessionOrError, diagnosticId);
  if (diagnosticOrError instanceof NextResponse) return diagnosticOrError;
  const document = diagnosticOrError.documents.find((item: any) => item.id === documentId);
  if (!document) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  if (!isDocumentVisibleToViewer(document.category, actorRole(sessionOrError))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const buffer = await readFile(safeAbsolutePath(document.storageKey));
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': document.mimeType,
        'Content-Length': String(buffer.byteLength),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(document.originalName)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'File unavailable' }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { diagnosticId, documentId } = await params;
  const sessionOrError = await requireDiagnosticActor();
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  if (!([UserRole.ELEVE, UserRole.PARENT, UserRole.ADMIN, UserRole.ASSISTANTE] as UserRole[]).includes(sessionOrError.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const diagnosticOrError = await getDiagnosticForActor(sessionOrError, diagnosticId);
  if (diagnosticOrError instanceof NextResponse) return diagnosticOrError;
  if (diagnosticOrError.submittedAt) return NextResponse.json({ error: 'Diagnostic locked' }, { status: 423 });
  const document = diagnosticOrError.documents.find((item: any) => item.id === documentId);
  if (!document) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  if (!([UserRole.ADMIN, UserRole.ASSISTANTE] as UserRole[]).includes(sessionOrError.user.role) && document.uploadedById !== sessionOrError.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.candidateDiagnosticDocument.delete({ where: { id: documentId } });
    await tx.candidateDiagnosticAuditLog.create({
      data: {
        diagnosticId,
        actorId: sessionOrError.user.id,
        actorRole: actorRole(sessionOrError),
        action: 'DOCUMENT_DELETED',
        entityType: 'CandidateDiagnosticDocument',
        entityId: documentId,
        details: { category: document.category, sha256: document.sha256 },
      },
    });
  });
  await unlink(safeAbsolutePath(document.storageKey)).catch(() => undefined);
  return NextResponse.json({ success: true });
}
