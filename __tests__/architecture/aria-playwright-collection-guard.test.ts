import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

    const hasAriaIgnore = testIgnore.some((pattern) =>
      typeof pattern === 'string' && pattern.includes('aria'),
    );
    expect(hasAriaIgnore).toBe(true);

    // Verify none of the aria spec files are collected by the generic configuration
    const genericCollectsAria = ariaSpecs.some((spec) => {
      const ignored = testIgnore.some((pattern) => {
        if (typeof pattern === 'string') {
          if (pattern === '**/aria/**' && spec.startsWith('e2e/aria/')) return true;
          if (pattern.includes('aria') && spec.includes('aria')) return true;
        }
        return false;
      });
      return !ignored;
    });

    const GENERIC_PLAYWRIGHT_COLLECTS_ARIA = genericCollectsAria ? 'YES' : 'NO';
    expect(GENERIC_PLAYWRIGHT_COLLECTS_ARIA).toBe('NO');
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

    // Matrix must define desktop, mobile, a11y, and smoke browser lanes
    expect(rawWorkflow).toMatch(/test:aria:e2e:desktop/);
    expect(rawWorkflow).toMatch(/test:aria:e2e:mobile/);
    expect(rawWorkflow).toMatch(/test:aria:a11y/);
    expect(rawWorkflow).toMatch(/aria:smoke:production-artifact/);

    const ALL_DEDICATED_ARIA_LANES_PRESENT =
      rawWorkflow.includes('test:aria:e2e:desktop') &&
      rawWorkflow.includes('test:aria:e2e:mobile') &&
      rawWorkflow.includes('test:aria:a11y') &&
      rawWorkflow.includes('aria:smoke:production-artifact')
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
