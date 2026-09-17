#!/usr/bin/env node
// check-assessment-confidentiality.mjs — refuse toute trace de banque de diagnostic
// vivante (questions, clés de correction, corrections coach, solutions d'audit) dans
// ce dépôt public. Contexte : incident du 2026-09-16, voir
// docs/BILAN_DIAGNOSTIC_CL/audit/PUBLIC_ASSESSMENT_EXPOSURE.json et le dépôt privé
// nexus-diagnostics-private, incident/2026-09-public-assessment-exposure/.
//
// Deux familles de règles, jamais une seule :
//   - chemin  : un chemin qui, par construction, ne doit exister nulle part dans ce
//               dépôt (release compilée, corrections coach, extraction de référence),
//               quel que soit son contenu ;
//   - contenu : une structure JSON qui a la forme d'une banque vivante (un objet
//               `cle` portant `reponse`) ou d'un audit d'items avec solution en clair,
//               même si le fichier a été renommé ou déplacé hors des chemins connus.
//
// Usage : --staged | --root <dir> | --ref <sha> | rien (git ls-files du répertoire
// de travail). --ref <sha> vérifie l'arbre exact d'un commit, sans le mettre à jour
// dans le répertoire de travail — c'est le mode du hook pre-push, qui doit juger ce
// qui part réellement, pas l'état courant du poste.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

// Exception unique, adressée par contenu et non par chemin : le fichier renommé ou
// modifié ne matcherait plus ce sha256, donc un vrai contenu glissé sous ce chemin
// resterait détecté — ce n'est pas une allowlist de chemin exploitable.
const FIXTURE_SYNTHETIQUE_AUTORISEE = new Map([
  ['__tests__/fixtures/diagnostic-demo/form.json',
    'ddf768c8bbee5e79faccb53e0b1ba8510e5fb6c3a5b53bdfad6a05301790639a'],
]);

const rootArg = process.argv.indexOf('--root');
const customRoot = rootArg >= 0 ? resolve(process.argv[rootArg + 1] ?? '') : null;
const staged = process.argv.includes('--staged');
const refArg = process.argv.indexOf('--ref');
const ref = refArg >= 0 ? process.argv[refArg + 1] : null;
const root = customRoot ?? process.cwd();

if ([staged, Boolean(customRoot), Boolean(ref)].filter(Boolean).length > 1) {
  throw new Error('--staged, --root et --ref ne se combinent pas entre eux');
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return entry.isFile() ? [absolute] : [];
  });
}

function trackedFiles() {
  if (customRoot) {
    return walk(root).map((absolute) => ({
      absolute,
      path: relative(root, absolute).replaceAll('\\', '/'),
    }));
  }
  if (ref) {
    return execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', ref], { cwd: root })
      .toString('utf8')
      .split('\0')
      .filter(Boolean)
      .map((path) => ({ absolute: null, path }));
  }
  const gitArguments = staged
    ? ['diff', '--cached', '--name-only', '--diff-filter=AM', '-z']
    : ['ls-files', '-z'];
  return execFileSync('git', gitArguments, { cwd: root })
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((path) => ({ absolute: resolve(root, path), path }));
}

// --- Règles de chemin : un chemin bloqué l'est indépendamment de son contenu -----

const blockedPathPatterns = [
  { code: 'DIAGNOSTIC_INSTRUMENT_BANK_PATH', pattern: /(^|\/)instruments\/[^/_][^/]*\/banque\.json$/ },
  { code: 'DIAGNOSTIC_COACH_CORRECTIONS_PATH', pattern: /(^|\/)02_CORRECTIONS_COACH\// },
  { code: 'DIAGNOSTIC_COMPILED_RELEASE_PATH', pattern: /(^|\/)release\/diagnostics-v\d/ },
  { code: 'DIAGNOSTIC_ITEM_AUDIT_PATH', pattern: /(^|\/)ITEM_AUDIT\.jsonl$/ },
  { code: 'DIAGNOSTIC_FINDINGS_PATH', pattern: /(^|\/)FINDINGS\.jsonl$/ },
  { code: 'DIAGNOSTIC_REFERENCE_EXTRACTION_PATH', pattern: /(^|\/)reference\/v2-compromised\// },
  { code: 'DIAGNOSTIC_OPERATIONAL_PATH', pattern: /(^|\/)operational\// },
];

// --- Règles de contenu : structure JSON d'une banque vivante ou d'un audit --------

function isLiveAnswerKeyStructure(value, depth = 0) {
  if (depth > 6 || value === null || typeof value !== 'object') return false;
  if (!Array.isArray(value)) {
    if (
      Object.prototype.hasOwnProperty.call(value, 'cle')
      && value.cle && typeof value.cle === 'object'
      && Object.prototype.hasOwnProperty.call(value.cle, 'reponse')
    ) {
      return true;
    }
    // Schéma V3 (options sémantiques) : un objet portant à la fois `options`
    // (tableau d'entrées {id, text, ...}) et `correct_option_id` est un item vivant
    // sous sa forme moderne, même si aucun champ ne s'appelle `cle`/`reponse`.
    if (
      Object.prototype.hasOwnProperty.call(value, 'options')
      && Array.isArray(value.options)
      && value.options.some((o) => o && typeof o === 'object' && 'id' in o && 'text' in o)
      && Object.prototype.hasOwnProperty.call(value, 'correct_option_id')
    ) {
      return true;
    }
  }
  const children = Array.isArray(value) ? value : Object.values(value);
  return children.some((child) => isLiveAnswerKeyStructure(child, depth + 1));
}

function isItemAuditSolutionLine(obj) {
  return obj && typeof obj === 'object'
    && Object.prototype.hasOwnProperty.call(obj, 'item_id')
    && Object.prototype.hasOwnProperty.call(obj, 'my_solution');
}

function contentFindings(path, source) {
  if (!/\.jsonl?$/.test(path)) return [];
  const out = [];
  if (path.endsWith('.jsonl')) {
    let lineNo = 0;
    for (const line of source.split('\n')) {
      lineNo += 1;
      if (!line.trim()) continue;
      let obj;
      try { obj = JSON.parse(line); } catch { continue; }
      if (isItemAuditSolutionLine(obj)) {
        out.push({ code: 'LIVE_ITEM_SOLUTION_STRUCTURE', path, line: lineNo });
      } else if (isLiveAnswerKeyStructure(obj)) {
        out.push({ code: 'LIVE_ANSWER_KEY_STRUCTURE', path, line: lineNo });
      }
    }
    return out;
  }
  let parsed;
  try { parsed = JSON.parse(source); } catch { return out; }
  if (isLiveAnswerKeyStructure(parsed)) {
    out.push({ code: 'LIVE_ANSWER_KEY_STRUCTURE', path, line: 1 });
  }
  return out;
}

// --- Balayage -----------------------------------------------------------------

const findings = [];
for (const { absolute, path } of trackedFiles()) {
  if (!staged && !customRoot && !ref) {
    try { if (!statSync(absolute).isFile()) continue; } catch { continue; }
  }

  for (const { code, pattern } of blockedPathPatterns) {
    if (pattern.test(path)) findings.push({ code, path, line: 0 });
  }

  if (!/\.jsonl?$/.test(path)) continue;
  let source;
  try {
    if (ref) {
      source = execFileSync('git', ['show', `${ref}:${path}`], { cwd: root, encoding: 'utf8' });
    } else if (staged) {
      source = execFileSync('git', ['show', `:${path}`], { cwd: root, encoding: 'utf8' });
    } else {
      source = readFileSync(absolute, 'utf8');
    }
  } catch { continue; }

  const pinAttendu = FIXTURE_SYNTHETIQUE_AUTORISEE.get(path);
  if (pinAttendu) {
    const empreinte = createHash('sha256').update(source, 'utf8').digest('hex');
    if (empreinte === pinAttendu) continue; // contenu synthétique connu, inchangé
    // Le chemin est celui de la fixture connue, mais le contenu a changé : ne
    // JAMAIS laisser passer silencieusement — un vrai contenu glissé sous ce nom
    // doit être détecté comme n'importe quel autre fichier.
  }
  findings.push(...contentFindings(path, source));
}

if (findings.length > 0) {
  for (const f of findings) {
    console.error(f.line ? `${f.code} ${f.path}:${f.line}` : `${f.code} ${f.path}`);
  }
  const distinctPaths = new Set(findings.map((f) => f.path)).size;
  console.error(`FAIL: ${findings.length} indice(s) de diagnostic confidentiel (banque, clé, correction coach, solution d'audit) sur ${distinctPaths} chemin(s). Ce contenu vit exclusivement dans le dépôt privé nexus-diagnostics-private.`);
  process.exit(1);
}

console.log('OK: aucune trace de banque, clé, correction coach ou solution d\'audit de diagnostic dans ce dépôt.');
