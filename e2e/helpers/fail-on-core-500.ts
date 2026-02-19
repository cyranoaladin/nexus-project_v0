import { Page } from '@playwright/test';

/**
 * Core API endpoints where a 500 response must fail the test immediately.
 * Non-core 5xx (favicon, static assets, auth probes) are logged but tolerated.
 */
const CORE_API_PATTERNS = [
  '/api/sessions/book',
  '/api/sessions/cancel',
  '/api/parent/',
  '/api/coach/',
  '/api/student/credits',
  '/api/student/sessions',
  '/api/admin/users',
];

/**
 * Attach a response listener that fails the test if any core API endpoint
 * returns a 5xx status. Non-core 5xx are logged as warnings.
 *
 * Usage in beforeEach:
 *   import { attachCoreApiGuard } from './helpers/fail-on-core-500';
 *   test.beforeEach(async ({ page }) => { attachCoreApiGuard(page); });
 */
export function attachCoreApiGuard(page: Page): void {
  page.on('response', (response) => {
    const url = response.url();
    if (!url.includes('/api/')) return;
    if (response.status() < 500) return;

    // Skip if the test has deliberately suppressed the guard (e.g. mocking a 500)
    if ((page as any).__core500Suppressed) return;

    const isCore = CORE_API_PATTERNS.some((pattern) => url.includes(pattern));

    if (isCore) {
      // Capture body asynchronously — Playwright may have already disposed the response,
      // so we catch and provide a fallback.
      response
        .text()
        .catch(() => '<body unavailable>')
        .then((body) => {
          const msg = `[CORE 500 GUARD] ${response.status()} on ${url}\n${body.slice(0, 500)}`;
          console.error(msg);
          // Throw inside the listener does NOT fail the test directly in Playwright.
          // Instead, we store the error on the page object for assertion in afterEach.
          (page as any).__core500Error = msg;
        });
    } else {
      console.warn(`[Non-core 5xx] ${response.status()} ${url}`);
    }
  });
}

/**
 * Call in afterEach to assert no core 500 was captured during the test.
 * Throws (fails the test) if a core endpoint returned 5xx.
 *
 * Usage:
 *   test.afterEach(async ({ page }) => { assertNoCoreApiFailure(page); });
 */
export function assertNoCoreApiFailure(page: Page): void {
  // Reset suppression flag for next test
  (page as any).__core500Suppressed = false;

  const error = (page as any).__core500Error;
  if (error) {
    (page as any).__core500Error = undefined;
    throw new Error(error);
  }
}

/**
 * Suppress the core-500 guard for the current test. Call this BEFORE
 * deliberately mocking a 500 on a core endpoint (e.g. error handling tests).
 *
 * @example
 * ```ts
 * suppressCoreGuard(page);
 * await page.route('** /api/parent/dashboard**', route => route.fulfill({ status: 500 }));
 * ```
 */
export function suppressCoreGuard(page: Page): void {
  (page as any).__core500Suppressed = true;
}
