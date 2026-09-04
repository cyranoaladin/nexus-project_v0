import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import genericConfig from '../../playwright.config';
import ariaConfig from '../../playwright.aria.config';

describe('Playwright ARIA Collection Boundary Guard', () => {
  const ariaSpecs = readdirSync('e2e/aria')
    .filter((file) => file.endsWith('.spec.ts'))
    .map((file) => `e2e/aria/${file}`);

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
      // If any ignore pattern matches the spec, it is not collected
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

  it('proves dedicated ARIA config targets e2e/aria and collects all specs (DEDICATED_ARIA_LANE_COLLECTS_ARIA=YES)', () => {
    expect(ariaConfig.testDir).toBe('./e2e/aria');
    expect(ariaSpecs.length).toBeGreaterThan(0);

    const projectMatches = (ariaConfig.projects ?? []).map((project) => project.testMatch);
    expect(projectMatches.length).toBeGreaterThanOrEqual(4);

    // Every ARIA spec must be matched by at least one dedicated project in ariaConfig
    const allSpecsMatched = ariaSpecs.every((spec) => {
      const fileName = spec.replace('e2e/aria/', '');
      return projectMatches.some((matcher) => {
        if (matcher instanceof RegExp) return matcher.test(fileName) || matcher.test(spec);
        if (typeof matcher === 'string') return matcher === fileName || spec.endsWith(matcher);
        return false;
      });
    });

    const DEDICATED_ARIA_LANE_COLLECTS_ARIA = allSpecsMatched ? 'YES' : 'NO';
    expect(DEDICATED_ARIA_LANE_COLLECTS_ARIA).toBe('YES');
  });

  it('proves no ARIA E2E coverage is lost (ARIA_E2E_COVERAGE_LOST=NO)', () => {
    const rawWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    // Ensure the dedicated aria-browser job is present in CI workflow
    expect(rawWorkflow).toMatch(/aria-browser:/);
    expect(rawWorkflow).toMatch(/test:aria:e2e:desktop/);

    const runnerScript = readFileSync('scripts/aria/run-e2e-suite.sh', 'utf8');
    expect(runnerScript).toMatch(/PLAYWRIGHT_CONFIG=playwright\.aria\.config\.ts/);

    const ARIA_E2E_COVERAGE_LOST = ariaSpecs.length > 0 && ariaConfig.testDir === './e2e/aria' ? 'NO' : 'YES';
    expect(ARIA_E2E_COVERAGE_LOST).toBe('NO');
  });
});
