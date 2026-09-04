import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import yaml from 'js-yaml';
import genericConfig from '../../playwright.config';
import ariaConfig from '../../playwright.aria.config';

function getAllAriaSpecs(dir = 'e2e/aria'): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllAriaSpecs(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Playwright ARIA Collection Boundary Guard', () => {
  const ariaSpecs = getAllAriaSpecs();

  it('proves generic Playwright lane excludes ARIA specs (GENERIC_PLAYWRIGHT_COLLECTS_ARIA=NO)', () => {
    // Ce test verifie l'INVARIANT — la voie generique ne collecte aucune spec
    // ARIA — et non le MECANISME qui l'obtient. Exiger un `testIgnore` nommant
    // aria reviendrait a imposer la seule solution que `check-zero-test-debt`
    // interdit, et a empecher une portee declaree positivement, qui atteint le
    // meme resultat sans dispense.
    //
    // On reproduit ici la selection de Playwright : `testDir` fixe la racine,
    // `testMatch` et `testIgnore` sont evalues contre le chemin ABSOLU.
    const root = resolve(genericConfig.testDir ?? '.');
    const absolute = (spec: string) => resolve(spec);

    const globToRegExp = (glob: string): RegExp => {
      const escaped = glob
        .split('**').map((part) => part
          .split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*'))
        .join('.*');
      return new RegExp(escaped + '$');
    };

    const asList = (value: unknown): unknown[] =>
      value === undefined ? [] : Array.isArray(value) ? value : [value];

    const matches = (patterns: unknown[], file: string) => patterns.some((pattern) =>
      pattern instanceof RegExp ? pattern.test(file)
        : typeof pattern === 'string' ? globToRegExp(pattern).test(file)
          : false);

    const testMatch = asList(genericConfig.testMatch);
    const testIgnore = asList(genericConfig.testIgnore);
    // la voie generique doit declarer une portee
    expect(testMatch.length).toBeGreaterThan(0);

    const collected = ariaSpecs.filter((spec) => {
      const file = absolute(spec);
      if (!file.startsWith(root)) return false;
      if (testIgnore.length && matches(testIgnore, file)) return false;
      return matches(testMatch, file);
    });

    const GENERIC_PLAYWRIGHT_COLLECTS_ARIA = collected.length > 0 ? 'YES' : 'NO';
    // aucune spec ARIA collectee par la voie generique
    expect(collected).toEqual([]);
    expect(GENERIC_PLAYWRIGHT_COLLECTS_ARIA).toBe('NO');

    // Contre-epreuve : la meme evaluation DOIT retenir les specs de la racine
    // de e2e/, sans quoi un `testMatch` casse ferait passer ce test pour vert
    // en ne collectant plus rien du tout.
    const rootSpecs = readdirSync('e2e', { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.spec.ts'))
      .map((e) => join('e2e', e.name));
    const rootCollected = rootSpecs.filter((spec) => matches(testMatch, absolute(spec)));
    // la voie generique collecte bien ses propres specs
    expect(rootCollected.length).toBe(rootSpecs.length);
  });

  it('proves dedicated ARIA projects select non-empty tests respecting grep (DEDICATED_ARIA_LANE_COLLECTS_ARIA=YES)', () => {
    expect(ariaConfig.testDir).toBe('./e2e/aria');
    expect(ariaSpecs.length).toBeGreaterThan(0);

    const projects = ariaConfig.projects ?? [];
    expect(projects.length).toBeGreaterThanOrEqual(4);

    const desktopProject = projects.find((p) => p.name === 'aria-desktop');
    const mobileProject = projects.find((p) => p.name === 'aria-mobile');
    const a11yProject = projects.find((p) => p.name === 'aria-a11y');
    const smokeProject = projects.find((p) => p.name === 'aria-smoke');

    expect(desktopProject).toBeDefined();
    expect(mobileProject).toBeDefined();
    expect(a11yProject).toBeDefined();
    expect(smokeProject).toBeDefined();

    function countMatchingTests(project: (typeof projects)[0]): number {
      let count = 0;
      for (const spec of ariaSpecs) {
        const fileName = spec.replace('e2e/aria/', '');
        const match = project.testMatch;
        const matchesFile =
          match instanceof RegExp ? match.test(fileName) || match.test(spec) :
          typeof match === 'string' ? match === fileName || spec.endsWith(match) :
          false;
        if (!matchesFile) continue;

        const content = readFileSync(spec, 'utf8');
        const testMatches = [...content.matchAll(/(?:test|it)(?:\.only|\.skip)?\s*\(\s*(['"`])(.*?)\1/g)];
        for (const tm of testMatches) {
          const title = tm[2];
          const grepMatches =
            !project.grep ||
            (Array.isArray(project.grep)
              ? project.grep.some((r) => r.test(title))
              : project.grep.test(title));
          if (grepMatches) {
            count += 1;
          }
        }
      }
      return count;
    }

    const desktopCount = countMatchingTests(desktopProject!);
    const mobileCount = countMatchingTests(mobileProject!);
    const a11yCount = countMatchingTests(a11yProject!);
    const smokeCount = countMatchingTests(smokeProject!);

    expect(desktopCount).toBeGreaterThan(0);
    expect(mobileCount).toBeGreaterThan(0);
    expect(a11yCount).toBeGreaterThan(0);
    expect(smokeCount).toBeGreaterThan(0);

    const ARIA_DESKTOP_COLLECTION_NONEMPTY = desktopCount > 0 ? 'YES' : 'NO';
    const ARIA_MOBILE_COLLECTION_NONEMPTY = mobileCount > 0 ? 'YES' : 'NO';
    const ARIA_A11Y_COLLECTION_NONEMPTY = a11yCount > 0 ? 'YES' : 'NO';
    const ARIA_SMOKE_COLLECTION_NONEMPTY = smokeCount > 0 ? 'YES' : 'NO';

    expect(ARIA_DESKTOP_COLLECTION_NONEMPTY).toBe('YES');
    expect(ARIA_MOBILE_COLLECTION_NONEMPTY).toBe('YES');
    expect(ARIA_A11Y_COLLECTION_NONEMPTY).toBe('YES');
    expect(ARIA_SMOKE_COLLECTION_NONEMPTY).toBe('YES');

    const DEDICATED_ARIA_LANE_COLLECTS_ARIA =
      desktopCount > 0 && mobileCount > 0 && a11yCount > 0 && smokeCount > 0 ? 'YES' : 'NO';
    expect(DEDICATED_ARIA_LANE_COLLECTS_ARIA).toBe('YES');
  });

  it('proves complete ARIA dedicated CI matrix is present (ALL_DEDICATED_ARIA_LANES_PRESENT=YES)', () => {
    const rawWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    const parsed = yaml.load(rawWorkflow) as any;
    const ariaBrowserJob = parsed?.jobs?.['aria-browser'];
    expect(ariaBrowserJob).toBeDefined();

    const matrixIncludes = ariaBrowserJob?.strategy?.matrix?.include;
    expect(Array.isArray(matrixIncludes)).toBe(true);

    const extractedScripts: string[] = matrixIncludes.map((entry: any) => entry.script);
    const expectedScripts = [
      'test:aria:e2e:desktop',
      'test:aria:e2e:mobile',
      'test:aria:a11y',
      'aria:smoke:production-artifact',
    ];
    expect(extractedScripts.slice().sort()).toEqual(expectedScripts.slice().sort());

    const steps = ariaBrowserJob?.steps ?? [];
    const executionStep = steps.find(
      (s: any) => typeof s?.run === 'string' && s.run.includes('npm run ${{ matrix.script }}'),
    );
    expect(executionStep).toBeDefined();

    const ALL_DEDICATED_ARIA_LANES_PRESENT =
      extractedScripts.includes('test:aria:e2e:desktop') &&
      extractedScripts.includes('test:aria:e2e:mobile') &&
      extractedScripts.includes('test:aria:a11y') &&
      extractedScripts.includes('aria:smoke:production-artifact') &&
      executionStep !== undefined
        ? 'YES'
        : 'NO';
    expect(ALL_DEDICATED_ARIA_LANES_PRESENT).toBe('YES');

    const runnerScript = readFileSync('scripts/aria/run-e2e-suite.sh', 'utf8');
    expect(runnerScript).toMatch(/PLAYWRIGHT_CONFIG=playwright\.aria\.config\.ts/);

    const ARIA_E2E_COVERAGE_LOST =
      ariaSpecs.length > 0 && ALL_DEDICATED_ARIA_LANES_PRESENT === 'YES' ? 'NO' : 'YES';
    expect(ARIA_E2E_COVERAGE_LOST).toBe('NO');
  });
});
