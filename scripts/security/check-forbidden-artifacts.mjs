#!/usr/bin/env node
/**
 * Garde-fou : empêche la réintroduction d'artefacts dont la diffusion n'est pas
 * autorisée.
 *
 * ── Ce que ce scanner n'imprime JAMAIS ───────────────────────────────────────
 * Ni nom de fichier, ni chemin, ni contenu, ni identité. Un des artefacts visés
 * porte l'identité d'un tiers DANS SON NOM DE FICHIER : un rapport d'échec qui
 * afficherait le chemin recréerait l'exposition au moment précis où le garde-fou
 * se déclenche, et l'inscrirait dans les journaux de CI. Les correspondances
 * sont donc désignées par un identifiant d'artefact et un localisateur
 * caviardé — l'empreinte du chemin, stable d'une exécution à l'autre, qui
 * permet de vérifier qu'on a bien retiré le bon fichier sans jamais l'écrire.
 *
 * ── Fail-closed ──────────────────────────────────────────────────────────────
 * Une racine absente, illisible, ou une erreur de parcours ne doivent jamais
 * produire « 0 candidat, PASS » : un contrôle mal ciblé serait indiscernable
 * d'un artefact propre. Toute anomalie d'accès renvoie un code non nul.
 *
 * ── Un seul moteur ───────────────────────────────────────────────────────────
 * Le même exécutable analyse l'arbre source et l'artefact de production. Seuls
 * la racine et le manifeste varient.
 *
 *   node scripts/security/check-forbidden-artifacts.mjs [racine] [--manifest <fichier>]
 *
 * Codes de sortie :
 *   0  aucun artefact interdit
 *   1  au moins un artefact interdit présent
 *   2  le contrôle n'a pas pu être mené (racine ou manifeste inexploitable)
 */

import { createHash } from 'node:crypto';
import { accessSync, constants, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const EXIT_OK = 0;
const EXIT_FORBIDDEN_PRESENT = 1;
const EXIT_SCAN_FAILED = 2;

// Rien n'est exclu du parcours hormis .git : l'artefact uploadé comprend
// l'intégralité de .next/, cache compris. Le filtre par taille garde le
// contrôle rapide sans réduire sa couverture.
const SKIP_DIRECTORIES = new Set(['.git']);

function parseArguments(argv) {
  const positional = [];
  let manifest = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--manifest') {
      manifest = argv[i + 1];
      i += 1;
    } else {
      positional.push(argv[i]);
    }
  }
  return {
    root: positional[0] ?? process.cwd(),
    manifestPath:
      manifest ?? path.join(process.cwd(), 'data/security/forbidden-artifacts.json'),
  };
}

function failScan(reason) {
  process.stdout.write(
    `${JSON.stringify(
      { check: 'FORBIDDEN_ARTIFACT_GATE', status: 'SCAN_FAILED', reason, pass: false },
      null,
      2,
    )}\n`,
  );
  process.stderr.write(`\nFORBIDDEN_ARTIFACT_GATE=FAIL — ${reason}\n`);
  process.exit(EXIT_SCAN_FAILED);
}

/** Empreinte Git d'un fichier : `blob <taille>\0<contenu>` en SHA-1. */
function gitBlobSha1(file) {
  const content = readFileSync(file);
  return createHash('sha1')
    .update(`blob ${content.length}\0`)
    .update(content)
    .digest('hex');
}

/** Localisateur caviardé : déterministe, non réversible, sans information lisible. */
function locatorDigest(relativePath) {
  return createHash('sha256').update(relativePath).digest('hex').slice(0, 16);
}

/**
 * Parcours récursif. Une erreur de lecture n'est jamais avalée : elle est
 * comptée, et fait échouer le contrôle.
 */
function* walk(dir, errors) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    errors.push(dir);
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) yield* walk(full, errors);
    else if (entry.isFile()) yield full;
  }
}

const { root, manifestPath } = parseArguments(process.argv.slice(2));

// ── Validation de la racine, avant tout parcours ─────────────────────────────
let rootStats;
try {
  rootStats = statSync(root);
} catch {
  failScan('SCAN_ROOT_MISSING');
}
if (!rootStats.isDirectory()) failScan('SCAN_ROOT_NOT_A_DIRECTORY');
try {
  accessSync(root, constants.R_OK | constants.X_OK);
} catch {
  failScan('SCAN_ROOT_NOT_READABLE');
}

// ── Manifeste ────────────────────────────────────────────────────────────────
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
} catch {
  failScan('POLICY_MANIFEST_UNREADABLE');
}
if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
  failScan('POLICY_MANIFEST_EMPTY');
}

const forbidden = new Map(
  manifest.artifacts.map((artifact) => [artifact.gitBlobSha1, artifact]),
);
const forbiddenSizes = new Set(manifest.artifacts.map((artifact) => artifact.bytes));

// ── Parcours ─────────────────────────────────────────────────────────────────
const traversalErrors = [];
let candidatesHashed = 0;
const matches = [];

for (const file of walk(root, traversalErrors)) {
  // La taille filtre à moindre coût : seuls les fichiers de taille exacte sont
  // ensuite hachés, ce qui garde le contrôle rapide sur un dépôt entier.
  let size;
  try {
    size = statSync(file).size;
  } catch {
    traversalErrors.push(path.dirname(file));
    continue;
  }
  if (!forbiddenSizes.has(size)) continue;

  candidatesHashed += 1;
  let sha;
  try {
    sha = gitBlobSha1(file);
  } catch {
    traversalErrors.push(path.dirname(file));
    continue;
  }

  const artifact = forbidden.get(sha);
  if (artifact) {
    matches.push({
      artifactId: artifact.id,
      classification: artifact.classification,
      // Localisateur caviardé : ni chemin, ni nom de fichier.
      locatorDigest: locatorDigest(path.relative(root, file)),
    });
  }
}

if (traversalErrors.length > 0) {
  failScan(`SCAN_TRAVERSAL_FAILED (${traversalErrors.length} emplacement(s) illisible(s))`);
}

const report = {
  check: 'FORBIDDEN_ARTIFACT_GATE',
  status: matches.length === 0 ? 'CLEAN' : 'FORBIDDEN_PRESENT',
  forbiddenCount: forbidden.size,
  candidatesHashed,
  matches,
  pass: matches.length === 0,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (matches.length > 0) {
  process.stderr.write(
    '\nFORBIDDEN_ARTIFACT_GATE=FAIL — un artefact non autorisé est présent.\n' +
      'Les identifiants ci-dessus renvoient à data/security/forbidden-artifacts.json.\n' +
      "Le chemin n'est volontairement pas affiché : le nom de fichier fait partie de\n" +
      'ce qui doit être retiré. Recherchez par empreinte dans votre arbre local.\n',
  );
  process.exit(EXIT_FORBIDDEN_PRESENT);
}

process.stdout.write('FORBIDDEN_ARTIFACT_GATE=PASS\n');
process.exit(EXIT_OK);
