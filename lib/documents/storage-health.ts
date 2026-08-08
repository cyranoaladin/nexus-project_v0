import { accessSync, constants, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { getDocumentStorageRoot } from './storage-root';

/**
 * Garde-fou de cohérence du stockage des documents.
 *
 * Incident à l'origine : `DOCUMENT_STORAGE_ROOT` pointait vers un répertoire
 * vide pendant que dix-neuf fichiers réels — dont des factures nominatives —
 * vivaient à un chemin hérité voisin. Rien ne le signalait. Le téléchargement
 * était cassé en silence pour les familles, et la divergence n'a été découverte
 * qu'en comparant la base au disque.
 *
 * Deux défauts sont donc distingués, parce qu'ils n'appellent pas la même
 * réaction :
 *
 * - une **racine inutilisable** empêche tout dépôt : c'est une panne, il faut
 *   échouer bruyamment au démarrage plutôt qu'au premier téléversement ;
 * - des **données hors racine** n'empêchent rien : le service fonctionne, mais
 *   un héritage traîne. C'est une alerte à traiter par un humain, pas un motif
 *   de refuser de démarrer.
 */

export type DocumentStorageProblem =
  | 'ROOT_MISSING'
  | 'ROOT_NOT_A_DIRECTORY'
  | 'ROOT_NOT_WRITABLE'
  | 'DATA_OUTSIDE_ROOT';

export type DataOutsideRoot = Readonly<{ path: string; fileCount: number }>;

export type DocumentStorageHealth = Readonly<{
  root: string;
  healthy: boolean;
  problems: readonly DocumentStorageProblem[];
  dataOutsideRoot: readonly DataOutsideRoot[];
}>;

/** Défauts qui empêchent réellement de stocker, par opposition aux alertes. */
const BLOCKING: ReadonlySet<DocumentStorageProblem> = new Set<DocumentStorageProblem>([
  'ROOT_MISSING',
  'ROOT_NOT_A_DIRECTORY',
  'ROOT_NOT_WRITABLE',
]);

/**
 * Emplacements où des documents ont historiquement été écrits, relatifs au
 * parent de la racine configurée. Cette liste vise l'héritage constaté ; elle
 * n'a pas vocation à être exhaustive de tous les chemins imaginables.
 */
const LEGACY_RELATIVE_PATHS: readonly string[] = Object.freeze([
  path.join('storage', 'documents'),
  path.join('storage', 'invoices'),
  path.join('data', 'invoices'),
]);

function countFiles(directory: string): number {
  let total = 0;
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) total += countFiles(path.join(directory, entry.name));
    else if (entry.isFile()) total += 1;
  }
  return total;
}

export function checkDocumentStorageHealth(): DocumentStorageHealth {
  const root = path.resolve(getDocumentStorageRoot());
  const problems: DocumentStorageProblem[] = [];

  let rootUsable = false;
  try {
    const stats = statSync(root);
    if (!stats.isDirectory()) problems.push('ROOT_NOT_A_DIRECTORY');
    else {
      rootUsable = true;
      try {
        accessSync(root, constants.W_OK);
      } catch {
        problems.push('ROOT_NOT_WRITABLE');
      }
    }
  } catch {
    problems.push('ROOT_MISSING');
  }

  const dataOutsideRoot: DataOutsideRoot[] = [];
  if (rootUsable) {
    const parent = path.dirname(root);
    for (const relative of LEGACY_RELATIVE_PATHS) {
      const candidate = path.resolve(parent, relative);
      // Un chemin situé sous la racine canonique n'est pas « hors racine ».
      if (candidate === root || candidate.startsWith(`${root}${path.sep}`)) continue;
      const fileCount = countFiles(candidate);
      if (fileCount > 0) dataOutsideRoot.push(Object.freeze({ path: candidate, fileCount }));
    }
    if (dataOutsideRoot.length > 0) problems.push('DATA_OUTSIDE_ROOT');
  }

  return Object.freeze({
    root,
    healthy: !problems.some((problem) => BLOCKING.has(problem)),
    problems: Object.freeze(problems),
    dataOutsideRoot: Object.freeze(dataOutsideRoot),
  });
}

/**
 * Échoue si le stockage est inutilisable. À appeler au démarrage : mieux vaut
 * refuser de servir qu'accepter un dépôt qui finira nulle part.
 *
 * Les données hors racine ne lèvent pas — elles sont remontées par
 * `checkDocumentStorageHealth` pour supervision.
 */
export function assertDocumentStorageReady(): DocumentStorageHealth {
  const health = checkDocumentStorageHealth();
  if (!health.healthy) {
    const blocking = health.problems.filter((problem) => BLOCKING.has(problem));
    throw new Error(`DOCUMENT_STORAGE_UNAVAILABLE:${blocking.join(',')}:${health.root}`);
  }
  return health;
}
