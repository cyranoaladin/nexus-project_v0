// Governance lock for KNOWN_BOUNDED_LEGACY_DIVERGENCE: the single, bounded
// maths_progress_track checksum exception must stay exactly as declared, and the
// guard must fail closed on any other divergence. See
// scripts/db/verify-migration-checksum-exceptions.mjs and
// security/migration-checksum-exceptions.json.

const MIGRATION = '20260425113000_add_maths_progress_track';
const REPO_CK = 'f861094720e680a4a3da7bf8930d7252a6f3df2fc86f322c5029fd246acb7893';
const PROD_CK = '26c3aea41f0c83a272ee73658630b14e2229bc28295a4733da2522232a04c2d4';

describe('migration checksum exceptions (KNOWN_BOUNDED_LEGACY_DIVERGENCE)', () => {
  let mod;
  beforeAll(async () => {
    mod = await import('../../scripts/db/verify-migration-checksum-exceptions.mjs');
  });

  test('registry declares exactly one bounded exception, verbatim', () => {
    const reg = mod.loadRegistry();
    expect(reg.status).toBe('KNOWN_BOUNDED_LEGACY_DIVERGENCE=1');
    expect(Array.isArray(reg.exceptions)).toBe(true);
    expect(reg.exceptions).toHaveLength(1);
    const ex = reg.exceptions[0];
    expect(ex.migrationName).toBe(MIGRATION);
    expect(ex.repoChecksum).toBe(REPO_CK);
    expect(ex.productionChecksum).toBe(PROD_CK);
    expect(ex.repoChecksum).not.toBe(ex.productionChecksum);
    expect(ex.forwardReconciliationMigration).toBe('20261007120000_reconcile_maths_progress_track');
    expect(ex.remediationDeadline).toBe('2026-11-07');
    expect(ex.blocksGoLive).toBe(false);
    expect(ex.owner).toBe('abenrhouma');
  });

  test('static integrity passes (files present, checksums match, single tuple)', () => {
    const r = mod.verifyStatic();
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
  });

  test('journal with only the declared divergence passes', () => {
    const rows = [
      { name: MIGRATION, checksum: PROD_CK }, // declared drift
      { name: '20261007120000_reconcile_maths_progress_track', checksum: 'ignored-recomputed-from-tree' },
    ];
    // The reconciliation row's journal checksum is irrelevant here: verifyJournal
    // recomputes the repo checksum and only flags a MISMATCH, which a real journal
    // would not have for a cleanly-applied migration. Use its real repo checksum.
    const realReco = require('node:crypto')
      .createHash('sha256')
      .update(require('node:fs').readFileSync(
        require('node:path').join(mod.REPO_ROOT, 'prisma/migrations/20261007120000_reconcile_maths_progress_track/migration.sql')))
      .digest('hex');
    rows[1].checksum = realReco;
    const r = mod.verifyJournal(rows);
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
  });

  test('fails closed on ANY other divergent migration', () => {
    const rows = [
      { name: MIGRATION, checksum: PROD_CK },
      // A real migration in the tree, but with a wrong journal checksum = undeclared drift.
      { name: '20261003100000_add_espace_credential_security', checksum: '0'.repeat(64) },
    ];
    const r = mod.verifyJournal(rows);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toMatch(/undeclared divergence: 20261003100000_add_espace_credential_security/);
  });

  test('fails closed when the declared drift does not match the exact tuple', () => {
    const rows = [{ name: MIGRATION, checksum: '0'.repeat(64) }]; // right name, wrong prod checksum
    const r = mod.verifyJournal(rows);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toMatch(/does not match the declared tuple/);
  });

  test('flags a stale exception when the drift has disappeared', () => {
    const rows = [{ name: MIGRATION, checksum: REPO_CK }]; // journal now equals the repo body
    const r = mod.verifyJournal(rows);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toMatch(/the drift is gone, remove this stale exception/);
  });
});
