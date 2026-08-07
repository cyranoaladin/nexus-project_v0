import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isErrorResponse } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { documentMetadataSchema } from '@/lib/diagnostics/candidat-libre/schemas';
import { getDiagnosticForActor, requireDiagnosticActor, actorRole, isDocumentVisibleToViewer } from '@/lib/diagnostics/candidat-libre/access.server';
import { persistDiagnosticFile, removePersistedDiagnosticFile } from '@/lib/diagnostics/candidat-libre/storage.server';
import { CANDIDATE_DIAGNOSTIC_MODULES } from '@/lib/diagnostics/candidat-libre/definition.public';
import { scanDiagnosticFile } from '@/lib/diagnostics/candidat-libre/virus-scan.server';
import { guardCandidateDiagnosticFeature } from '@/lib/diagnostics/candidat-libre/feature-flag';

interface Params { params: Promise<{ diagnosticId: string }> }

const CATEGORY_RULES = new Map(
  CANDIDATE_DIAGNOSTIC_MODULES.flatMap((module) => module.questions)
    .filter((question) => question.type === 'upload' && question.uploadRule)
    .map((question) => [question.uploadRule!.category, question.uploadRule!] as const),
);

export async function GET(_request: Request, { params }: Params) {
  const disabled = guardCandidateDiagnosticFeature();
  if (disabled) return disabled;
  const { diagnosticId } = await params;
  const sessionOrError = await requireDiagnosticActor();
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  const diagnosticOrError = await getDiagnosticForActor(sessionOrError, diagnosticId);
  if (diagnosticOrError instanceof NextResponse) return diagnosticOrError;
  const viewerRole = actorRole(sessionOrError);
  return NextResponse.json({
    documents: diagnosticOrError.documents
      .filter((document: any) => isDocumentVisibleToViewer(document.category, viewerRole))
      .map((document: any) => ({
      id: document.id,
      category: document.category,
      title: document.title,
      description: document.description,
      originalName: document.originalName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      status: document.status,
      reviewNote: document.reviewNote,
      createdAt: document.createdAt,
      downloadUrl: `/api/diagnostics/candidat-libre/${diagnosticId}/documents/${document.id}`,
    })),
  });
}

export async function POST(request: Request, { params }: Params) {
  const disabled = guardCandidateDiagnosticFeature();
  if (disabled) return disabled;
  const ipLimited = await guardSensitiveRateLimit(request, { scope: 'candidate-document-upload', dimensions: ['ip'] });
  if (ipLimited) return ipLimited;
  const { diagnosticId } = await params;
  const sessionOrError = await requireDiagnosticActor();
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  if (!([UserRole.ELEVE, UserRole.PARENT, UserRole.ADMIN, UserRole.ASSISTANTE] as UserRole[]).includes(sessionOrError.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const identityLimited = await guardSensitiveRateLimit(request, {
    scope: 'candidate-document-upload',
    identity: sessionOrError.user.id,
    resource: diagnosticId,
    dimensions: ['identity', 'resource'],
  });
  if (identityLimited) return identityLimited;
  const diagnosticOrError = await getDiagnosticForActor(sessionOrError, diagnosticId);
  if (diagnosticOrError instanceof NextResponse) return diagnosticOrError;
  if (diagnosticOrError.submittedAt) return NextResponse.json({ error: 'Diagnostic locked' }, { status: 423 });

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) return NextResponse.json({ error: 'Multipart form-data required' }, { status: 415 });
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'File required' }, { status: 400 });
  const parsed = documentMetadataSchema.safeParse({
    category: form.get('category'),
    title: form.get('title') || file.name,
    description: form.get('description') || undefined,
    clientMutationId: form.get('clientMutationId'),
  });
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const rule = CATEGORY_RULES.get(parsed.data.category);
  if (!rule) return NextResponse.json({ error: 'Unsupported document category' }, { status: 400 });
  if (!rule.accept.includes(file.type)) return NextResponse.json({ error: 'File type not allowed for category' }, { status: 400 });
  if (file.size > rule.maxBytesPerFile) return NextResponse.json({ error: 'File too large', maxBytes: rule.maxBytesPerFile }, { status: 413 });
  const count = diagnosticOrError.documents.filter((document: any) => document.category === parsed.data.category && document.status !== 'REJECTED').length;
  if (count >= rule.maxFiles) return NextResponse.json({ error: 'Maximum number of files reached', maxFiles: rule.maxFiles }, { status: 409 });

  const existing = await prisma.candidateDiagnosticDocument.findUnique({
    where: { diagnosticId_clientMutationId: { diagnosticId, clientMutationId: parsed.data.clientMutationId } },
  });
  if (existing) return NextResponse.json({ success: true, idempotent: true, document: existing });

  let stored: Awaited<ReturnType<typeof persistDiagnosticFile>> | null = null;
  try {
    stored = await persistDiagnosticFile({ diagnosticId, file, category: parsed.data.category });
    await scanDiagnosticFile(stored.storageKey);
    const storedFile = stored;
    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.candidateDiagnosticDocument.create({
        data: {
          diagnosticId,
          uploadedById: sessionOrError.user.id,
          category: parsed.data.category,
          title: parsed.data.title,
          description: parsed.data.description,
          originalName: storedFile.safeName,
          storageKey: storedFile.storageKey,
          mimeType: storedFile.mimeType,
          sizeBytes: storedFile.sizeBytes,
          sha256: storedFile.sha256,
          clientMutationId: parsed.data.clientMutationId,
        },
      });
      await tx.candidateDiagnosticAuditLog.create({
        data: {
          diagnosticId,
          actorId: sessionOrError.user.id,
          actorRole: actorRole(sessionOrError),
          action: 'DOCUMENT_UPLOADED',
          entityType: 'CandidateDiagnosticDocument',
          entityId: created.id,
          details: { category: created.category, sizeBytes: created.sizeBytes, sha256: created.sha256 },
        },
      });
      return created;
    });
    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        category: document.category,
        title: document.title,
        originalName: document.originalName,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        status: document.status,
        createdAt: document.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    if (stored?.storageKey) await removePersistedDiagnosticFile(stored.storageKey);
    const code = error instanceof Error ? error.message : 'UPLOAD_FAILED';
    const status = code === 'INVALID_FILE_SIZE' ? 413 : code === 'AV_SCAN_FAILED' || code === 'AV_NOT_CONFIGURED' ? 503 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
