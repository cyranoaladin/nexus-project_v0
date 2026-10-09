// Governance lock for KNOWN_BOUNDED_LEGACY_DIVERGENCE: the single bounded
// maths_progress_track checksum exception, and its phase-bound fingerprints
// (PRE_PENDING / POST_APPLIED / ALREADY_RECONCILED). Everything else fails closed.
// See scripts/db/verify-migration-checksum-exceptions.mjs and
// security/migration-checksum-exceptions.json.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MIGRATION = '20260425113000_add_maths_progress_track';
const RECONCILE = '20261007120000_reconcile_maths_progress_track';
const REPO_CK = 'f861094720e680a4a3da7bf8930d7252a6f3df2fc86f322c5029fd246acb7893';
const PROD_CK = '26c3aea41f0c83a272ee73658630b14e2229bc28295a4733da2522232a04c2d4';
const ZERO = '0'.repeat(64);

describe('migration checksum exceptions (KNOWN_BOUNDED_LEGACY_DIVERGENCE)', () => {
  let mod; let pf; let repoRows; let preRows; let finalLines; let PRE_CAT; let POST_CAT;
  const row = (name, checksum, extra = {}) => ({ name, checksum, finished: true, rolledBack: false, ...extra });
  const state = (rows, catalogSha256) => ({ hasJournalTable: true, journalRows: rows, catalogSha256 });

  beforeAll(async () => {
    mod = await import('../../scripts/db/verify-migration-checksum-exceptions.mjs');
    pf = mod.loadRegistry().exceptions[0].phaseFingerprints;
    PRE_CAT = pf.PRE_PENDING.catalogSha256;
    POST_CAT = pf.POST.catalogSha256;
    const ck = (n) => mod.sha256OfFile(path.join(mod.REPO_ROOT, 'prisma/migrations', n, 'migration.sql'));
    repoRows = mod.repoMigrationNames().map((n) => row(n, ck(n)));
    preRows = fs.readFileSync(path.join(mod.REPO_ROOT, pf.PRE_PENDING.journalReference), 'utf8')
      .split('\n').filter(Boolean).map((l) => row(...l.split('|')));
    finalLines = fs.readFileSync(path.join(mod.REPO_ROOT, pf.POST.catalogReference), 'utf8').split('\n').filter(Boolean);
  });
  const lineageRowsAfterDeploy = () => {
    const pre = new Map(preRows.map((r) => [r.name, r.checksum]));
    return repoRows.map((r) => (pre.has(r.name) ? row(r.name, pre.get(r.name)) : r));
  };
  const mutated = (fn) => mod.sha256OfText(mod.canonicalLines(fn([...finalLines])));

  test('registry declares exactly one bounded exception with phase-bound fingerprints', () => {
    const reg = mod.loadRegistry();
    expect(reg.status).toBe('KNOWN_BOUNDED_LEGACY_DIVERGENCE=1');
    expect(reg.exceptions).toHaveLength(1);
    const ex = reg.exceptions[0];
    expect(ex).toMatchObject({ migrationName: MIGRATION, repoChecksum: REPO_CK, productionChecksum: PROD_CK,
      forwardReconciliationMigration: RECONCILE, remediationDeadline: '2026-11-07', blocksGoLive: false, owner: 'abenrhouma' });
    expect(pf.states).toEqual(['PRE_PENDING', 'POST_APPLIED', 'ALREADY_RECONCILED']);
    expect(PRE_CAT).not.toBe(POST_CAT);
    expect(finalLines.join('\n')).toMatch(/^con\|maths_progress_userId_fkey\|.*ON DELETE RESTRICT$/m);
    expect(mod.verifyStatic()).toEqual({ ok: true, problems: [] });
  });

  test('the production pre-deploy journal is the 107 applied migrations with the historical production body', () => {
    expect(preRows).toHaveLength(107);
    expect(preRows.find((r) => r.name === MIGRATION).checksum).toBe(PROD_CK);
    expect(preRows.find((r) => r.name === RECONCILE)).toBeUndefined();
  });

  // 1. base vierge
  test('from-empty rebuild → POST_APPLIED (REBUILD lineage)', () => {
    const r = mod.classifyPhase({ mode: 'postflight', state: state(repoRows, POST_CAT), prior: 'FROM_EMPTY' });
    expect(r).toMatchObject({ phase: 'POST_APPLIED', lineage: 'REBUILD', problems: [] });
  });

  // 2. lignée production avant migration
  test('production lineage before migration → PRE_PENDING', () => {
    const r = mod.classifyPhase({ mode: 'preflight', state: state(preRows, PRE_CAT) });
    expect(r).toMatchObject({ phase: 'PRE_PENDING', lineage: 'PRODUCTION', problems: [] });
  });

  // 3. preflight → migrate deploy → postflight
  test('preflight → deploy → postflight → POST_APPLIED', () => {
    const before = mod.classifyPhase({ mode: 'preflight', state: state(preRows, PRE_CAT) });
    const after = mod.classifyPhase({ mode: 'postflight', state: state(lineageRowsAfterDeploy(), POST_CAT), prior: before });
    expect(after).toMatchObject({ phase: 'POST_APPLIED', lineage: 'PRODUCTION', problems: [] });
  });

  // 4. second deploy without effect, 5. already reconciled
  test('second deploy: preflight → ALREADY_RECONCILED, postflight → ALREADY_RECONCILED', () => {
    const before = mod.classifyPhase({ mode: 'preflight', state: state(lineageRowsAfterDeploy(), POST_CAT) });
    expect(before).toMatchObject({ phase: 'ALREADY_RECONCILED', lineage: 'PRODUCTION' });
    const after = mod.classifyPhase({ mode: 'postflight', state: state(lineageRowsAfterDeploy(), POST_CAT), prior: before });
    expect(after).toMatchObject({ phase: 'ALREADY_RECONCILED', problems: [] });
    expect(mod.classifyPhase({ mode: 'preflight', state: state(repoRows, POST_CAT) })).toMatchObject({ phase: 'ALREADY_RECONCILED', lineage: 'REBUILD' });
  });

  // 6. interruption and resume
  test('an interrupted reconciliation (unfinished row) blocks preflight and postflight', () => {
    const rows = lineageRowsAfterDeploy().map((r) => (r.name === RECONCILE ? { ...r, finished: false } : r));
    const before = mod.classifyPhase({ mode: 'preflight', state: state(preRows, PRE_CAT) });
    expect(mod.classifyPhase({ mode: 'preflight', state: state(rows, POST_CAT) }).problems.join(' ')).toMatch(/UNFINISHED_MIGRATION: 20261007120000/);
    expect(mod.classifyPhase({ mode: 'postflight', state: state(rows, POST_CAT), prior: before }).phase).toBe('BLOCKED');
    // rolled back then re-applied (Prisma resume) is accepted
    const resumed = [...lineageRowsAfterDeploy(), { ...row(RECONCILE, repoRows.find((r) => r.name === RECONCILE).checksum), finished: false, rolledBack: true }];
    expect(mod.classifyPhase({ mode: 'postflight', state: state(resumed, POST_CAT), prior: before }).phase).toBe('POST_APPLIED');
  });

  // 7. one-byte modification (file) and undeclared journal divergence
  describe('on a temporary copy of the governed files', () => {
    let tmp;
    beforeEach(() => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcx-'));
      const ex = mod.loadRegistry().exceptions[0];
      const files = ['security/migration-checksum-exceptions.json', ex.productionBodyEvidence,
        `prisma/migrations/${MIGRATION}/migration.sql`, `prisma/migrations/${RECONCILE}/migration.sql`,
        pf.catalogQuery, pf.PRE_PENDING.catalogReference, pf.PRE_PENDING.journalReference, pf.POST.catalogReference];
      for (const f of files) { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.copyFileSync(path.join(mod.REPO_ROOT, f), path.join(tmp, f)); }
    });
    afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));
    test('the copy itself is valid', () => expect(mod.verifyStatic(tmp).ok).toBe(true));
    test('7. one-byte mutation of the historical migration fails', () => {
      fs.appendFileSync(path.join(tmp, `prisma/migrations/${MIGRATION}/migration.sql`), ' ');
      expect(mod.verifyStatic(tmp).problems.join(' ')).toMatch(/historical migration body changed/);
    });
    test('15. missing evidence (pre-deploy journal) fails', () => {
      fs.rmSync(path.join(tmp, pf.PRE_PENDING.journalReference));
      expect(mod.verifyStatic(tmp).problems.join(' ')).toMatch(/PRE_PENDING journal evidence absent/);
    });
    test('15b. missing production-body evidence fails', () => {
      fs.rmSync(path.join(tmp, mod.loadRegistry().exceptions[0].productionBodyEvidence));
      expect(mod.verifyStatic(tmp).problems.join(' ')).toMatch(/production-body evidence absent/);
    });
  });
  test('7b. any other migration whose journal checksum differs from its body fails', () => {
    const rows = repoRows.map((r) => (r.name === '20261003100000_add_espace_credential_security' ? row(r.name, ZERO) : r));
    expect(mod.classifyPhase({ mode: 'postflight', state: state(rows, POST_CAT), prior: 'FROM_EMPTY' }).problems.join(' '))
      .toMatch(/undeclared divergence: 20261003100000_add_espace_credential_security/);
  });

  // 8–12. catalog alterations
  test.each([
    ['8. type change', (l) => l.map((x) => x.replace(/^col\|track\|AcademicTrack\|/, 'col|track|text|'))],
    ['9. nullability change', (l) => l.map((x) => x.replace(/^(col\|track\|AcademicTrack\|)NO\|/, '$1YES|'))],
    ['10. default change', (l) => l.map((x) => x.replace(/'EDS_GENERALE'::"AcademicTrack"$/, "'STMG'::\"AcademicTrack\""))],
    ['11a. missing index', (l) => l.filter((x) => !x.startsWith('idx|maths_progress_track_idx|'))],
    ['11b. extra index', (l) => [...l, 'idx|maths_progress_extra_idx|CREATE INDEX maths_progress_extra_idx ON public.maths_progress USING btree (level)']],
    ['12. altered FK', (l) => l.map((x) => x.replace(/ON DELETE RESTRICT$/, 'ON DELETE SET NULL'))],
  ])('%s is rejected after application', (_label, mutate) => {
    const sha = mutated(mutate);
    expect(sha).not.toBe(POST_CAT);
    const r = mod.classifyPhase({ mode: 'postflight', state: state(repoRows, sha), prior: 'FROM_EMPTY' });
    expect(r.phase).toBe('BLOCKED');
  });

  // 13. different checksum on the historical migration / lineage swap
  test('13. an unknown historical checksum fails, and a lineage swap fails', () => {
    const unknown = repoRows.map((r) => (r.name === MIGRATION ? row(MIGRATION, ZERO) : r));
    expect(mod.classifyPhase({ mode: 'postflight', state: state(unknown, POST_CAT), prior: 'FROM_EMPTY' }).phase).toBe('BLOCKED');
    const before = mod.classifyPhase({ mode: 'preflight', state: state(preRows, PRE_CAT) });
    const swapped = lineageRowsAfterDeploy().map((r) => (r.name === MIGRATION ? row(MIGRATION, REPO_CK) : r));
    expect(mod.classifyPhase({ mode: 'postflight', state: state(swapped, POST_CAT), prior: before }).phase).toBe('BLOCKED');
  });

  // 14. unexpected / missing migrations
  test('14. an unexpected extra migration fails; a missing one fails; a non-production pre-journal fails', () => {
    const extra = [...repoRows, row('20991231000000_unexpected', ZERO)];
    expect(mod.classifyPhase({ mode: 'postflight', state: state(extra, POST_CAT), prior: 'FROM_EMPTY' }).problems.join(' ')).toMatch(/UNKNOWN_APPLIED_MIGRATION/);
    const missing = repoRows.filter((r) => r.name !== '20261005014000_stage_session_coach_conflicts');
    expect(mod.classifyPhase({ mode: 'postflight', state: state(missing, POST_CAT), prior: 'FROM_EMPTY' }).problems.join(' ')).toMatch(/MIGRATIONS_NOT_APPLIED/);
    const preExtra = [...preRows, repoRows.find((r) => r.name === '20261004170000_invoice_financial_authority')];
    expect(mod.classifyPhase({ mode: 'preflight', state: state(preExtra, PRE_CAT) }).problems.join(' ')).toMatch(/PRE_PENDING_JOURNAL_MISMATCH/);
  });

  // 16. pre-deploy fingerprint used after application
  test('16. the pre-deploy catalog fingerprint is refused after application', () => {
    const before = mod.classifyPhase({ mode: 'preflight', state: state(preRows, PRE_CAT) });
    const r = mod.classifyPhase({ mode: 'postflight', state: state(lineageRowsAfterDeploy(), PRE_CAT), prior: before });
    expect(r.problems.join(' ')).toMatch(/PRE_DEPLOY_FINGERPRINT_AFTER_APPLICATION/);
    expect(mod.verifyLiveCatalog(PRE_CAT, 'POST').ok).toBe(false);
    // and the post catalog is refused before application
    expect(mod.classifyPhase({ mode: 'preflight', state: state(preRows, POST_CAT) }).phase).toBe('BLOCKED');
  });

  test('no generic phase: catalog checks require an explicit phase; postflight requires a preflight state', () => {
    expect(mod.verifyLiveCatalog(POST_CAT, undefined).ok).toBe(false);
    expect(mod.classifyPhase({ mode: 'postflight', state: state(repoRows, POST_CAT) }).problems.join(' ')).toMatch(/POSTFLIGHT_REQUIRES_PREFLIGHT_STATE/);
    expect(mod.classifyPhase({ mode: 'preflight', state: state([], PRE_CAT) }).problems.join(' ')).toMatch(/EMPTY_DATABASE/);
    expect(mod.classifyPhase({ mode: 'postflight', state: state(lineageRowsAfterDeploy(), POST_CAT), prior: 'FROM_EMPTY' }).problems.join(' ')).toMatch(/FROM_EMPTY_REQUIRES_REBUILD_LINEAGE/);
  });

  test('the real production journal diverges only by the declared tuple', () => {
    expect(mod.verifyJournal(preRows)).toEqual({ ok: true, problems: [] });
  });
});
