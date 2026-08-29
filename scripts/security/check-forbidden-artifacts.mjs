#!/usr/bin/env node
/**
 * Garde-fou : empêche la réintroduction d'artefacts dont la diffusion n'est pas
 * autorisée.
 *
 * La comparaison porte sur l'EMPREINTE Git du contenu, jamais sur le nom :
 * renommer un fichier ne contourne rien, et le manifeste n'a pas besoin de
 * porter un chemin — donc pas d'information sensible.
 *
 *   node scripts/security/check-forbidden-artifacts.mjs [racine]
 *
 * Sans argument : analyse l'arbre de travail. Avec une racine, analyse un
 * artefact de build (ex. .next/standalone) avant déploiement.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] ?? process.cwd();
const MANIFEST = path.join(
  process.cwd(),
  'data/security/forbidden-artifacts.json',
);

const SKIP = new Set(['.git', 'node_modules', '.next/cache']);

/** Empreinte Git d'un fichier : `blob <taille>\0<contenu>` en SHA-1. */
function gitBlobSha1(file) {
  const content = readFileSync(file);
  return createHash('sha1')
    .update(`blob ${content.length}\0`)
    .update(content)
    .digest('hex');
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8'));
const forbidden = new Map(
  manifest.artifacts.map((artifact) => [artifact.gitBlobSha1, artifact]),
);
const sizes = new Set(manifest.artifacts.map((artifact) => artifact.bytes));

let scanned = 0;
const matches = [];

for (const file of walk(ROOT)) {
  // La taille est un filtre bon marché : seuls les fichiers de taille exacte
  // sont ensuite hachés, ce qui garde le contrôle rapide sur un dépôt entier.
  let size;
  try {
    size = statSync(file).size;
  } catch {
    continue;
  }
  if (!sizes.has(size)) continue;
  scanned += 1;
  const sha = gitBlobSha1(file);
  const artifact = forbidden.get(sha);
  if (artifact) {
    matches.push({ id: artifact.id, classification: artifact.classification, path: path.relative(ROOT, file) });
  }
}

const report = {
  check: 'FORBIDDEN_ARTIFACT_GATE',
  root: path.relative(process.cwd(), ROOT) || '.',
  forbiddenCount: forbidden.size,
  candidatesHashed: scanned,
  matches: matches.map((match) => ({ id: match.id, classification: match.classification, path: match.path })),
  pass: matches.length === 0,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (matches.length > 0) {
  process.stderr.write(
    '\nFORBIDDEN_ARTIFACT_GATE=FAIL — un artefact non autorisé est réapparu.\n' +
      'Retirez-le. Son empreinte figure dans data/security/forbidden-artifacts.json.\n',
  );
  process.exit(1);
}

process.stdout.write('FORBIDDEN_ARTIFACT_GATE=PASS\n');
