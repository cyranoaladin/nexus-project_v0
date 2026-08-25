import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the Lot 5 → recâblage transition (docs/candidat-individuel/
 * lot5-catalogue-brainstorming.md Décision 1 + §4, and the "recâblage"
 * mission §1-§3). Through Lot 5, the carte-aware stack (catalogue,
 * pricing-engine) was entirely unwired from app/components. The recâblage
 * mission opened a first sanctioned entry point — app/api/quotes/route.ts,
 * shadow mode only, flag-gated, never visible, never contractual — and
 * mission §5 deliberately opens two more, consciously, not silently: the
 * ADMIN/ASSISTANTE-only internal workspace (app/dashboard/assistante/
 * candidat-individuel/page.tsx reads the flag to decide what to render;
 * app/api/assistante/candidat-individuel/simulate/route.ts runs the
 * pipeline directly) — both additionally gated by requireAnyRole AND
 * isActiveForInternalStaff() (see lib/quotes/candidat-individuel-guard.server.ts),
 * never a public bypass. This test enforces the whitelist explicitly
 * rather than a blanket ban, so a further, uncontrolled entry point can
 * never appear silently.
 */

const root = process.cwd();

const CARTE_AWARE_MODULE_SPECIFIERS = [
  '@/lib/quotes/catalogue',
  '@/lib/quotes/pricing-engine',
  '@/lib/quotes/pipeline',
  '@/lib/quotes/pipeline-flag',
  '@/lib/quotes/shadow-comparison',
  '@/lib/quotes/shadow-persistence.server',
];

/** The only files under app/ or components/ allowed to import the carte-aware stack — shadow mode (mission §2/§3) plus the ADMIN/ASSISTANTE-only internal workspace (mission §5). */
const SANCTIONED_ENTRY_POINTS = [
  'app/api/quotes/route.ts',
  'app/api/assistante/candidat-individuel/simulate/route.ts',
  'app/dashboard/assistante/candidat-individuel/page.tsx',
];

function listFilesRecursive(dir: string, exts: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...listFilesRecursive(full, exts));
    else if (exts.some((ext) => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

function importsCarteAwareStack(content: string): boolean {
  return CARTE_AWARE_MODULE_SPECIFIERS.some(
    (spec) => content.includes(`from '${spec}'`) || content.includes(`from "${spec}"`),
  );
}

describe('Recâblage — architecture boundary (carte-aware stack wiring is whitelisted, not silent)', () => {
  test('only the sanctioned entry point(s) under app/ or components/ import the carte-aware stack', () => {
    const candidateFiles = [
      ...listFilesRecursive(join(root, 'app'), ['.ts', '.tsx']),
      ...listFilesRecursive(join(root, 'components'), ['.ts', '.tsx']),
    ];
    const sanctionedAbsolute = new Set(SANCTIONED_ENTRY_POINTS.map((f) => join(root, f)));
    const offenders = candidateFiles.filter((file) => !sanctionedAbsolute.has(file) && importsCarteAwareStack(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  test('the sanctioned entry point actually exists and does import the carte-aware stack (the whitelist is not stale)', () => {
    for (const file of SANCTIONED_ENTRY_POINTS) {
      const content = readFileSync(join(root, file), 'utf8');
      expect(importsCarteAwareStack(content)).toBe(true);
    }
  });

  test('the sanctioned entry point gates the wiring behind isShadowModeEnabled() — never unconditional', () => {
    const content = readFileSync(join(root, 'app/api/quotes/route.ts'), 'utf8');
    expect(content).toContain('isShadowModeEnabled()');
  });

  test('the sanctioned entry point never returns pipeline/shadow data in its HTTP response (shadow mode stays invisible)', () => {
    const content = readFileSync(join(root, 'app/api/quotes/route.ts'), 'utf8');
    const responseCalls = content.match(/NextResponse\.json\(\{[^}]*\}/g) ?? [];
    for (const call of responseCalls) {
      expect(call).not.toMatch(/shadowRecord|pipelineResult|newSummary/);
    }
  });

  test('the carte-aware stack itself never imports from app/ or components/ (one-way: carte-aware -> legacy shape, never the reverse)', () => {
    const carteAwareFiles = [
      'lib/quotes/catalogue.ts',
      'lib/quotes/pricing-engine.ts',
      'lib/quotes/pipeline.ts',
      'lib/quotes/pipeline-flag.ts',
      'lib/quotes/shadow-comparison.ts',
      'lib/quotes/shadow-persistence.server.ts',
    ];
    for (const file of carteAwareFiles) {
      const content = readFileSync(join(root, file), 'utf8');
      expect(content).not.toMatch(/from ['"]@\/app\//);
      expect(content).not.toMatch(/from ['"]@\/components\//);
    }
  });

  test('no second parallel namespace lib/tarification/ exists (mission §4 — single canonical catalogue)', () => {
    expect(existsSync(join(root, 'lib/tarification'))).toBe(false);
  });

  test('the catalogue data lives only in data/pricing.canonical.json — no second candidate_individuel_catalogue JSON file exists', () => {
    const dataFiles = listFilesRecursive(join(root, 'data'), ['.json']).filter(
      (f) => f !== join(root, 'data/pricing.canonical.json') && f !== join(root, 'data/pricing-client-data.generated.json'),
    );
    const offenders = dataFiles.filter((f) => readFileSync(f, 'utf8').includes('candidat_individuel_catalogue'));
    expect(offenders).toEqual([]);
  });
});
