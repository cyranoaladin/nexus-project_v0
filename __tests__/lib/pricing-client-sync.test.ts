/**
 * Ensures generated client JSON files stay in sync with
 * data/pricing.canonical.json — the single source of truth.
 *
 * If this test fails, run: node scripts/generate-pricing-client-data.js
 */
import {
  PRICING_ANNUAL_OFFER_SUMMARIES,
  PRICING_RULES,
  PRICING_REPERES,
  getAnnualOfferPricing,
  getNextStage,
} from '@/lib/pricing-client';
import pricingData from '@/data/pricing.canonical.json';
import clientDataGenerated from '@/data/pricing-client-data.generated.json';

const canonical = pricingData as Record<string, unknown> & {
  rules: typeof PRICING_RULES;
  reperes_tarifaires: typeof PRICING_REPERES;
  stage_calendar: Array<{ id: string; title: string; date_start: string; dates_display: string }>;
  operational_subscription_plans: Record<string, unknown>;
  operational_aria_addons: Record<string, unknown>;
  operational_special_packs: Record<string, unknown>;
  operational_credit_costs: Record<string, number>;
  offers: Array<{
    id: string;
    price_annual: number;
    deposit: number | null;
    n_installments: number | null;
    installment_amount: number | null;
    last_installment: number | null;
  }>;
};

const generated = clientDataGenerated as Record<string, unknown>;

describe('pricing-client sync — rules, repères, calendar', () => {
  it('PRICING_RULES matches canonical JSON', () => {
    expect(PRICING_RULES).toEqual(canonical.rules);
  });

  it('PRICING_REPERES matches canonical JSON', () => {
    expect(PRICING_REPERES).toEqual(canonical.reperes_tarifaires);
  });

  it('getNextStage calendar entries match canonical stage_calendar', () => {
    for (const entry of canonical.stage_calendar) {
      const dayBefore = new Date(new Date(entry.date_start).getTime() - 86_400_000);
      const result = getNextStage(dayBefore);
      expect(result).not.toBeNull();
      expect(result!.title).toBe(entry.title);
      expect(result!.date_start).toBe(entry.date_start);
      expect(result!.dates_display).toBe(entry.dates_display);
    }
  });
});

describe('pricing-client sync — operational catalog', () => {
  it('operational_subscription_plans matches canonical', () => {
    expect(generated.operational_subscription_plans).toEqual(canonical.operational_subscription_plans);
  });

  it('operational_aria_addons matches canonical', () => {
    expect(generated.operational_aria_addons).toEqual(canonical.operational_aria_addons);
  });

  it('operational_special_packs matches canonical', () => {
    expect(generated.operational_special_packs).toEqual(canonical.operational_special_packs);
  });

  it('operational_credit_costs matches canonical', () => {
    expect(generated.operational_credit_costs).toEqual(canonical.operational_credit_costs);
  });
});

describe('pricing-client sync — annual offer pricing', () => {
  it('exposes only canonical payment fields for every annual offer', () => {
    const expected = canonical.offers.map((offer) => ({
      id: offer.id,
      price_annual: offer.price_annual,
      deposit: offer.deposit,
      n_installments: offer.n_installments,
      installment_amount: offer.installment_amount,
      last_installment: offer.last_installment,
    }));

    expect(PRICING_ANNUAL_OFFER_SUMMARIES).toEqual(expected);
    for (const offer of expected) {
      expect(getAnnualOfferPricing(offer.id)).toEqual(offer);
    }
    expect(getAnnualOfferPricing('missing-offer')).toBeUndefined();
  });
});

describe('pricing no-import guard — transitive', () => {
  /**
   * Traces the import graph from every 'use client' file.
   * If ANY file in the transitive closure imports @/lib/pricing
   * (runtime, not type-only), that's a violation — the full 28 KB
   * canonical JSON ends up in the client bundle.
   */
  it('no use-client component transitively imports lib/pricing.ts', () => {
    const fs = require('fs');
    const path = require('path');
    const glob = require('glob');

    const allFiles: string[] = glob.sync('{app,components,lib}/**/*.{ts,tsx}', {
      ignore: ['**/node_modules/**', '**/.next/**'],
    });

    // Build a map: filePath → set of imported module paths
    const importGraph = new Map<string, Array<{ specifier: string; fromFile: string }>>();
    const fileContents = new Map<string, string>();

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      fileContents.set(file, content);
      const imports: Array<{ specifier: string; fromFile: string }> = [];

      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('import type ')) continue; // erased at compile time
        // Static imports: from '...'
        const match = trimmed.match(/from\s+['"]([^'"]+)['"]/);
        if (match) {
          imports.push({ specifier: match[1], fromFile: file });
        }
        // Dynamic imports: import('...') / import("...") — skip import type(...)
        if (/import\s+type\s*\(/.test(trimmed)) continue;
        const dynMatch = trimmed.match(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (dynMatch) {
          imports.push({ specifier: dynMatch[1], fromFile: file });
        }
      }
      importGraph.set(file, imports);
    }

    // Resolve a specifier (either @/foo or ./foo) to a real file path
    function resolveSpecifier(specifier: string, fromFile: string): string | null {
      let relative: string;
      if (specifier.startsWith('@/')) {
        relative = specifier.replace(/^@\//, '');
      } else if (specifier.startsWith('.')) {
        relative = path.join(path.dirname(fromFile), specifier);
      } else {
        return null; // node_modules — not our concern
      }
      for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
        const candidate = relative + ext;
        if (fileContents.has(candidate)) return candidate;
      }
      return null;
    }

    // Check if a file transitively imports @/lib/pricing
    function importsLibPricing(file: string, visited: Set<string>): boolean {
      if (visited.has(file)) return false;
      visited.add(file);

      const imports = importGraph.get(file);
      if (!imports) return false;

      for (const { specifier, fromFile } of imports) {
        if (specifier === '@/lib/pricing') return true;
        const resolved = resolveSpecifier(specifier, fromFile);
        // Also catch relative paths that resolve to lib/pricing.ts
        if (resolved && (resolved === 'lib/pricing.ts' || resolved.startsWith('lib/pricing/'))) return true;
        if (resolved && importsLibPricing(resolved, visited)) return true;
      }
      return false;
    }

    // Detect 'use client' — first non-empty, non-comment line
    function isClientFile(content: string): boolean {
      for (const line of content.split('\n')) {
        const t = line.trim();
        if (t === '' || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) continue;
        return t === "'use client';" || t === '"use client";'
          || t === "'use client'" || t === '"use client"';
      }
      return false;
    }

    const violations: string[] = [];

    for (const file of allFiles) {
      const content = fileContents.get(file)!;
      if (!isClientFile(content)) continue;

      if (importsLibPricing(file, new Set())) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });
});
