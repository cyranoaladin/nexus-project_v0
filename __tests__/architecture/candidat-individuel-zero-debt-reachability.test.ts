import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Incrément 2 (zero-debt audit) — locks the facts recorded in
 * docs/audits/candidat-individuel-zero-debt-reachability.md against silent
 * drift. This is a scanner, not a behavioral test: every assertion here is
 * a source-text check verified by direct reading when the audit was
 * written (see the doc's §2, §5, §6, §12 for the file:line evidence this
 * test encodes). If this test ever needs to change, the audit doc must be
 * re-read and updated in the same commit — never adjust one without the
 * other.
 */

const root = process.cwd();

function read(relPath: string): string {
  return readFileSync(join(root, relPath), 'utf8');
}

function listFiles(dir: string, exts: string[]): string[] {
  const abs = join(root, dir);
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      if (entry === 'node_modules' || entry === '.next' || entry === '.git' || entry === '.worktrees') continue;
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (exts.some((ext) => entry.endsWith(ext))) out.push(full);
    }
  };
  if (statSync(abs, { throwIfNoEntry: false })?.isDirectory()) walk(abs);
  return out;
}

function importsName(source: string, name: string): boolean {
  // Matches `import { ..., name, ... } from '...'` in either quote style, tolerant of aliasing/spacing.
  const re = new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from`, 's');
  return re.test(source);
}

// Updated for mission "fair go-live" Phase F (I7, MARGIN_ENGINES = 1): the
// incrément 2 audit found these 8 exports dead (defined, zero non-test
// importers). Phase F deleted them outright — see pricing-engine.ts's top
// doc comment and __tests__/architecture/candidat-individuel-ast-
// reachability.test.ts (AST-proven, not regex). applyDiscounts is the one
// deliberate exception (kept dormant, not deleted); see its own describe
// block below.
describe('ZERO_DEBT_AUDIT (incrément 2 finding, closed by mission "fair go-live" Phase F) — the 8 dead pricing-engine.ts exports no longer exist', () => {
  const DELETED_EXPORTS = [
    'assertMarginAcceptable',
    'priceSelection',
    'priceSelectedModule',
    'pricePilotage',
    'checkFloor',
    'compareSelectionToCanonicalPacks',
    'buildPricingEngineSnapshot',
    'PHASE_B_COST_HYPOTHESES_NON_CONTRACTUELLES',
  ];

  test.each(DELETED_EXPORTS)('%s no longer exists as an export of pricing-engine.ts', (name) => {
    const definition = read('lib/quotes/pricing-engine.ts');
    expect(definition).not.toMatch(new RegExp(`export (function|const) ${name}\\b`));
  });

  test('pricing-engine.ts::computeMargin (the dead 45/55-threshold engine) is deleted — margin.server.ts::computeMargin is the only one (MARGIN_ENGINES = 1)', () => {
    const pricingEngine = read('lib/quotes/pricing-engine.ts');
    expect(pricingEngine).not.toMatch(/export function computeMargin\(/);
    expect(pricingEngine).not.toMatch(/MARGIN_BLOCKING_THRESHOLD_PCT/);
    expect(pricingEngine).not.toMatch(/MARGIN_TARGET_THRESHOLD_PCT/);

    for (const file of [
      'app/api/quotes/margin/route.ts',
      'app/api/assistante/candidat-individuel/profils/[id]/quote/route.ts',
    ]) {
      const source = read(file);
      expect(source).toMatch(/import\s*\{[^}]*\bcomputeMargin\b[^}]*\}\s*from\s*['"]@\/lib\/quotes\/margin\.server['"]/);
      expect(source).not.toMatch(/import\s*\{[^}]*\bcomputeMargin\b[^}]*\}\s*from\s*['"]@\/lib\/quotes\/pricing-engine['"]/);
    }
  });
});

describe('ZERO_DEBT_AUDIT — pricing-engine.ts::applyDiscounts, a deliberate exception (kept dormant, not deleted)', () => {
  const allSourceFiles = [...listFiles('app', ['.ts', '.tsx']), ...listFiles('lib', ['.ts', '.tsx']), ...listFiles('components', ['.ts', '.tsx'])].filter(
    (f) => !f.includes('pricing-engine.ts'),
  );

  test('applyDiscounts is still defined, still has zero non-test importers in app/lib/components', () => {
    const definition = read('lib/quotes/pricing-engine.ts');
    expect(definition).toMatch(/export function applyDiscounts\b/);
    const importers = allSourceFiles.filter((f) => importsName(readFileSync(f, 'utf8'), 'applyDiscounts'));
    expect(importers.map((f) => relative(root, f))).toEqual([]);
  });
});

describe('ZERO_DEBT_AUDIT (incrément 2) — pipeline flag semantics stay exactly as documented', () => {
  test("isActiveForPublic() (the ACTIVE_PUBLIC-gating function) has zero callers outside pipeline-flag.ts and its own test — confirms ACTIVE_PUBLIC gates nothing wired today", () => {
    const flagFile = read('lib/quotes/pipeline-flag.ts');
    expect(flagFile).toMatch(/export function isActiveForPublic\(\)/);

    const allFiles = [...listFiles('app', ['.ts', '.tsx']), ...listFiles('lib', ['.ts', '.tsx']), ...listFiles('components', ['.ts', '.tsx'])].filter(
      (f) => !f.includes('pipeline-flag.ts'),
    );
    const importers = allFiles.filter((f) => importsName(readFileSync(f, 'utf8'), 'isActiveForPublic'));
    expect(importers.map((f) => relative(root, f))).toEqual([]);
  });

  test('requireInternalPipelineAccess only gates app/api/assistante/candidat-individuel/** — never /devis-bac or any public app/api/quotes/** route', () => {
    const guardFile = read('lib/quotes/candidat-individuel-guard.server.ts');
    expect(guardFile).toMatch(/export (async )?function requireInternalPipelineAccess/);

    const allFiles = listFiles('app', ['.ts', '.tsx']);
    const importers = allFiles
      .filter((f) => importsName(readFileSync(f, 'utf8'), 'requireInternalPipelineAccess'))
      .map((f) => relative(root, f));

    for (const importer of importers) {
      expect(importer).toMatch(/^app\/api\/assistante\/candidat-individuel\//);
    }

    // Confirms the public wizard's own routes never reference the guard at all.
    for (const publicRoute of ['app/api/quotes/recommend/route.ts', 'app/api/quotes/route.ts']) {
      const source = read(publicRoute);
      expect(source).not.toMatch(/requireInternalPipelineAccess|isActiveForInternalStaff/);
    }
  });
});

describe('ZERO_DEBT_AUDIT (incrément 2) — FAMILY_VISIBILITY_GATE_COVERAGE stays 100%', () => {
  test('getQuoteByPublicToken (the ungated primitive) has exactly one runtime importer: public-view.server.ts', () => {
    const persistence = read('lib/quotes/persistence.server.ts');
    expect(persistence).toMatch(/export async function getQuoteByPublicToken/);

    const allFiles = [...listFiles('app', ['.ts', '.tsx']), ...listFiles('lib', ['.ts', '.tsx'])].filter(
      (f) => !f.includes('persistence.server.ts'),
    );
    const importers = allFiles
      .filter((f) => importsName(readFileSync(f, 'utf8'), 'getQuoteByPublicToken'))
      .map((f) => relative(root, f));

    expect(importers).toEqual(['lib/quotes/public-view.server.ts']);
  });

  test('every tokenized family-facing runtime entrypoint calls getQuoteForFamilyView, never getQuoteByPublicToken directly', () => {
    for (const file of [
      'app/devis/[token]/page.tsx',
      'app/api/quotes/public/[token]/route.ts',
      'app/api/quotes/public/[token]/pdf/route.ts',
      'app/api/quotes/[id]/accept/route.ts',
    ]) {
      const source = read(file);
      expect(source).toMatch(/getQuoteForFamilyView/);
      expect(source).not.toMatch(/getQuoteByPublicToken/);
    }
  });
});

describe('ZERO_DEBT_AUDIT (incrément 2) — the two candidate engines stay structurally separate', () => {
  test('the legacy engine (recommendation.ts) and the canonical engine (pipeline.ts) both exist, at their documented locations', () => {
    expect(read('lib/quotes/recommendation.ts')).toMatch(/export function buildRecommendation\(/);
    expect(read('lib/quotes/pipeline.ts')).toMatch(/export function buildCandidateQuoteRecommendation\(/);
  });

  test('matchCanonicalPack has exactly one implementation (recommendation.ts), never redefined anywhere', () => {
    const recommendation = read('lib/quotes/recommendation.ts');
    expect(recommendation).toMatch(/export function matchCanonicalPack\(/);
    expect(read('lib/quotes/pipeline.ts')).not.toMatch(/export function matchCanonicalPack\(/);
    expect(read('lib/quotes/pricing-engine.ts')).not.toMatch(/export function matchCanonicalPack\(/);
  });

  // Updated for mission "fair go-live" Phase D (I5) —
  // PACK_UNPROVEN_MATCH = NEVER_SELECTED: pipeline.ts (the staff canonical
  // pipeline) deliberately stopped importing matchCanonicalPack — automatic
  // pack substitution is disabled for the staff path (no catalog authority
  // carries a structured coverage-key list per pack; see buildScenario's
  // own doc comment in pipeline.ts).
  test('pipeline.ts no longer imports matchCanonicalPack (staff pack substitution disabled, Phase D — the name may still appear in explanatory comments)', () => {
    expect(read('lib/quotes/pipeline.ts')).not.toMatch(/import\s*\{[^}]*matchCanonicalPack/);
  });

  // Updated for mission "fair go-live" Phase F (I7): pricing-engine.ts's
  // only caller of matchCanonicalPack (compareSelectionToCanonicalPacks)
  // was deleted as AST-proven-dead — the import is gone too, matchCanonicalPack
  // now has exactly the one implementation and zero re-importers left in
  // the candidat-individuel domain outside recommendation.ts itself.
  test('pricing-engine.ts no longer imports matchCanonicalPack (its only caller, compareSelectionToCanonicalPacks, was deleted in Phase F)', () => {
    expect(read('lib/quotes/pricing-engine.ts')).not.toMatch(/matchCanonicalPack/);
  });
});
