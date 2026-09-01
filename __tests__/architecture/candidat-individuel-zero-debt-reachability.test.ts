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

describe('ZERO_DEBT_AUDIT (incrément 2) — pricing-engine.ts dead exports stay dead', () => {
  const DEAD_EXPORTS = [
    'assertMarginAcceptable',
    'priceSelection',
    'priceSelectedModule',
    'pricePilotage',
    'applyDiscounts',
    'checkFloor',
    'compareSelectionToCanonicalPacks',
    'buildPricingEngineSnapshot',
  ];

  const allSourceFiles = [...listFiles('app', ['.ts', '.tsx']), ...listFiles('lib', ['.ts', '.tsx']), ...listFiles('components', ['.ts', '.tsx'])].filter(
    (f) => !f.includes('pricing-engine.ts'),
  );

  test.each(DEAD_EXPORTS)('%s is defined in pricing-engine.ts but imported nowhere else in app/lib/components', (name) => {
    const definition = read('lib/quotes/pricing-engine.ts');
    expect(definition).toMatch(new RegExp(`export function ${name}\\b`));

    const importers = allSourceFiles.filter((f) => importsName(readFileSync(f, 'utf8'), name));
    expect(importers.map((f) => relative(root, f))).toEqual([]);
  });

  test('pricing-engine.ts::computeMargin (the dead 45/55-threshold engine) has zero runtime importers — every real caller imports computeMargin from margin.server.ts', () => {
    const pricingEngine = read('lib/quotes/pricing-engine.ts');
    expect(pricingEngine).toMatch(/export function computeMargin\(/);
    expect(pricingEngine).toMatch(/MARGIN_BLOCKING_THRESHOLD_PCT\s*=\s*45/);
    expect(pricingEngine).toMatch(/MARGIN_TARGET_THRESHOLD_PCT\s*=\s*55/);

    for (const file of [
      'app/api/quotes/margin/route.ts',
      'app/api/assistante/candidat-individuel/profils/[id]/quote/route.ts',
    ]) {
      const source = read(file);
      expect(source).toMatch(/import\s*\{[^}]*\bcomputeMargin\b[^}]*\}\s*from\s*['"]@\/lib\/quotes\/margin\.server['"]/);
      expect(source).not.toMatch(/import\s*\{[^}]*\bcomputeMargin\b[^}]*\}\s*from\s*['"]@\/lib\/quotes\/pricing-engine['"]/);
    }
  });

  test('PHASE_B_COST_HYPOTHESES_NON_CONTRACTUELLES stays a documented-dead, non-contractual constant', () => {
    const source = read('lib/quotes/pricing-engine.ts');
    expect(source).toMatch(/PHASE_B_COST_HYPOTHESES_NON_CONTRACTUELLES/);
    const importers = allSourceFiles.filter((f) => importsName(readFileSync(f, 'utf8'), 'PHASE_B_COST_HYPOTHESES_NON_CONTRACTUELLES'));
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

  test('matchCanonicalPack has exactly one implementation (recommendation.ts), imported (never redefined) by pipeline.ts and pricing-engine.ts', () => {
    const recommendation = read('lib/quotes/recommendation.ts');
    expect(recommendation).toMatch(/export function matchCanonicalPack\(/);

    for (const file of ['lib/quotes/pipeline.ts', 'lib/quotes/pricing-engine.ts']) {
      const source = read(file);
      expect(source).toMatch(/matchCanonicalPack.*from ['"]\.\/recommendation['"]/);
      expect(source).not.toMatch(/export function matchCanonicalPack\(/);
    }
  });
});
