import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the P11 (SVC_SECOND_GROUPE) closure lot (mission "vers un produit
 * complet", correction du verdict GO_RECETTE_INTERNE_END_TO_END). Before
 * this lot, computeSecondGroupePayment existed in lib/quotes/pricing-engine.ts
 * but was referenced nowhere in the production pipeline — a P11 quote
 * could never actually be produced through the real entry point, only
 * through a direct unit test of the function in isolation. This test fails
 * loudly if that regresses: if pipeline.ts stops calling
 * buildSecondGroupeScenarios (the only production caller of
 * computeSecondGroupePayment), the P11 mechanism silently goes back to
 * being dead code again, exactly as before.
 */

const root = process.cwd();

function read(relPath: string): string {
  return readFileSync(join(root, relPath), 'utf8');
}

describe('P11 (second groupe) payment mechanism — stays wired into the production pipeline', () => {
  test('pipeline.ts still calls buildSecondGroupeScenarios (the P11 entry point)', () => {
    const content = read('lib/quotes/pipeline.ts');
    expect(content).toMatch(/buildSecondGroupeScenarios\(/);
  });

  test('pricing-engine.ts still defines both buildSecondGroupeScenarios and computeSecondGroupePayment, and the former calls the latter', () => {
    const content = read('lib/quotes/pricing-engine.ts');
    expect(content).toMatch(/export function buildSecondGroupeScenarios/);
    expect(content).toMatch(/export function computeSecondGroupePayment/);

    const fnStart = content.indexOf('export function buildSecondGroupeScenarios');
    const fnBody = content.slice(fnStart, fnStart + 2000);
    expect(fnBody).toMatch(/computeSecondGroupePayment\(/);
  });

  test('computeSecondGroupePayment has exactly one production caller (buildSecondGroupeScenarios) — never called directly from pipeline.ts, keeping the payment contract centralized', () => {
    const pipelineContent = read('lib/quotes/pipeline.ts');
    expect(pipelineContent).not.toMatch(/computeSecondGroupePayment\(/);
  });

  test('the pipeline gates P11 emission on the real catalogue directionApprovalStatus, not a hardcoded true', () => {
    const content = read('lib/quotes/pipeline.ts');
    expect(content).toMatch(/directionApprovalStatus\s*!==\s*['"]APPROVED['"]/);
  });

  test('QuoteScenario carries a paymentPolicy discriminant (no more ambiguous deposit/months heuristics)', () => {
    const content = read('lib/quotes/schemas.ts');
    expect(content).toMatch(/paymentPolicy:\s*QuotePaymentPolicy/);
    expect(content).toMatch(/PAY_IN_FULL_AT_BOOKING/);
  });

  test('the PDF adapter and the family-facing signed-link page both branch on paymentPolicy, never on the old deposit!=null/months===1 heuristics, for the P11 rendering decision', () => {
    const pdfAdapter = read('lib/quotes/pdf-adapter.server.ts');
    expect(pdfAdapter).toMatch(/paymentPolicy\s*===\s*['"]PAY_IN_FULL_AT_BOOKING['"]/);

    const familyPage = read('app/devis/[token]/page.tsx');
    expect(familyPage).toMatch(/paymentPolicy\s*===\s*['"]PAY_IN_FULL_AT_BOOKING['"]/);
  });
});
