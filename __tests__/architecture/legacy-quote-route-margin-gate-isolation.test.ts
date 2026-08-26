import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * T1 closeout, item 1 (direction decision registry, commit 4ffaac8ed;
 * T1 itself at 0e60466ea) — locks the audit conclusion:
 *
 *   LEGACY_QUOTE_ROUTE_ISOLATION = PASS
 *   (app/api/quotes/route.ts is ISOLATED_FROM_CANDIDAT_INDIVIDUEL)
 *
 * app/api/quotes/route.ts creates Quote rows with zero margin-gate check
 * (confirmed: no computeMargin/getCommercialCostPolicy import or call in
 * that file) — a real, pre-existing gap. This test does not close that
 * gap (out of scope: it is the LEGACY public/shadow SituationInput engine,
 * unrelated to candidat-individuel, and predates this mission). It proves
 * instead that a candidat-individuel-priced devis can never reach this
 * route or be represented by a Quote it creates, so that gap can never be
 * used to bypass the candidat-individuel margin gate specifically.
 *
 * Full trace this test encodes:
 *   input/caller -> route -> payload/schema -> persistence -> PDF -> signed view
 *
 * 1. Schema: the route's request schema requires a `situation` object in
 *    the legacy SituationInput shape (lowercase level, `specialites`
 *    tuple) — structurally incompatible with candidat-individuel's
 *    ProfilCandidat/publicInput shape (uppercase level, moyenneRattrapage,
 *    modalite, staffExtension...). No `profilId` field exists on this
 *    route's schema at all.
 * 2. Engine: the route computes via lib/quotes/recommendation.ts's
 *    buildRecommendation — which never imports the candidat-individuel
 *    pipeline (buildCandidateQuoteRecommendation, resolveCatalogueModules,
 *    or any ProfilCandidat type).
 * 3. Persistence: the route's createQuote(...) call never passes
 *    `profilId` — every Quote this route creates has profilId=null.
 * 4. PDF/signed view: both the candidat-individuel-scoped staff PDF route
 *    and the family-facing signed-link view explicitly key off
 *    `quote.profilId != null` — a profilId=null Quote (everything this
 *    route can ever produce) is never treated as a candidat-individuel
 *    quote downstream, and the candidat-individuel PDF route 404s on it.
 */

const root = process.cwd();

function read(relPath: string): string {
  return readFileSync(join(root, relPath), 'utf8');
}

describe('T1 closeout — app/api/quotes/route.ts is isolated from candidat-individuel (LEGACY_QUOTE_ROUTE_ISOLATION)', () => {
  test('1. schema: the route requires the legacy SituationInput shape, never a profilId field', () => {
    const route = read('app/api/quotes/route.ts');
    expect(route).toContain("situation: situationSchema");
    expect(route).not.toMatch(/profilId\s*:\s*z\./);
  });

  test('1b. the legacy situationSchema shape is structurally incompatible with candidat-individuel input (lowercase level enum, specialites tuple — not the uppercase ProfilCandidat shape)', () => {
    const httpSchemas = read('lib/quotes/http-schemas.ts');
    expect(httpSchemas).toMatch(/level:\s*z\.enum\(\['premiere',\s*'terminale'\]\)/);
    expect(httpSchemas).not.toMatch(/moyenneRattrapage|staffExtension|p3EligibiliteAudit/);
  });

  test('2. engine: lib/quotes/recommendation.ts (buildRecommendation, what this route actually prices with) never imports the candidat-individuel pipeline', () => {
    const recommendation = read('lib/quotes/recommendation.ts');
    expect(recommendation).not.toMatch(/buildCandidateQuoteRecommendation|resolveCatalogueModules|from ['"]@\/lib\/exams\/carte['"]/);
  });

  test('3. persistence: the route\'s createQuote(...) call site never sets profilId — every Quote it can create has profilId=null', () => {
    const route = read('app/api/quotes/route.ts');
    const callStart = route.indexOf('const result = await createQuote({');
    expect(callStart).toBeGreaterThan(-1);
    const callEnd = route.indexOf('});', callStart);
    const callBody = route.slice(callStart, callEnd);
    expect(callBody).not.toMatch(/profilId/);
  });

  test('4a. the candidat-individuel staff PDF route 404s on a profilId=null Quote — exactly what this legacy route always produces', () => {
    const pdfRoute = read('app/api/assistante/candidat-individuel/quotes/[quoteId]/pdf/route.ts');
    expect(pdfRoute).toMatch(/quote\.profilId\s*==\s*null/);
  });

  test('4b. the family-facing signed-link view scopes its candidat-individuel-specific emission check to profilId != null — a legacy (profilId=null) quote keeps its unrelated prior behavior, never gaining or needing the candidat-individuel margin gate', () => {
    const publicView = read('lib/quotes/public-view.server.ts');
    expect(publicView).toMatch(/profilId\s*!=\s*null/);
  });

  test('documented, not fixed: app/api/quotes/route.ts itself never checks margin at all — a real, pre-existing gap, out of scope for candidat-individuel (T1 closeout item 1)', () => {
    const route = read('app/api/quotes/route.ts');
    expect(route).not.toMatch(/computeMargin|getCommercialCostPolicy/);
  });
});
