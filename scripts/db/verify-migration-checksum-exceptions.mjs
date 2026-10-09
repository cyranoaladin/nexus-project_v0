#!/usr/bin/env node
// Governance guard for KNOWN_BOUNDED_LEGACY_DIVERGENCE (maths_progress_track).
//
// Enforces that the ONLY divergence between a Git-tracked, already-applied
// migration body and the checksum recorded in _prisma_migrations is the single
// tuple declared in security/migration-checksum-exceptions.json, and binds the
// maths_progress catalog / journal fingerprints to the migration PHASE:
//
//   PRE_PENDING         production lineage recognized (exact journal), the historical
//                       divergence present, reconciliation not applied, pre-deploy catalog
//   POST_APPLIED        reconciliation applied by this deploy (from PRE_PENDING or from an
//                       empty database), final catalog, journal == repository set
//   ALREADY_RECONCILED  reconciliation already applied before this deploy, final catalog
//
// A fingerprint is never accepted outside its phase (no generic "pre or post"); the
// pre-deploy catalog is refused after application. Everything else fails closed.
//
// Prisma records a migration's checksum as the SHA-256 (hex) of its migration.sql file,
// so a repo checksum is recomputed the same way here.
//
// Usage:
//   node scripts/db/verify-migration-checksum-exceptions.mjs --static
//   node scripts/db/verify-migration-checksum-exceptions.mjs --journal <file>      # lines: name|checksum[|...]
//   node scripts/db/verify-migration-checksum-exceptions.mjs --catalog-sha <sha256> --phase PRE_PENDING|POST
//   node scripts/db/verify-migration-checksum-exceptions.mjs preflight  --database-url <url> [--state-out <file>]
//   node scripts/db/verify-migration-checksum-exceptions.mjs postflight --database-url <url> (--state-in <file> | --from-empty)

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, '..', '..');
const REGISTRY_REL = 'security/migration-checksum-exceptions.json';
const MIGRATIONS_REL = 'prisma/migrations';
const SHA256_RE = /^[0-9a-f]{64}$/;
export const PHASES = Object.freeze(['PRE_PENDING', 'POST_APPLIED', 'ALREADY_RECONCILED']);

export function sha256OfFile(absPath) {
  return createHash('sha256').update(readFileSync(absPath)).digest('hex');
}
export function sha256OfText(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
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

export function repoMigrationNames(root = REPO_ROOT) {
  const dir = join(root, MIGRATIONS_REL);
  return readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory()
    && existsSync(join(dir, name, 'migration.sql'))).sort();
}

/** Canonical catalog / journal text: non-empty lines, byte-order sort, newline-terminated. */
export function canonicalLines(lines) {
  const kept = lines.map((line) => line.replace(/\r?\n$/, '')).filter((line) => line.length > 0);
  kept.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return kept.map((line) => `${line}\n`).join('');
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
  if (exceptions.length !== 1) problems.push(`exactly one bounded exception is allowed, found ${exceptions.length}`);

  for (const ex of exceptions) {
    const tag = ex.migrationName || '(unnamed)';
    for (const f of ['migrationName', 'repoChecksum', 'productionChecksum', 'productionBodyEvidence',
      'forwardReconciliationMigration', 'cause', 'owner', 'remediationDeadline', 'phaseFingerprints']) {
      if (!ex[f]) problems.push(`${tag}: missing field "${f}"`);
    }
    if (!SHA256_RE.test(ex.repoChecksum || '')) problems.push(`${tag}: repoChecksum is not a sha256`);
    if (!SHA256_RE.test(ex.productionChecksum || '')) problems.push(`${tag}: productionChecksum is not a sha256`);
    if (ex.repoChecksum && ex.productionChecksum && ex.repoChecksum === ex.productionChecksum) {
      problems.push(`${tag}: repoChecksum equals productionChecksum — not a divergence, do not declare it`);
    }
    const live = repoChecksum(root, ex.migrationName);
    if (live === null) problems.push(`${tag}: historical migration file is absent — must never be removed`);
    else if (live !== ex.repoChecksum) problems.push(`${tag}: historical migration body changed (sha256 ${live} != declared ${ex.repoChecksum})`);
    const fwd = join(root, MIGRATIONS_REL, ex.forwardReconciliationMigration || '', 'migration.sql');
    if (!existsSync(fwd)) problems.push(`${tag}: forward reconciliation migration ${ex.forwardReconciliationMigration} is absent`);
    if (ex.productionBodyEvidence) {
      const ev = join(root, ex.productionBodyEvidence);
      if (!existsSync(ev)) problems.push(`${tag}: production-body evidence absent: ${ex.productionBodyEvidence}`);
      else if (sha256OfFile(ev) !== ex.productionChecksum) problems.push(`${tag}: production-body evidence sha256 != productionChecksum`);
    }
    if (ex.remediationDeadline && Number.isNaN(Date.parse(ex.remediationDeadline))) {
      problems.push(`${tag}: remediationDeadline is not a valid date: ${ex.remediationDeadline}`);
    }

    const pf = ex.phaseFingerprints || {};
    if (JSON.stringify(pf.states) !== JSON.stringify(PHASES)) problems.push(`${tag}: phaseFingerprints.states must be exactly ${PHASES.join(', ')}`);
    if (!pf.catalogQuery || !existsSync(join(root, pf.catalogQuery))) problems.push(`${tag}: phaseFingerprints.catalogQuery absent`);
    const pre = pf.PRE_PENDING || {};
    const post = pf.POST || {};
    for (const [label, ref, sha] of [
      ['PRE_PENDING catalog', pre.catalogReference, pre.catalogSha256],
      ['PRE_PENDING journal', pre.journalReference, pre.journalSha256],
      ['POST catalog', post.catalogReference, post.catalogSha256],
    ]) {
      if (!ref || !SHA256_RE.test(sha || '')) { problems.push(`${tag}: ${label} reference / sha256 required`); continue; }
      const abs = join(root, ref);
      if (!existsSync(abs)) problems.push(`${tag}: ${label} evidence absent: ${ref}`);
      else if (sha256OfFile(abs) !== sha) problems.push(`${tag}: ${label} sha256 != declared`);
    }
    if (pre.catalogSha256 && pre.catalogSha256 === post.catalogSha256) problems.push(`${tag}: PRE_PENDING and POST catalogs must differ`);
    if (pre.historicalChecksum !== ex.productionChecksum) problems.push(`${tag}: PRE_PENDING.historicalChecksum must be the production checksum`);
    const byLineage = post.historicalChecksumByLineage || {};
    if (byLineage.PRODUCTION !== ex.productionChecksum || byLineage.REBUILD !== ex.repoChecksum) {
      problems.push(`${tag}: POST.historicalChecksumByLineage must map PRODUCTION->production and REBUILD->repo checksums`);
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

  for (const row of journalRows) {
    if (!row || !row.name) continue;
    const repo = repoChecksum(root, row.name);
    if (repo === null) continue; // names absent from the tree are judged by the phase checks
    if (row.checksum && row.checksum !== repo) {
      const ex = byName.get(row.name);
      if (!ex) {
        problems.push(`undeclared divergence: ${row.name} (journal ${row.checksum} != repo ${repo})`);
      } else if (row.checksum !== ex.productionChecksum || repo !== ex.repoChecksum) {
        problems.push(`${row.name}: divergence does not match the declared tuple (journal ${row.checksum} / repo ${repo})`);
      }
    }
  }
  // A journal recording the repo body for the declared migration is the REBUILD lineage
  // (from-empty); whether that is acceptable is decided by the phase checks.
  return { ok: problems.length === 0, problems };
}

export function parseJournalFile(absPath) {
  return readFileSync(absPath, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name, checksum] = l.split('|');
    return { name, checksum };
  });
}

/** Catalog fingerprint check, bound to a phase: PRE_PENDING or POST (never generic). */
export function verifyLiveCatalog(catalogSha256, phase, root = REPO_ROOT) {
  const ex = (loadRegistry(root).exceptions || [])[0];
  const pf = ex?.phaseFingerprints || {};
  const want = phase === 'PRE_PENDING' ? pf.PRE_PENDING?.catalogSha256
    : (phase === 'POST' || phase === 'POST_APPLIED' || phase === 'ALREADY_RECONCILED') ? pf.POST?.catalogSha256 : undefined;
  if (!want) return { ok: false, problems: [`catalog phase must be PRE_PENDING or POST, got "${phase}"`] };
  if (phase !== 'PRE_PENDING' && catalogSha256 === pf.PRE_PENDING?.catalogSha256) {
    return { ok: false, problems: ['PRE_DEPLOY_FINGERPRINT_AFTER_APPLICATION: the pre-deploy catalog is refused once the reconciliation is applied'] };
  }
  return catalogSha256 === want
    ? { ok: true, problems: [] }
    : { ok: false, problems: [`live maths_progress catalog ${catalogSha256} != ${phase} fingerprint ${want}`] };
}

/**
 * Pure phase classifier.
 * state = { journalRows: [{name, checksum, finished, rolledBack}], catalogSha256, hasJournalTable }
 * mode  = 'preflight' | 'postflight'; for postflight, prior = { phase, lineage, appliedRows } | 'FROM_EMPTY'.
 */
export function classifyPhase({ mode, state, prior, root = REPO_ROOT }) {
  const block = (...problems) => ({ phase: 'BLOCKED', problems });
  const ex = (loadRegistry(root).exceptions || [])[0];
  if (!ex) return block('NO_DECLARED_EXCEPTION');
  const pf = ex.phaseFingerprints;
  const historicalName = ex.migrationName;
  const reconcileName = ex.forwardReconciliationMigration;

  if (!state || !state.hasJournalTable) return block('NO_MIGRATION_JOURNAL');
  const rows = Array.isArray(state.journalRows) ? state.journalRows : [];
  const unfinished = rows.filter((r) => !r.finished && !r.rolledBack).map((r) => r.name);
  if (unfinished.length) return block(`UNFINISHED_MIGRATION: ${[...new Set(unfinished)].sort().join(', ')}`);
  const applied = rows.filter((r) => r.finished && !r.rolledBack);
  const appliedByName = new Map();
  for (const r of applied) {
    if (appliedByName.has(r.name) && appliedByName.get(r.name) !== r.checksum) return block(`CONFLICTING_APPLIED_ROWS: ${r.name}`);
    appliedByName.set(r.name, r.checksum);
  }
  const journalText = canonicalLines([...appliedByName].map(([n, c]) => `${n}|${c}`));
  const journalSha = sha256OfText(journalText);
  const repoNames = repoMigrationNames(root);
  const repoSet = new Set(repoNames);
  const unknown = [...appliedByName.keys()].filter((n) => !repoSet.has(n));
  if (unknown.length) return block(`UNKNOWN_APPLIED_MIGRATION: ${unknown.sort().join(', ')}`);
  const divergence = verifyJournal([...appliedByName].map(([name, checksum]) => ({ name, checksum })), root);
  if (!divergence.ok) return block(...divergence.problems);
  const historical = appliedByName.get(historicalName);
  const reconciled = appliedByName.has(reconcileName);
  const lineageOf = (checksum) => (checksum === pf.POST.historicalChecksumByLineage.PRODUCTION ? 'PRODUCTION'
    : checksum === pf.POST.historicalChecksumByLineage.REBUILD ? 'REBUILD' : null);

  const post = (phase, lineage) => {
    const missing = repoNames.filter((n) => !appliedByName.has(n));
    if (missing.length) return block(`MIGRATIONS_NOT_APPLIED: ${missing.join(', ')}`);
    const cat = verifyLiveCatalog(state.catalogSha256, phase, root);
    if (!cat.ok) return block(...cat.problems);
    return { phase, lineage, journalSha256: journalSha, catalogSha256: state.catalogSha256, problems: [] };
  };

  if (mode === 'preflight') {
    if (appliedByName.size === 0) return block('EMPTY_DATABASE: preflight applies to an existing lineage only');
    if (!historical) return block(`HISTORICAL_MIGRATION_NOT_APPLIED: ${historicalName}`);
    const lineage = lineageOf(historical);
    if (!lineage) return block(`HISTORICAL_CHECKSUM_UNKNOWN: ${historical}`);
    if (!reconciled) {
      if (lineage !== 'PRODUCTION') return block('PRE_PENDING_REQUIRES_PRODUCTION_LINEAGE');
      if (journalSha !== pf.PRE_PENDING.journalSha256) return block(`PRE_PENDING_JOURNAL_MISMATCH: ${journalSha} != ${pf.PRE_PENDING.journalSha256}`);
      const cat = verifyLiveCatalog(state.catalogSha256, 'PRE_PENDING', root);
      if (!cat.ok) return block(...cat.problems);
      return { phase: 'PRE_PENDING', lineage, journalSha256: journalSha, catalogSha256: state.catalogSha256, appliedRows: [...appliedByName], problems: [] };
    }
    const result = post('ALREADY_RECONCILED', lineage);
    return result.phase === 'BLOCKED' ? result : { ...result, appliedRows: [...appliedByName] };
  }

  if (mode === 'postflight') {
    if (!reconciled) return block(`RECONCILIATION_NOT_APPLIED: ${reconcileName}`);
    if (!historical) return block(`HISTORICAL_MIGRATION_NOT_APPLIED: ${historicalName}`);
    const lineage = lineageOf(historical);
    if (!lineage) return block(`HISTORICAL_CHECKSUM_UNKNOWN: ${historical}`);
    if (prior === 'FROM_EMPTY') {
      if (lineage !== 'REBUILD') return block('FROM_EMPTY_REQUIRES_REBUILD_LINEAGE');
      return post('POST_APPLIED', lineage);
    }
    if (!prior || !PHASES.includes(prior.phase) || prior.phase === 'POST_APPLIED') return block('POSTFLIGHT_REQUIRES_PREFLIGHT_STATE');
    if (prior.lineage !== lineage) return block(`LINEAGE_CHANGED: ${prior.lineage} -> ${lineage}`);
    // Every row applied before the deploy must still be there, byte-identical.
    for (const [name, checksum] of prior.appliedRows || []) {
      if (appliedByName.get(name) !== checksum) return block(`PRIOR_APPLIED_ROW_CHANGED: ${name}`);
    }
    return post(prior.phase === 'PRE_PENDING' ? 'POST_APPLIED' : 'ALREADY_RECONCILED', lineage);
  }
  return block(`UNKNOWN_MODE: ${mode}`);
}

/** Read-only snapshot of the journal and the maths_progress catalog. */
export async function readDatabaseState(databaseUrl, root = REPO_ROOT) {
  const { default: pg } = await import('pg');
  const ex = (loadRegistry(root).exceptions || [])[0];
  const query = readFileSync(join(root, ex.phaseFingerprints.catalogQuery), 'utf8')
    .split('\n').filter((l) => !/^\s*--/.test(l)).join('\n').replace(/;\s*$/, '');
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '60s'");
    const has = await client.query("select to_regclass('public._prisma_migrations') is not null as present");
    const hasJournalTable = has.rows[0].present === true;
    const journalRows = hasJournalTable
      ? (await client.query('select migration_name, checksum, finished_at is not null as finished, rolled_back_at is not null as rolled_back from _prisma_migrations'))
        .rows.map((r) => ({ name: r.migration_name, checksum: r.checksum, finished: r.finished, rolledBack: r.rolled_back }))
      : [];
    const hasTable = (await client.query("select to_regclass('public.maths_progress') is not null as present")).rows[0].present === true;
    const catalogLines = hasTable ? (await client.query(query)).rows.map((r) => Object.values(r)[0] ?? '') : [];
    await client.query('COMMIT');
    return { hasJournalTable, journalRows, catalogSha256: sha256OfText(canonicalLines(catalogLines)) };
  } finally {
    await client.end();
  }
}

async function main(argv) {
  const get = (flag) => { const i = argv.indexOf(flag); return i === -1 ? undefined : argv[i + 1]; };
  const mode = argv[0];
  if (mode === 'preflight' || mode === 'postflight') {
    const url = get('--database-url');
    if (!url) { console.error('usage: --database-url <url> required'); process.exit(2); }
    const stat = verifyStatic();
    if (!stat.ok) { console.error('MATHS_RECONCILIATION_PHASE=BLOCKED'); stat.problems.forEach((p) => console.error(' - [static] ' + p)); process.exit(1); }
    let prior;
    if (mode === 'postflight') {
      if (argv.includes('--from-empty')) prior = 'FROM_EMPTY';
      else if (get('--state-in') && existsSync(get('--state-in'))) prior = JSON.parse(readFileSync(get('--state-in'), 'utf8'));
    }
    let state;
    try { state = await readDatabaseState(url); } catch (e) {
      console.error(`MATHS_RECONCILIATION_PHASE=BLOCKED\n - DATABASE_READ_FAILED: ${e && e.code ? e.code : 'ERROR'}`); process.exit(1);
    }
    const result = classifyPhase({ mode, state, prior });
    if (result.phase === 'BLOCKED') { console.error('MATHS_RECONCILIATION_PHASE=BLOCKED'); result.problems.forEach((p) => console.error(' - ' + p)); process.exit(1); }
    if (mode === 'preflight' && get('--state-out')) writeFileSync(get('--state-out'), JSON.stringify(result), { mode: 0o600 });
    console.log(`MATHS_RECONCILIATION_PHASE=${result.phase} lineage=${result.lineage} journal=${result.journalSha256.slice(0, 12)} catalog=${result.catalogSha256.slice(0, 12)}`);
    process.exit(0);
  }

  const problems = [];
  let ran = false;
  const idxJournal = argv.indexOf('--journal');
  const idxCat = argv.indexOf('--catalog-sha');
  if (argv.includes('--static') || (idxJournal === -1 && idxCat === -1)) {
    ran = true;
    problems.push(...verifyStatic().problems.map((p) => `[static] ${p}`));
  }
  if (idxJournal !== -1) {
    ran = true;
    problems.push(...verifyJournal(parseJournalFile(argv[idxJournal + 1])).problems.map((p) => `[journal] ${p}`));
  }
  if (idxCat !== -1) {
    ran = true;
    problems.push(...verifyLiveCatalog(argv[idxCat + 1], get('--phase')).problems.map((p) => `[catalog] ${p}`));
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
