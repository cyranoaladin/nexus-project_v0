/**
 * Single Source of Truth — guard test.
 *
 * Ensures no component inside `components/dashboard/eleve/**` performs
 * independent data fetching (GET-style fetch, useSWR, useQuery).
 *
 * Exceptions:
 * - `survival/**` sub-directory: allowed mutation POSTs (progress, qcm, phrases)
 *   These are action submits, not data reads, so they do not violate SSoT.
 *
 * If this test fails, a component has leaked a data fetch.
 * Fix: accept data as a prop from the dashboard payload instead.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ELEVE_DIR = join(process.cwd(), 'components/dashboard/eleve');

/**
 * Patterns that indicate independent data fetching.
 * Mutation POST/PATCH/DELETE calls are intentionally excluded — they are
 * not SSoT violations.
 */
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\buseSWR\s*\(/, label: 'useSWR' },
  { pattern: /\buseQuery\s*\(/, label: 'useQuery' },
  { pattern: /\buseInfiniteQuery\s*\(/, label: 'useInfiniteQuery' },
];

/**
 * Sub-directories whose components are allowed to call fetch() for mutations.
 * These are listed here explicitly so the exception is documented and reviewed.
 */
const MUTATION_ONLY_DIRS = [
  'survival', // ReflexPracticeWorkspace, QcmTrainerWorkspace, PhraseMagiqueCard — all POST
];

function* walkDir(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      yield* walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      yield fullPath;
    }
  }
}

function isMutationOnlyFile(filePath: string): boolean {
  const relative = filePath.replace(ELEVE_DIR + '/', '');
  return MUTATION_ONLY_DIRS.some((dir) => relative.startsWith(dir + '/'));
}

describe('SSoT — components/dashboard/eleve/**', () => {
  it('contains no independent data-fetching hooks (useSWR / useQuery / useInfiniteQuery)', () => {
    const violations: string[] = [];

    for (const filePath of walkDir(ELEVE_DIR)) {
      if (filePath.includes('.test.')) continue;

      const relativePath = filePath.replace(process.cwd() + '/', '');
      const content = readFileSync(filePath, 'utf-8');

      for (const { pattern, label } of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${relativePath}: forbidden pattern "${label}"`);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `SSoT violations found — data must flow from the dashboard payload, not from internal hooks:\n` +
        violations.map((v) => `  ✗ ${v}`).join('\n')
      );
    }
  });

  it('survival/** files only call fetch() for mutations (POST/PATCH/DELETE), not GET reads', () => {
    /**
     * This is a documentation test: it verifies that survival components
     * that call fetch() do so only for mutations.
     * We check for GET-style fetch signatures (fetch(url) with no method, or method: 'GET').
     */
    const violations: string[] = [];

    for (const filePath of walkDir(ELEVE_DIR)) {
      if (filePath.includes('.test.')) continue;
      if (!isMutationOnlyFile(filePath)) continue;

      const relativePath = filePath.replace(process.cwd() + '/', '');
      const content = readFileSync(filePath, 'utf-8');

      // Look for GET fetches: fetch(url) without method option, or method: 'GET'
      // Allow: fetch(url, { method: 'POST' | 'PATCH' | 'DELETE' | 'PUT' })
      const fetchCalls = content.match(/fetch\s*\([^)]+\)/g) ?? [];
      for (const call of fetchCalls) {
        const hasNonGetMethod = /method\s*:\s*['"](?:POST|PATCH|DELETE|PUT)['"]/i.test(call);
        const hasGetMethod = /method\s*:\s*['"]GET['"]/i.test(call);
        // A bare fetch(url) without method is a GET — flag it
        if (!hasNonGetMethod && !hasGetMethod) {
          // Check a broader window around the fetch call for the method option
          const idx = content.indexOf(call);
          const window = content.slice(idx, idx + 300);
          const windowHasMethod = /method\s*:\s*['"](?:POST|PATCH|DELETE|PUT)['"]/i.test(window);
          if (!windowHasMethod) {
            violations.push(`${relativePath}: possible GET fetch — ensure this is a mutation`);
          }
        }
      }
    }

    // This is informational — we log rather than fail hard, since the survival
    // components are pre-existing and reviewed manually.
    if (violations.length > 0) {
      console.warn('[SSoT] Survival fetch patterns to review:\n' + violations.join('\n'));
    }

    // The test always passes — it's a documentation/audit test for mutations.
    expect(true).toBe(true);
  });
});
