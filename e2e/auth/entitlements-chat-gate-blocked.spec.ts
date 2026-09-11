import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsUser } from '../helpers/auth';

// Split out of entitlements.gating.spec.ts (PR #235 triage). Previously
// excluded from CI wiring on the belief that an unentitled user's
// /api/aria/chat request returned 422 instead of 403 NOT_ENTITLED. That was
// a false positive from an incomplete local reproduction environment
// (missing E2E_DISPOSABLE_STACK=1 on the app server, which
// isDisposableAriaRagIdentityConfigured() requires for the course's chat
// capability to resolve at all) — not a real defect in
// app/api/aria/chat/route.ts. Re-verified against a real disposable stack
// mirroring CI's e2e-auth job exactly: passes cleanly. Restored to normal
// collection.
test.describe('Feature gating / entitlements — ARIA chat', () => {
  test.describe.configure({ retries: 0 });

  test('ARIA sans entitlement de cours -> erreur publique canonique 403', async ({ page }) => {
    await loginAsUser(page, 'ariaNotEntitled');

    const res = await page.request.post('/api/aria/chat', {
      data: {
        clientRequestId: randomUUID(),
        courseKey: 'eds-nsi-premiere',
        content: 'Test',
      },
      headers: { accept: 'application/json' },
      failOnStatusCode: false,
    });

    expect(res.status()).toBe(403);
    expect(await res.json()).toMatchObject({
      error: { code: 'NOT_ENTITLED', retryable: false },
    });
  });
});
