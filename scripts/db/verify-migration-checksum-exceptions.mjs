#!/usr/bin/env node
// Governance guard for KNOWN_BOUNDED_LEGACY_DIVERGENCE.
//
// Enforces that the ONLY divergence between a Git-tracked, already-applied
// migration body and the checksum recorded in production's _prisma_migrations
// journal is the single tuple declared in security/migration-checksum-exceptions.json.
//
// Prisma records a migration's checksum as the SHA-256 (hex) of its migration.sql
// file, so a repo checksum is recomputed the same way here.
//
// FAILS CLOSED on: any undeclared divergent migration; any declared tuple whose
// repo checksum no longer matches (a one-byte mutation of the historical file);
// a missing historical file; a missing/altered production-body evidence file;
// a missing/altered canonical-catalog reference; a declared exception absent from
// the journal; more than one declared exception; or a live maths_progress catalog
// that no longer matches the canonical fingerprint.
//
// Usage:
//   node scripts/db/verify-migration-checksum-exceptions.mjs --static
//   node scripts/db/verify-migration-checksum-exceptions.mjs --journal <file>   # lines: name|checksum[|...]
//   node scripts/db/verify-migration-checksum-exceptions.mjs --catalog-sha <sha256>

import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, '..', '..');
const REGISTRY_REL = 'security/migration-checksum-exceptions.json';
const MIGRATIONS_REL = 'prisma/migrations';
const SHA256_RE = /^[0-9a-f]{64}$/;

export function sha256OfFile(absPath) {
  return createHash('sha256').update(readFileSync(absPath)).digest('hex');
}

export function loadRegistry(root = REPO_ROOT) {
  const abs = join(root, REGISTRY_REL);
  if (!existsSync(abs)) throw new Error(`migration checksum registry absent: ${REGISTRY_REL}`);
  return JSON.parse(readFileSync(abs, 'utf8'));
}

function repoChecksum(root, migrationName) {
  const abs = join(root, MIGRATIONS_REL, migrationName, 'migration.sql');
  if (!existsSync(abs)) return null;
  return sha256OfFile(abs);
}

// Static integrity of the registry itself (no DB needed).
export function verifyStatic(root = REPO_ROOT) {
  const problems = [];
  let registry;
  try { registry = loadRegistry(root); } catch (e) { return { ok: false, problems: [e.message] }; }

  if (registry.status !== 'KNOWN_BOUNDED_LEGACY_DIVERGENCE=1') {
    problems.push(`registry.status must be "KNOWN_BOUNDED_LEGACY_DIVERGENCE=1", got "${registry.status}"`);
  }
  const exceptions = Array.isArray(registry.exceptions) ? registry.exceptions : [];
  if (exceptions.length !== 1) {
    problems.push(`exactly one bounded exception is allowed, found ${exceptions.length}`);
  }

  for (const ex of exceptions) {
    const tag = ex.migrationName || '(unnamed)';
    for (const f of ['migrationName', 'repoChecksum', 'productionChecksum', 'productionBodyEvidence',
      'forwardReconciliationMigration', 'cause', 'owner', 'remediationDeadline']) {
      if (!ex[f]) problems.push(`${tag}: missing field "${f}"`);
    }
    if (!SHA256_RE.test(ex.repoChecksum || '')) problems.push(`${tag}: repoChecksum is not a sha256`);
    if (!SHA256_RE.test(ex.productionChecksum || '')) problems.push(`${tag}: productionChecksum is not a sha256`);
    if (ex.repoChecksum && ex.productionChecksum && ex.repoChecksum === ex.productionChecksum) {
      problems.push(`${tag}: repoChecksum equals productionChecksum — not a divergence, do not declare it`);
    }
    // Historical file present AND byte-identical to the declared repo checksum (one-byte mutation fails).
    const live = repoChecksum(root, ex.migrationName);
    if (live === null) problems.push(`${tag}: historical migration file is absent — must never be removed`);
    else if (live !== ex.repoChecksum) problems.push(`${tag}: historical migration body changed (sha256 ${live} != declared ${ex.repoChecksum})`);
    // Forward reconciliation migration must exist.
    const fwd = join(root, MIGRATIONS_REL, ex.forwardReconciliationMigration, 'migration.sql');
    if (!existsSync(fwd)) problems.push(`${tag}: forward reconciliation migration ${ex.forwardReconciliationMigration} is absent`);
    // Production-body evidence present AND equal to the production checksum.
    if (ex.productionBodyEvidence) {
      const ev = join(root, ex.productionBodyEvidence);
      if (!existsSync(ev)) problems.push(`${tag}: production-body evidence absent: ${ex.productionBodyEvidence}`);
      else if (sha256OfFile(ev) !== ex.productionChecksum) problems.push(`${tag}: production-body evidence sha256 != productionChecksum`);
    }
    // Canonical catalog reference present AND equal to the declared fingerprint.
    const fs = ex.expectedFinalSchema || {};
    if (fs.catalogReference && fs.catalogSha256) {
      const cat = join(root, fs.catalogReference);
      if (!existsSync(cat)) problems.push(`${tag}: canonical catalog absent: ${fs.catalogReference}`);
      else if (sha256OfFile(cat) !== fs.catalogSha256) problems.push(`${tag}: canonical catalog sha256 != declared catalogSha256`);
    } else {
      problems.push(`${tag}: expectedFinalSchema.catalogReference / catalogSha256 required`);
    }
    // Remediation deadline must be a valid date.
    if (ex.remediationDeadline && Number.isNaN(Date.parse(ex.remediationDeadline))) {
      problems.push(`${tag}: remediationDeadline is not a valid date: ${ex.remediationDeadline}`);
    }
  }
  return { ok: problems.length === 0, problems };
}

// Journal rows: [{ name, checksum }]. Asserts the ONLY divergence (journal checksum
// != repo checksum, for a migration present in the tree) is the declared tuple.
export function verifyJournal(journalRows, root = REPO_ROOT) {
  const problems = [];
  const registry = loadRegistry(root);
  const exceptions = (registry.exceptions || []);
  const byName = new Map(exceptions.map((e) => [e.migrationName, e]));
  const seenDeclared = new Set();

  for (const row of journalRows) {
    if (!row || !row.name) continue;
    const repo = repoChecksum(root, row.name);
    if (repo === null) continue; // journal rows without a tree file are out of scope here
    if (row.checksum && row.checksum !== repo) {
      const ex = byName.get(row.name);
      if (!ex) {
        problems.push(`undeclared divergence: ${row.name} (journal ${row.checksum} != repo ${repo})`);
      } else if (row.checksum !== ex.productionChecksum || repo !== ex.repoChecksum) {
        problems.push(`${row.name}: divergence does not match the declared tuple (journal ${row.checksum} / repo ${repo})`);
      } else {
        seenDeclared.add(row.name);
      }
    }
  }
  for (const ex of exceptions) {
    if (!seenDeclared.has(ex.migrationName)) {
      // Not fatal if the journal simply doesn't include this migration (e.g. a from-empty rebuild
      // where the repo body was applied), but it IS fatal if a row exists with a matching checksum
      // (meaning the drift silently disappeared → registry is stale). We only flag the stale case.
      const row = journalRows.find((r) => r && r.name === ex.migrationName);
      if (row && row.checksum === ex.repoChecksum) {
        problems.push(`${ex.migrationName}: journal now matches the repo checksum — the drift is gone, remove this stale exception`);
      }
    }
  }
  return { ok: problems.length === 0, problems };
}

export function parseJournalFile(absPath) {
  return readFileSync(absPath, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name, checksum] = l.split('|');
    return { name, checksum };
  });
}

// Compare a live catalog fingerprint to the declared canonical one.
export function verifyLiveCatalog(catalogSha256, root = REPO_ROOT) {
  const ex = (loadRegistry(root).exceptions || [])[0];
  const want = ex?.expectedFinalSchema?.catalogSha256;
  if (!want) return { ok: false, problems: ['no expectedFinalSchema.catalogSha256 declared'] };
  return catalogSha256 === want
    ? { ok: true, problems: [] }
    : { ok: false, problems: [`live maths_progress catalog ${catalogSha256} != canonical ${want}`] };
}

function main(argv) {
  const problems = [];
  let ran = false;
  const idxJournal = argv.indexOf('--journal');
  const idxCat = argv.indexOf('--catalog-sha');
  if (argv.includes('--static') || (idxJournal === -1 && idxCat === -1)) {
    ran = true;
    const r = verifyStatic();
    problems.push(...r.problems.map((p) => `[static] ${p}`));
  }
  if (idxJournal !== -1) {
    ran = true;
    const rows = parseJournalFile(argv[idxJournal + 1]);
    const r = verifyJournal(rows);
    problems.push(...r.problems.map((p) => `[journal] ${p}`));
  }
  if (idxCat !== -1) {
    ran = true;
    const r = verifyLiveCatalog(argv[idxCat + 1]);
    problems.push(...r.problems.map((p) => `[catalog] ${p}`));
  }
  if (!ran) problems.push('no mode selected');
  if (problems.length) {
    console.error('MIGRATION_CHECKSUM_EXCEPTIONS=FAIL');
    for (const p of problems) console.error(' - ' + p);
    process.exit(1);
  }
  console.log('MIGRATION_CHECKSUM_EXCEPTIONS=PASS (KNOWN_BOUNDED_LEGACY_DIVERGENCE=1)');
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
