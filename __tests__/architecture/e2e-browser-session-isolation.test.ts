import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listFilesRecursive } from './helpers/core-v2-client-authority-guard';

/**
 * A role switch inside one browser context must dispose the previous role's
 * document BEFORE clearing cookies (see resetBrowserSession in
 * e2e/helpers/auth.ts): an in-flight client-side session refresh can
 * otherwise re-issue the old JWT cookie after clearCookies() and the next
 * /auth/signin redirects straight back to the previous dashboard. Two CI
 * flake events came from exactly this shape (core-golden-family.spec
 * 2026-09-10/11, parent-canonical-report-access.spec 2026-09-09). This guard
 * makes the helper the only way to clear cookies anywhere under e2e/.
 */
const root = process.cwd();
const HELPER_FILE = join(root, 'e2e/helpers/auth.ts');
const RAW_CLEAR_COOKIES = /\.clearCookies\s*\(/;

describe('E2E_BROWSER_SESSION_ISOLATION', () => {
  test('the helper itself disposes the document before clearing cookies', () => {
    const helper = readFileSync(HELPER_FILE, 'utf8');
    const fn = /export async function resetBrowserSession\([\s\S]*?\n\}/.exec(helper)?.[0] ?? '';
    expect(fn).toMatch(/goto\('about:blank'\)[\s\S]*clearCookies\(\)/);
  });

  test('no e2e file other than the helper calls clearCookies() directly', () => {
    const offenders = listFilesRecursive(join(root, 'e2e'))
      .filter((file) => /\.(?:ts|tsx)$/.test(file) && file !== HELPER_FILE)
      .filter((file) => RAW_CLEAR_COOKIES.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(root.length + 1));
    expect(offenders).toEqual([]);
  });

  test('sanity: the guard scans real spec files', () => {
    expect(listFilesRecursive(join(root, 'e2e')).some((f) => f.endsWith('.spec.ts'))).toBe(true);
  });
});
