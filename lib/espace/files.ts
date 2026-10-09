/**
 * Fichiers privés de l'espace pédagogique : copies déposées par les élèves
 * (PDF, JPEG, PNG) et ressources de cours (sujets, corrigés).
 *
 * Règles :
 *  - jamais servis depuis un dossier public : toujours via une route
 *    authentifiée qui recontrôle le droit d'accès à chaque lecture ;
 *  - le nom côté serveur est un UUID : le nom donné par l'élève n'est ni un
 *    chemin ni un identifiant, seulement un libellé d'affichage assaini ;
 *  - le type est déterminé par les premiers octets, jamais par l'en-tête
 *    déclaré par le navigateur ;
 *  - les lectures passent par `openSecureDocument` (confinement, realpath,
 *    fichier régulier, taille bornée).
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Subject } from '@prisma/client';

import { getDocumentStorageRoot } from '@/lib/documents/storage-root';
import { SecureFileAccessError, openSecureDocument, type SecureDocument } from '@/lib/documents/secure-file-access';
import { prisma } from '@/lib/prisma';
import { scanPrivateFile } from '@/lib/security/private-file-antivirus';

import { loadWorkForActor } from './access';
import { getActivityDef } from './catalog';
import { EspaceError } from './errors';
import type { EspaceActor } from './guards';
import { applyAction, isStudentEditable } from './work-state';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_WORK = 10;

const KINDS = {
  pdf: { mime: 'application/pdf', ext: 'pdf' },
  jpeg: { mime: 'image/jpeg', ext: 'jpg' },
  png: { mime: 'image/png', ext: 'png' },
} as const;

/** Type réel d'après les octets de tête ; `null` si ce n'est ni PDF, ni JPEG, ni PNG. */
export function sniffUpload(bytes: Uint8Array): (typeof KINDS)[keyof typeof KINDS] | null {
  const startsWith = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (bytes.length >= 5 && startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) return KINDS.pdf; // %PDF-
  if (bytes.length >= 3 && startsWith([0xff, 0xd8, 0xff])) return KINDS.jpeg;
  if (bytes.length >= 8 && startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return KINDS.png;
  return null;
}

/** Libellé d'affichage assaini : pas de chemin, pas de caractère de contrôle, longueur bornée. */
export function sanitizeDisplayName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|?*:]/g, '_').replace(/^\.+/, '').trim();
  return (cleaned || 'fichier').slice(-80);
}

function uploadsDir(workId: string): string {
  return path.join(getDocumentStorageRoot(), 'espace', 'uploads', workId);
}

export interface AttachmentDto {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export async function listAttachments(actor: EspaceActor, workId: string): Promise<AttachmentDto[]> {
  await loadWorkForActor(actor, workId);
  const rows = await prisma.espaceWorkAttachment.findMany({ where: { workId }, orderBy: { createdAt: 'asc' } });
  return rows.map((r) => ({ id: r.id, originalName: r.originalName, mimeType: r.mimeType, sizeBytes: r.sizeBytes, createdAt: r.createdAt.toISOString() }));
}

export async function saveAttachment(
  actor: EspaceActor,
  workId: string,
  file: { name: string; bytes: Uint8Array },
): Promise<AttachmentDto> {
  const { work } = await loadWorkForActor(actor, workId, 'student');
  if (work.activity.kind !== 'UPLOAD_EXERCISE') throw new EspaceError('UPLOAD_REJECTED', 'Cette activité n’accepte pas de fichier');
  if (!isStudentEditable(work.status)) throw new EspaceError('WORK_LOCKED', 'Ce travail est remis : lecture seule');
  if (file.bytes.byteLength === 0 || file.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new EspaceError('UPLOAD_REJECTED', 'Fichier vide ou trop volumineux (8 Mo maximum)');
  }
  const kind = sniffUpload(file.bytes);
  if (!kind) throw new EspaceError('UPLOAD_REJECTED', 'Format non accepté : PDF, JPEG ou PNG uniquement');
  if ((await prisma.espaceWorkAttachment.count({ where: { workId } })) >= MAX_ATTACHMENTS_PER_WORK) {
    throw new EspaceError('UPLOAD_REJECTED', 'Nombre maximal de fichiers atteint');
  }

  const dir = uploadsDir(workId);
  const filename = `${randomUUID()}.${kind.ext}`;
  const absolute = path.join(dir, filename);
  const storagePath = path.posix.join('espace', 'uploads', workId, filename);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(absolute, file.bytes, { mode: 0o600, flag: 'wx' });

  try {
    try { await scanPrivateFile(absolute); }
    catch (error) {
      if (error instanceof Error && error.message.startsWith('MALWARE_DETECTED')) {
        throw new EspaceError('UPLOAD_REJECTED', 'Fichier refusé par le contrôle de sécurité.');
      }
      throw new EspaceError('UPLOAD_SCAN_UNAVAILABLE', 'Vérification du fichier indisponible. Réessayez ultérieurement.');
    }
    const now = new Date();
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.espaceWorkAttachment.create({
        data: {
          workId,
          uploadedById: actor.id,
          storagePath,
          mimeType: kind.mime,
          sizeBytes: file.bytes.byteLength,
          sha256: createHash('sha256').update(file.bytes).digest('hex'),
          originalName: sanitizeDisplayName(file.name),
        },
      });
      // Déposer un fichier est un enregistrement : le travail est commencé.
      const updated = await tx.espaceWork.updateMany({
        where: { id: workId, status: work.status },
        data: { status: applyAction(work.status, 'SAVE'), revision: { increment: 1 }, lastSavedAt: now },
      });
      if (updated.count !== 1) throw new EspaceError('WORK_LOCKED', 'Ce travail vient d’être remis');
      return created;
    });
    return { id: row.id, originalName: row.originalName, mimeType: row.mimeType, sizeBytes: row.sizeBytes, createdAt: row.createdAt.toISOString() };
  } catch (e) {
    await unlink(absolute).catch(() => undefined); // pas d'orphelin si la base refuse
    throw e;
  }
}

export async function deleteAttachment(actor: EspaceActor, workId: string, attachmentId: string): Promise<void> {
  const { work } = await loadWorkForActor(actor, workId, 'student');
  if (!isStudentEditable(work.status)) throw new EspaceError('WORK_LOCKED', 'Ce travail est remis : lecture seule');
  const row = await prisma.espaceWorkAttachment.findFirst({ where: { id: attachmentId, workId } });
  if (!row) throw new EspaceError('NOT_FOUND', 'Fichier introuvable');
  await prisma.espaceWorkAttachment.delete({ where: { id: row.id } });
  await unlink(path.join(getDocumentStorageRoot(), row.storagePath)).catch(() => undefined);
}

export interface OpenedFile {
  doc: SecureDocument;
  mimeType: string;
  filename: string;
}

function mapStorageError(e: unknown): never {
  if (e instanceof SecureFileAccessError) throw new EspaceError('NOT_FOUND', 'Fichier introuvable');
  throw e;
}

export async function openAttachment(actor: EspaceActor, workId: string, attachmentId: string): Promise<OpenedFile> {
  await loadWorkForActor(actor, workId); // élève propriétaire ou enseignant du groupe, sinon 404
  const row = await prisma.espaceWorkAttachment.findFirst({ where: { id: attachmentId, workId } });
  if (!row) throw new EspaceError('NOT_FOUND', 'Fichier introuvable');
  try {
    const doc = await openSecureDocument(getDocumentStorageRoot(), row.storagePath, { maxSizeBytes: MAX_UPLOAD_BYTES });
    return { doc, mimeType: row.mimeType, filename: row.originalName };
  } catch (e) {
    return mapStorageError(e);
  }
}

// ─── Ressources de cours ────────────────────────────────────────────────────

async function teachesSubject(actor: EspaceActor, subject: Subject): Promise<boolean> {
  if (actor.role === 'ADMIN') return true;
  if (actor.role !== 'COACH') return false;
  return (await prisma.espaceTeacherAssignment.count({ where: { teacherId: actor.id, subject } })) > 0;
}

/**
 * Ressource d'activité. Un corrigé (audience TEACHER) n'est JAMAIS servi à un
 * élève ; un sujet (audience STUDENT) l'est aux inscrits à la matière.
 * Réponse 404 uniforme pour « inconnu » et « interdit ».
 */
export async function openResource(actor: EspaceActor, activitySlug: string, key: string): Promise<OpenedFile> {
  const def = getActivityDef(activitySlug);
  const res = def?.resources.find((r) => r.key === key);
  if (!def || !res) throw new EspaceError('NOT_FOUND', 'Ressource introuvable');

  let allowed = false;
  if (res.audience === 'TEACHER') {
    allowed = actor.role !== 'ELEVE' && (await teachesSubject(actor, def.subject));
  } else if (actor.role === 'ELEVE') {
    allowed = (await prisma.espaceEnrollment.count({ where: { userId: actor.id, subject: def.subject } })) > 0;
  } else {
    allowed = await teachesSubject(actor, def.subject);
  }
  if (!allowed) throw new EspaceError('NOT_FOUND', 'Ressource introuvable');

  try {
    const doc = await openSecureDocument(getDocumentStorageRoot(), path.posix.join('espace', 'resources', def.moduleSlug, res.file), {
      maxSizeBytes: 32 * 1024 * 1024,
    });
    return { doc, mimeType: res.mimeType, filename: `${def.moduleSlug}-${res.key}.pdf` };
  } catch (e) {
    return mapStorageError(e);
  }
}
