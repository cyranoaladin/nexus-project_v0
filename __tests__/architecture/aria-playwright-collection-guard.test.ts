import { readdirSync, readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
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
    const rawGenericConfig = readFileSync('playwright.config.ts', 'utf8');
    expect(rawGenericConfig).toMatch(/testIgnore:\s*\[[^\]]*'[\*\/]*aria[\*\/]*'[^\]]*\]/);

    const testIgnore = Array.isArray(genericConfig.testIgnore)
      ? genericConfig.testIgnore
      : [genericConfig.testIgnore].filter(Boolean);

    // 1. Assert exact '**/aria/**' ignore pattern exists
    const GENERIC_TEST_IGNORE_EXACT = testIgnore.includes('**/aria/**') ? 'YES' : 'NO';
    expect(GENERIC_TEST_IGNORE_EXACT).toBe('YES');

    // 2. Verify all ARIA spec paths match the exact glob pattern
    const ariaGlobRegex = /(?:^|\/)aria\/.+/;
    for (const spec of ariaSpecs) {
      expect(ariaGlobRegex.test(spec)).toBe(true);
    }

    const genericCollectsAria = ariaSpecs.some((spec) => {
      const isIgnored = testIgnore.includes('**/aria/**') && ariaGlobRegex.test(spec);
      return !isIgnored;
    });

    const GENERIC_PLAYWRIGHT_COLLECTS_ARIA = genericCollectsAria ? 'YES' : 'NO';
    expect(GENERIC_PLAYWRIGHT_COLLECTS_ARIA).toBe('NO');

    // 3. Real Playwright runtime counter-proof: run playwright test --list
    const tempCredsPath = join(tmpdir(), `playwright-list-guard-credentials-${process.pid}.json`);
    let tempFileCreated = false;
    try {
      if (!existsSync('e2e/.credentials.json') && !process.env.E2E_CREDENTIALS_PATH) {
        const dummyRoles = [
          'parent', 'student', 'student2', 'studentSurvival',
          'coach', 'coach2', 'admin', 'assistante', 'zenon',
          'ariaTerminaleMaths', 'ariaPremiereMaths', 'ariaNsi',
          'ariaNsiPeer', 'ariaStmgNoChat', 'ariaIncompleteProfile', 'ariaNotEntitled',
        ];
        const dummyObj: Record<string, { email: string; password: string }> = {};
        for (const role of dummyRoles) {
          dummyObj[role] = { email: `${role}@example.test`, password: 'dummy-password' };
        }
        writeFileSync(tempCredsPath, JSON.stringify(dummyObj));
        tempFileCreated = true;
      }

      const childEnv = { ...process.env };
      delete childEnv.JEST_WORKER_ID;
      childEnv.E2E_CREDENTIALS_PATH =
        process.env.E2E_CREDENTIALS_PATH ||
        (existsSync('e2e/.credentials.json') ? 'e2e/.credentials.json' : tempCredsPath);

      const listOutput = execSync('npx playwright test --config=playwright.config.ts --list', {
        encoding: 'utf8',
        env: childEnv,
        timeout: 60_000,
      });

      // Assert that Playwright actually ran and reported tests (fail loudly on format changes or empty output)
      const totalMatch = listOutput.match(/Total:\s*(\d+)\s*tests/);
      expect(totalMatch).not.toBeNull();
      const totalDiscovered = Number(totalMatch![1]);
      expect(totalDiscovered).toBeGreaterThan(0);

      // Verify no spec path belongs to e2e/aria
      const ariaSpecMatches = listOutput
        .split('\n')
        .filter((line) => line.includes('.spec.ts') && /(?:^|\/|\s)e2e\/aria\/|aria[^\s]*\.spec\.ts/.test(line));

      const GENERIC_PLAYWRIGHT_ARIA_SPEC_COUNT = ariaSpecMatches.length;
      expect(GENERIC_PLAYWRIGHT_ARIA_SPEC_COUNT).toBe(0);
    } finally {
      if (tempFileCreated && existsSync(tempCredsPath)) {
        try { unlinkSync(tempCredsPath); } catch { /* ignore */ }
      }
    }
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
