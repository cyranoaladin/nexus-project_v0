/**
 * Tombstone des références de fichiers mortes.
 *
 * Constat empirique du 8 août 2026, mesuré sur la production :
 *
 *   user_documents : 13 références, 19 fichiers sur disque, 0 correspondance
 *   invoices       :  4 références, 15 fichiers sur disque, 0 correspondance
 *
 * Aucune correspondance, pas même par nom de fichier ; les conventions de
 * nommage et les périodes ne se recouvrent pas. Les fichiers référencés ont été
 * perdus lors de la migration Docker vers les répertoires de release. **Le
 * relink est impossible : il n'y a rien à restaurer.**
 *
 * Ce script ne supprime rien et ne touche à aucun fichier. Il marque les lignes
 * dont le fichier est introuvable, pour que le téléchargement réponde
 * franchement au lieu d'échouer obscurément.
 *
 * Exécution par défaut en simulation. `--apply` écrit réellement.
 *
 *   npx tsx scripts/documents/tombstone-dead-references.ts
 *   npx tsx scripts/documents/tombstone-dead-references.ts --apply
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

import { getDocumentStorageRoot } from '../../lib/documents/storage-root';
import { LEGACY_STORAGE_PREFIX } from '../../lib/documents/storage-root';

export const TOMBSTONE_REASON =
  'Fichier perdu lors de la migration Docker vers les répertoires de release (constat du 2026-08-08). Aucune restauration possible.';

/** Reproduit la résolution du téléchargement, pour juger sur le même critère. */
export function resolveStoredPath(rawPath: string, storageRoot: string): string | null {
  if (/^https?:\/\//i.test(rawPath)) return null;
  if (rawPath.startsWith(LEGACY_STORAGE_PREFIX)) {
    return path.resolve(storageRoot, rawPath.slice(LEGACY_STORAGE_PREFIX.length));
  }
  if (rawPath.startsWith('/')) return path.resolve(rawPath);
  return path.resolve(storageRoot, rawPath);
}

export function isFileMissing(rawPath: string | null, storageRoot: string): boolean {
  if (!rawPath || rawPath.trim() === '') return true;
  const resolved = resolveStoredPath(rawPath, storageRoot);
  if (resolved === null) return true;
  return !existsSync(resolved);
}

type Report = Readonly<{
  documentsChecked: number;
  documentsTombstoned: number;
  invoicesChecked: number;
  invoicesTombstoned: number;
  applied: boolean;
}>;

export async function tombstoneDeadReferences(
  prisma: PrismaClient,
  options: Readonly<{ apply: boolean }>,
): Promise<Report> {
  const storageRoot = path.resolve(getDocumentStorageRoot());

  const documents = await prisma.userDocument.findMany({
    where: { unavailableReason: null },
    select: { id: true, localPath: true },
  });
  const deadDocuments = documents.filter((row) => isFileMissing(row.localPath, storageRoot));

  const invoices = await prisma.invoice.findMany({
    where: { pdfPath: { not: null } },
    select: { id: true, pdfPath: true },
  });
  const deadInvoices = invoices.filter((row) => isFileMissing(row.pdfPath, storageRoot));

  if (options.apply) {
    if (deadDocuments.length > 0) {
      await prisma.userDocument.updateMany({
        where: { id: { in: deadDocuments.map((row) => row.id) } },
        data: { unavailableReason: TOMBSTONE_REASON },
      });
    }
    // `pdfPath` est nullable : l'absence de PDF est déjà un état légitime,
    // déjà porté par une facture. Inutile d'ajouter une colonne ici.
    if (deadInvoices.length > 0) {
      await prisma.invoice.updateMany({
        where: { id: { in: deadInvoices.map((row) => row.id) } },
        data: { pdfPath: null },
      });
    }
  }

  return Object.freeze({
    documentsChecked: documents.length,
    documentsTombstoned: deadDocuments.length,
    invoicesChecked: invoices.length,
    invoicesTombstoned: deadInvoices.length,
    applied: options.apply,
  });
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  try {
    const report = await tombstoneDeadReferences(prisma, { apply });
    process.stdout.write(
      `${apply ? 'APPLIQUÉ' : 'SIMULATION'}\n`
      + `documents  : ${report.documentsTombstoned}/${report.documentsChecked} à marquer\n`
      + `factures   : ${report.invoicesTombstoned}/${report.invoicesChecked} à marquer\n`
      + (apply ? '' : '\nAucune écriture. Relancer avec --apply pour appliquer.\n'),
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
