import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isErrorResponse } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { documentMetadataSchema } from '@/lib/diagnostics/candidat-libre/schemas';
import { getDiagnosticForActor, requireDiagnosticActor, actorRole, isDocumentVisibleToViewer } from '@/lib/diagnostics/candidat-libre/access.server';
import { persistDiagnosticFile, removePersistedDiagnosticFile } from '@/lib/diagnostics/candidat-libre/storage.server';
import { CANDIDATE_DIAGNOSTIC_MODULES } from '@/lib/diagnostics/candidat-libre/definition.public';
import { assertDiagnosticAvConfigured } from '@/lib/diagnostics/candidat-libre/virus-scan.server';
import { requireVerifiedParentalConsent } from '@/lib/diagnostics/candidat-libre/consent-gate.server';
import { guardCandidateDiagnosticFeature, guardCandidateDiagnosticForStudent } from '@/lib/diagnostics/candidat-libre/feature-flag';

interface Params { params: Promise<{ diagnosticId: string }> }

const CATEGORY_RULES = new Map(
  CANDIDATE_DIAGNOSTIC_MODULES.flatMap((module) => module.questions)
    .filter((question) => question.type === 'upload' && question.uploadRule)
    .map((question) => [question.uploadRule!.category, question.uploadRule!] as const),
);

/**
 * Les seuls champs d'un dépôt qui peuvent sortir vers le client.
 *
 * `storageKey` est le chemin disque privé du document d'un mineur, et `sha256`
 * ne sert qu'à l'audit : ni l'un ni l'autre n'a de raison de traverser la
 * frontière HTTP. La liste est UNIQUE, et les deux chemins de réponse — la
 * création et le renvoi idempotent — en dérivent, de sorte qu'ils ne puissent
 * plus diverger : c'était précisément la cause de la fuite.
 */
const PUBLIC_DOCUMENT_KEYS = [
  'id', 'category', 'title', 'originalName', 'mimeType', 'sizeBytes', 'status', 'createdAt',
] as const;

type PublicDocumentKey = (typeof PUBLIC_DOCUMENT_KEYS)[number];

/** Forme `select` de Prisma, dérivée de la même liste. */
const PUBLIC_DOCUMENT_FIELDS = Object.fromEntries(
  PUBLIC_DOCUMENT_KEYS.map((key) => [key, true]),
) as Record<PublicDocumentKey, true>;

/** Projette une ligne déjà lue, pour les chemins qui ont besoin du reste en interne. */
function publicDocument<T extends Record<string, unknown>>(row: T): Pick<T, PublicDocumentKey> {
  return Object.fromEntries(
    PUBLIC_DOCUMENT_KEYS.map((key) => [key, row[key]]),
  ) as Pick<T, PublicDocumentKey>;
}

const PUBLIC_UPLOAD_ERRORS = new Map<string, number>([
  ['INVALID_FILE_SIZE', 413],
  ['UNSUPPORTED_FILE_TYPE', 400],
  ['MIME_SIGNATURE_MISMATCH', 400],
  ['MALWARE_DETECTED', 400],
  ['AV_SCAN_FAILED', 503],
  ['AV_NOT_CONFIGURED', 503],
  ['DOCUMENT_ENCRYPTION_KEY_INVALID', 503],
]);

export async function GET(_request: Request, { params }: Params) {
  const disabled = guardCandidateDiagnosticFeature();
  if (disabled) return disabled;
  const { diagnosticId } = await params;
  const sessionOrError = await requireDiagnosticActor();
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  const diagnosticOrError = await getDiagnosticForActor(sessionOrError, diagnosticId, 'read');
  if (diagnosticOrError instanceof NextResponse) return diagnosticOrError;
  const viewerRole = sessionOrError.user.role;
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
  const diagnosticOrError = await getDiagnosticForActor(sessionOrError, diagnosticId, 'mutation');
  if (diagnosticOrError instanceof NextResponse) return diagnosticOrError;
  // Hors allowlist, le dossier doit paraitre absent : 404 avant tout autre verdict.
  const notAllowed = guardCandidateDiagnosticForStudent(diagnosticOrError.studentId);
  if (notAllowed) return notAllowed;

  // Dossier portant sur un mineur : aucune collecte avant consentement parental verifie.
  const consentBlocked = await requireVerifiedParentalConsent(diagnosticOrError.studentId);
  if (consentBlocked) return consentBlocked;
  if (diagnosticOrError.submittedAt) return NextResponse.json({ error: 'Diagnostic locked' }, { status: 423 });

  // Configuration antivirus explicite, verifiee AVANT de lire le moindre octet du depot.
  try {
    assertDiagnosticAvConfigured();
  } catch {
    return NextResponse.json({ error: 'AV_NOT_CONFIGURED' }, { status: 503 });
  }

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
    // Projection positive : `storageKey` est le chemin disque privé du dépôt
    // d'un mineur et ne doit jamais sortir. Un `select` vaut mieux qu'un
    // `omit` — un champ privé ajouté plus tard n'y entre pas par défaut.
    select: PUBLIC_DOCUMENT_FIELDS,
  });
  // Ceinture ET bretelles : le `select` ci-dessus empêche la base de livrer le
  // champ, et la projection empêche la réponse de le porter si quelqu'un
  // retirait un jour ce `select`. Les deux protections sont indépendantes.
  if (existing) return NextResponse.json({ success: true, idempotent: true, document: publicDocument(existing) });

  let stored: Awaited<ReturnType<typeof persistDiagnosticFile>> | null = null;
  try {
    // Le scan antivirus a lieu a l'interieur, sur le clair, avant chiffrement et ecriture.
    stored = await persistDiagnosticFile({ diagnosticId, file, category: parsed.data.category });
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
    // La ligne complète reste nécessaire en interne (l'audit consigne `sha256`),
    // donc elle est projetée ICI, à la frontière, avec la même liste.
    return NextResponse.json({ success: true, document: publicDocument(document) }, { status: 201 });
  } catch (error) {
    if (stored?.storageKey) await removePersistedDiagnosticFile(stored.storageKey);
    // Liste blanche : jamais de message brut (Prisma, chemins, ...) vers le client.
    const message = error instanceof Error ? error.message : '';
    const status = PUBLIC_UPLOAD_ERRORS.get(message);
    if (status === undefined) {
      console.error('[candidat-libre] document upload failed', error instanceof Error ? error.name : 'unknown');
      return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status });
  }
}
