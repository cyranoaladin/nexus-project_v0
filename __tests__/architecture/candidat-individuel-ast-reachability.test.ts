import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * Incrément 3, mission §3 — REACHABILITY_REGEX_ONLY = NO. The incrément 2
 * scanner (candidat-individuel-zero-debt-reachability.test.ts) proved
 * reachability with source-text regex. This upgrades the most sensitive
 * claims to a real AST/import-graph proof (scripts/audit/import-graph.mjs,
 * TypeScript Compiler API — resolves named/aliased/namespace imports,
 * re-exports, barrel exports, and destructured dynamic imports; not
 * string matching). For every future DELETE (mission §11/§16), combine
 * this AST proof with typecheck + full tests — never a grep alone.
 */

const root = process.cwd();

function importGraph(file: string, exportName: string): { file: string; export: string; importers: string[] } {
  const result = spawnSync('node', [join(root, 'scripts/audit/import-graph.mjs'), '--file', file, '--export', exportName], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
  });
  if (result.status !== 0) {
    throw new Error(`import-graph.mjs failed for ${file}::${exportName}: ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function nonTestImporters(importers: string[]): string[] {
  return importers.filter((f) => !f.startsWith('__tests__/'));
}

describe('AST import-graph — pricing-engine.ts dead exports, deleted (mission "fair go-live" Phase F/I7, MARGIN_ENGINES = 1)', () => {
  test.each([
    'computeMargin', // the dead 45%/55%-threshold engine — margin.server.ts::computeMargin is now the only one.
    'assertMarginAcceptable',
    'priceSelection',
    'priceSelectedModule',
    'pricePilotage',
    'checkFloor',
    'compareSelectionToCanonicalPacks',
    'buildPricingEngineSnapshot',
    'PHASE_B_COST_HYPOTHESES_NON_CONTRACTUELLES',
  ])('%s does not exist as an export of pricing-engine.ts at all (deleted, not merely unimported)', (exportName) => {
    const { importers } = importGraph('lib/quotes/pricing-engine.ts', exportName);
    expect(importers).toEqual([]);
  });
});

describe('AST import-graph — pricing-engine.ts::applyDiscounts, a deliberate exception (kept dormant, not deleted; see pricing-engine.ts\'s top doc comment)', () => {
  test('applyDiscounts still has zero non-test importers (genuinely unused in production, safe to keep dormant)', () => {
    const { importers } = importGraph('lib/quotes/pricing-engine.ts', 'applyDiscounts');
    expect(nonTestImporters(importers)).toEqual([]);
  });
});

describe('AST import-graph — FAMILY_VISIBILITY_INVARIANTS gate stays the single entrypoint', () => {
  test('getQuoteByPublicToken (the ungated primitive) has exactly one non-test importer: public-view.server.ts', () => {
    const { importers } = importGraph('lib/quotes/persistence.server.ts', 'getQuoteByPublicToken');
    expect(nonTestImporters(importers)).toEqual(['lib/quotes/public-view.server.ts']);
  });
});

describe('AST import-graph — the canonical candidate-need resolver is only used by the canonical pipeline', () => {
  test('resolveCandidateNeeds has exactly one non-test importer: pipeline.ts', () => {
    const { importers } = importGraph('lib/quotes/candidate-need.ts', 'resolveCandidateNeeds');
    expect(nonTestImporters(importers)).toEqual(['lib/quotes/pipeline.ts']);
  });
});

describe('AST import-graph — the removed transitional adapter has zero importers anywhere (proves the incrément 3 deletion is complete, not just source-absent)', () => {
  test('adaptCatalogueSelectionToExamProfile does not exist as an export of catalogue.ts at all (deleted, not merely unimported)', () => {
    const { importers } = importGraph('lib/quotes/catalogue.ts', 'adaptCatalogueSelectionToExamProfile');
    expect(importers).toEqual([]);
  });

  test('MODULE_LEGACY_MAPPING does not exist as an export of catalogue.ts at all (deleted, not merely unimported)', () => {
    const { importers } = importGraph('lib/quotes/catalogue.ts', 'MODULE_LEGACY_MAPPING');
    expect(importers).toEqual([]);
  });
});
