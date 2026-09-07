import { test, expect, type Page } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

/**
 * Task 16 (docs/superpowers/plans/2026-09-06-core-family-academic-planning.md,
 * CORE_GO_LIVE_GATE.md) — browser-level proof that CORE's critical paths
 * (family/academic/planning/dashboard overhaul, Tasks 1-15) render and
 * function correctly while making ZERO network requests to any RAG-related
 * host or path, and without reintroducing a `/search` HTTP fallback (out of
 * scope per CORE_GO_LIVE_GATE.md — RAG stays an independently-gated,
 * separately-shipped feature).
 *
 * This is the browser-level counterpart to
 * `__tests__/architecture/core-rag-independence.test.ts` (module-level
 * proof): here we assert the same claim against real rendered pages, using
 * the same request-tracking convention as
 * `e2e/auth/admin-aria-preview.spec.ts`'s
 * "renders ... never calls model/RAG/DB" test.
 *
 * Two roles are exercised: ELEVE (`/dashboard/eleve` embeds
 * `<AriaChatLauncher>` inline — the one CORE dashboard page with a RAG-
 * adjacent widget in its critical path, see `components/aria/AriaChatLauncher.tsx`)
 * and ASSISTANTE (dashboard, planning, and the student roster — the staff
 * surfaces built across Tasks 4-14). Neither role's RAG env is under test
 * here (the running E2E server's own env is out of this spec's control —
 * see CORE_GO_LIVE_GATE.md's evidence entry for how RAG absence is verified
 * for this run); what this spec asserts unconditionally, regardless of
 * server-side RAG configuration, is that these CORE screens never issue a
 * browser-observable request to RAG infrastructure while rendering or while
 * the ARIA widget sits closed.
 */

const GENERIC_ERROR_BOUNDARY_TEXT = 'Une erreur est survenue';

/** Hosts/paths that would indicate a live RAG/model call escaped to the browser. */
const RAG_REQUEST_PATTERN = /rag|ingestor|aria-rag-engine/i;
/** PR #214's retired `/search` HTTP fallback must never resurface. */
const LEGACY_SEARCH_FALLBACK_PATTERN = /^\/search(?:$|\/|\?)/;

function trackForbiddenRequests(page: Page): string[] {
  const hits: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      RAG_REQUEST_PATTERN.test(url.hostname) ||
      RAG_REQUEST_PATTERN.test(url.pathname) ||
      LEGACY_SEARCH_FALLBACK_PATTERN.test(url.pathname)
    ) {
      hits.push(url.toString());
    }
  });
  return hits;
}

async function expectNoErrorBoundary(page: Page): Promise<void> {
  await expect(page.getByText(GENERIC_ERROR_BOUNDARY_TEXT)).toHaveCount(0);
}

test.describe('CORE critical paths render and function without RAG', () => {
  test('student dashboard renders, ARIA widget fails open (closed by default, no crash), zero RAG network calls', async ({ page }) => {
    const forbidden = trackForbiddenRequests(page);

    await loginAsUser(page, 'student');
    await page.waitForLoadState('networkidle');
    await expectNoErrorBoundary(page);

    // The embedded ARIA widget renders its launcher but never auto-opens or
    // auto-fetches on dashboard load — see components/aria/AriaChatLauncher.tsx.
    await expect(page.getByTestId('aria-chat-trigger')).toBeVisible();

    // Opening the panel must fail open (a friendly unavailable state) rather
    // than crash the page — components/aria/AriaChatPanel.tsx's
    // publicErrorLabel() maps RAG_UNAVAILABLE to a French message instead of
    // throwing. It must not reach any RAG host in the process.
    await page.getByTestId('aria-chat-trigger').click();
    await expect(page.getByRole('dialog', { name: 'Assistant pédagogique ARIA' })).toBeVisible();
    await page.waitForTimeout(500);
    await expectNoErrorBoundary(page);

    expect(forbidden).toEqual([]);
  });

  test('assistante dashboard, planning, and student roster render with zero RAG network calls', async ({ page }) => {
    const forbidden = trackForbiddenRequests(page);

    await loginAsUser(page, 'assistante');
    await page.waitForLoadState('networkidle');
    await expectNoErrorBoundary(page);

    await page.goto('/dashboard/assistante/planning', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Planning global' })).toBeVisible();
    await expectNoErrorBoundary(page);

    await page.goto('/dashboard/assistante/students', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    // The page header's <h1> and an inner card's <h2> share this text — scope
    // to the level-1 heading to avoid a strict-mode ambiguity.
    await expect(page.getByRole('heading', { name: 'Gestion des Élèves', level: 1 })).toBeVisible();
    await expectNoErrorBoundary(page);

    expect(forbidden).toEqual([]);
  });
});
