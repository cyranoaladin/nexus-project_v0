/**
 * Governance test for the in-flight hardening of
 * scripts/db/preflight-2026-10-go-live.sh applied during the 2026-10-10
 * go-live: the PR #337 lot-presence check is now keyed to the migration PHASE.
 *
 * Contract:
 *   - PRE_PENDING        -> the lot objects must be ABSENT (0 tables, 0 columns);
 *                           if present, a manual apply happened and migrate deploy
 *                           would fail "already exists".
 *   - ALREADY_RECONCILED -> the lot objects must be PRESENT (5 tables, 3 columns);
 *                           migrate deploy no-ops over them. Requiring 0 here is a
 *                           post-migration false positive.
 *
 * This runs the REAL tracked script (copied into a temp dir, no reimplementation)
 * with a stubbed `psql` on PATH and a stubbed phase oracle
 * (verify-migration-checksum-exceptions.mjs) placed next to it. All four
 * phase x presence combinations are exercised so the gate is proven non-vacuous
 * in both phases. Needs bash + node; no database, no network.
 *
 * The phase DECISION itself (exact Prisma journal, checksums, post-deploy
 * fingerprint) stays owned by verify-migration-checksum-exceptions.mjs and is
 * covered by __tests__/governance/migration-checksum-exceptions.test.js.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.resolve(__dirname, '../../scripts/db/preflight-2026-10-go-live.sh');

// Phase oracle stub: emits $PHASE and exits 0.
const MJS_STUB =
  "process.stdout.write((process.env.PHASE || 'PRE_PENDING') + ' (stub)\\n');\nprocess.exit(0);\n";

// psql stub: maps the final -c SQL to a deterministic count; the two lot
// queries are driven by $TBL / $COL, every other check returns its passing
// value. No backslashes and no ${...} so it embeds verbatim.
const PSQL_STUB = [
  '#!/usr/bin/env bash',
  'sql=""; prev=""',
  'for a in "$@"; do [ "$prev" = "-c" ] && sql="$a"; prev="$a"; done',
  'case "$sql" in',
  '  *current_database*)              echo "nexus_stub_db" ;;',
  '  *server_version*)                echo "16.1" ;;',
  '  *transaction_read_only*)         echo "on" ;;',
  '  *_prisma_migrations*finished_at*) echo "0" ;;',
  '  *max*migration_name*)            echo "20261007120000_reconcile_maths_progress_track" ;;',
  '  *account_security_events*)       echo "$TBL" ;;',
  '  *payerUserId*)                   echo "$COL" ;;',
  '  *btree_gist*)                    echo "1" ;;',
  '  *nexus_normalize_name_part*)     echo "1" ;;',
  '  *startAt*)                       echo "0" ;;',
  '  *tsrange*)                       echo "0" ;;',
  '  *coach_profiles*)                echo "0" ;;',
  '  *pg_stat_user_tables*)           echo "invoices=1" ;;',
  '  *)                               echo "0" ;;',
  'esac',
  'exit 0',
  '',
].join('\n');

function runScenario(phase, tbl, col) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-probe-'));
  fs.copyFileSync(SCRIPT, path.join(dir, 'preflight.sh'));
  fs.writeFileSync(path.join(dir, 'verify-migration-checksum-exceptions.mjs'), MJS_STUB);
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  const psql = path.join(bin, 'psql');
  fs.writeFileSync(psql, PSQL_STUB);
  fs.chmodSync(psql, 0o755);
  const r = spawnSync('bash', [path.join(dir, 'preflight.sh'), 'legacy', 'postgres://stub/db'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      PHASE: phase,
      TBL: String(tbl),
      COL: String(col),
    },
  });
  if (r.error) throw r.error;
  return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

describe('preflight-2026-10-go-live.sh — lot gate keyed to the migration phase', () => {
  it('ALREADY_RECONCILED with the lot objects present (5,3) PASSES', () => {
    const r = runScenario('ALREADY_RECONCILED', 5, 3);
    expect(r.out).toMatch(/ALREADY_RECONCILED\): 5 tables/);
    expect(r.out).toMatch(/PREFLIGHT legacy: PASS/);
    expect(r.status).toBe(0);
  });

  it('ALREADY_RECONCILED with the lot objects missing (0,0) FAILS (gate is not vacuous)', () => {
    const r = runScenario('ALREADY_RECONCILED', 0, 0);
    expect(r.out).toMatch(/FAIL\s+lot déjà appliqué/);
    expect(r.out).toMatch(/PREFLIGHT legacy: FAIL/);
    expect(r.status).toBe(1);
  });

  it('PRE_PENDING with the lot objects absent (0,0) PASSES', () => {
    const r = runScenario('PRE_PENDING', 0, 0);
    expect(r.out).toMatch(/aucune table du lot déjà présente/);
    expect(r.out).toMatch(/PREFLIGHT legacy: PASS/);
    expect(r.status).toBe(0);
  });

  it('PRE_PENDING with the lot objects present (5,3) FAILS (manual apply caught)', () => {
    const r = runScenario('PRE_PENDING', 5, 3);
    expect(r.out).toMatch(/FAIL\s+aucune table du lot déjà présente/);
    expect(r.out).toMatch(/attendu: 0/);
    expect(r.status).toBe(1);
  });
});
