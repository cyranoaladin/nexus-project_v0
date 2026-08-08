import 'server-only';

import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { getDocumentStorageRoot } from '@/lib/documents/storage-root';

import { decryptDocument, encryptDocument, isEncryptedDocument } from '@/lib/documents/encryption';

export const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 30 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'audio/mp4',
  'audio/webm',
  'audio/wav',
]);

const MAGIC: Record<string, (buffer: Buffer) => boolean> = {
  'application/pdf': (b) => b.subarray(0, 5).toString('ascii') === '%PDF-',
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),
  'image/webp': (b) => b.subarray(0,4).toString('ascii') === 'RIFF' && b.subarray(8,12).toString('ascii') === 'WEBP',
  // MP3: either an ID3v2 tag or a raw MPEG frame sync (0xFF followed by 3 set high bits).
  'audio/mpeg': (b) => b.subarray(0, 3).toString('ascii') === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  // MP4/M4A container: ISO base media file format, "ftyp" box at offset 4.
  'audio/mp4': (b) => b.subarray(4, 8).toString('ascii') === 'ftyp',
  // WebM/Matroska: EBML header.
  'audio/webm': (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
  'audio/wav': (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WAVE',
};


export function resolveDiagnosticStoragePath(storageKey: string) {
  const root = path.resolve(getDocumentStorageRoot());
  const absolute = path.resolve(root, storageKey);
  if (!absolute.startsWith(`${root}${path.sep}`)) throw new Error('UNSAFE_STORAGE_PATH');
  return absolute;
}

export function sanitizeOriginalName(value: string) {
  return value.replace(/[\u0000-\u001f\\/:*?"<>|]/g, '_').slice(0, 180) || 'document';
}

export async function persistDiagnosticFile(input: {
  diagnosticId: string;
  file: File;
  category: string;
}) {
  if (!ALLOWED_MIME_TYPES.has(input.file.type)) throw new Error('UNSUPPORTED_FILE_TYPE');
  const max = input.file.type.startsWith('audio/') ? MAX_AUDIO_BYTES : MAX_DOCUMENT_BYTES;
  if (input.file.size <= 0 || input.file.size > max) throw new Error('INVALID_FILE_SIZE');
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const validator = MAGIC[input.file.type];
  if (validator && !validator(buffer)) throw new Error('MIME_SIGNATURE_MISMATCH');

  // Empreinte du contenu **en clair** : elle sert l'intégrité et la déduplication,
  // et doit rester stable indépendamment du chiffrement (IV aléatoire).
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const safeName = sanitizeOriginalName(input.file.name);

  // Le nom d'origine n'entre pas dans le chemin : un « bulletin_Dupont.pdf »
  // inscrirait le nom de l'enfant sur le disque, là où aucun chiffrement de
  // contenu ne le protège. Il n'est conservé qu'en base, pour l'affichage.
  const storageKey = path.join(
    'candidate-diagnostics',
    input.diagnosticId,
    input.category,
    `${randomUUID()}.enc`,
  );
  const absolute = resolveDiagnosticStoragePath(storageKey);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, encryptDocument(buffer, { documentId: storageKey }), {
    flag: 'wx',
    mode: 0o600,
  });
  return { storageKey, sha256, safeName, sizeBytes: buffer.byteLength, mimeType: input.file.type };
}

/**
 * Relit un document déposé.
 *
 * Les fichiers écrits avant l'introduction du chiffrement sont encore en clair ;
 * ils restent lisibles tels quels plutôt que de devenir inaccessibles. Tout
 * nouveau dépôt est chiffré.
 */
export async function readPersistedDiagnosticFile(storageKey: string): Promise<Buffer> {
  const { readFile } = await import('fs/promises');
  const absolute = resolveDiagnosticStoragePath(storageKey);
  const stored = await readFile(absolute);
  if (!isEncryptedDocument(stored)) return stored;
  return decryptDocument(stored, { documentId: storageKey });
}

export async function removePersistedDiagnosticFile(storageKey: string) {
  const { unlink } = await import('fs/promises');
  const absolute = resolveDiagnosticStoragePath(storageKey);
  await unlink(absolute).catch(() => undefined);
}
