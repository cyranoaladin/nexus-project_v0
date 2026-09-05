import { test, expect, type Page } from '@playwright/test';
import { loginAsUser, type UserType } from '../helpers/auth';
import { listCourses, getMaxSpecialties, listCoursesFor } from '@/lib/curriculum/catalog';

// Intentionally NOT importing @/lib/aria-preview/coverage-matrix (or
// capability-status) here: that chain reaches lib/aria/curriculum/skill-graph.ts,
// which has a top-level `import 'server-only'`. That guard always throws when
// loaded outside Next's bundler — including in a plain Playwright/Node spec
// file — regardless of any client/server component distinction. Expected
// values below are derived from @/lib/curriculum/catalog only, which has no
// such dependency.
function expectedCoverageRowCount(): number {
  const pairs = new Set<string>();
  for (const course of listCourses()) {
    for (const track of course.tracks) pairs.add(`${course.gradeLevel}|${track}`);
  }
  return pairs.size;
}

const PREVIEW_PATH = '/dashboard/admin/aria-preview';

function isOnPreviewPage(page: Page): boolean {
  return page.url().includes('/aria-preview');
}

/**
 * Navigate to the preview and wait past `networkidle`, not just
 * `domcontentloaded`: on a cold server (first hit to a brand-new route right
 * after startup), asserting on a testid immediately after
 * `domcontentloaded` can race a transient double-mount during React's
 * streaming hydration, which Playwright's strict-mode locator check reports
 * as "resolved to 2 elements" instead of retrying. Letting the page settle
 * first avoids that without weakening the assertion itself.
 */
async function gotoPreview(page: Page): Promise<void> {
  await page.goto(PREVIEW_PATH, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
}

test.describe('ARIA Preview (admin-only) — RBAC', () => {
  test('ADMIN access → PASS', async ({ page }) => {
    await loginAsUser(page, 'admin');
    await gotoPreview(page);
    await expect(page.getByTestId('aria-preview-root')).toBeVisible();
    expect(isOnPreviewPage(page)).toBe(true);
  });

  for (const role of ['assistante', 'parent', 'student', 'coach'] as UserType[]) {
    test(`${role} → REFUSED`, async ({ page }) => {
      await loginAsUser(page, role);
      await gotoPreview(page);
      await page.waitForLoadState('domcontentloaded');
      expect(isOnPreviewPage(page)).toBe(false);
    });
  }

  test('anonymous → REFUSED', async ({ page }) => {
    await page.context().clearCookies();
    await gotoPreview(page);
    await page.waitForLoadState('domcontentloaded');
    expect(isOnPreviewPage(page)).toBe(false);
  });
});

test.describe('ARIA Preview (admin-only) — content and safety', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'admin');
  });

  test('renders every canonical course across the catalog, no duplicate courseKey, and never calls model/RAG/DB', async ({ page }) => {
    const requestsToForbiddenPaths: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (/^\/api\/aria/.test(url.pathname) || /rag/i.test(url.pathname)) {
        requestsToForbiddenPaths.push(url.pathname);
      }
    });

    await gotoPreview(page);
    await expect(page.getByTestId('aria-preview-root')).toBeVisible();

    const seenCourseKeys = new Set<string>();
    for (const gradeLevel of new Set(listCourses().map((c) => c.gradeLevel))) {
      await page.getByTestId(`grade-level-${gradeLevel}`).click();
      const tracks = new Set(listCourses().filter((c) => c.gradeLevel === gradeLevel).flatMap((c) => c.tracks));
      for (const track of tracks) {
        await page.getByTestId(`track-${track}`).click();
        for (const course of listCoursesFor({ gradeLevel, track })) {
          await expect(page.getByTestId(`course-${course.courseKey}`)).toBeVisible();
          seenCourseKeys.add(course.courseKey);
        }
      }
    }

    expect(seenCourseKeys.size).toBe(listCourses().length);
    expect(requestsToForbiddenPaths).toEqual([]);
  });

  test('simulates a specialty selection using the real specialtyRules limit, not a hardcoded one', async ({ page }) => {
    await gotoPreview(page);
    await page.getByTestId('grade-level-TERMINALE').click();
    await page.getByTestId('track-EDS_GENERALE').click();

    const specialties = listCoursesFor({ gradeLevel: 'TERMINALE', track: 'EDS_GENERALE', kind: 'SPECIALTY' });
    const maxSpecialties = getMaxSpecialties('TERMINALE');
    expect(maxSpecialties).not.toBeNull();

    for (const specialty of specialties.slice(0, maxSpecialties as number)) {
      await page.getByTestId(`specialty-checkbox-${specialty.courseKey}`).click();
    }

    await expect(page.getByTestId('specialty-count')).toContainText(
      `${maxSpecialties} / ${maxSpecialties} spécialités sélectionnées`,
    );

    if (specialties.length > (maxSpecialties as number)) {
      const extra = specialties[maxSpecialties as number];
      await page.getByTestId(`specialty-checkbox-${extra.courseKey}`).click();
      await expect(page.getByTestId('specialty-count')).toContainText('dépasse la règle en vigueur');
    }
  });

  test('resets the simulated specialty selection when changing grade level', async ({ page }) => {
    await gotoPreview(page);

    await page.getByTestId('grade-level-PREMIERE').click();
    await page.getByTestId('track-EDS_GENERALE').click();
    const premiereSpecialties = listCoursesFor({ gradeLevel: 'PREMIERE', track: 'EDS_GENERALE', kind: 'SPECIALTY' });
    for (const specialty of premiereSpecialties.slice(0, 3)) {
      await page.getByTestId(`specialty-checkbox-${specialty.courseKey}`).click();
    }
    await expect(page.getByTestId('specialty-count')).toContainText('3 / 3');

    await page.getByTestId('grade-level-TERMINALE').click();
    await page.getByTestId('track-EDS_GENERALE').click();
    await expect(page.getByTestId('specialty-count')).toContainText('0 / 2');
    for (const cb of await page.locator('[data-testid^="specialty-checkbox-"]').all()) {
      await expect(cb).not.toBeChecked();
    }

    const terminaleSpecialties = listCoursesFor({ gradeLevel: 'TERMINALE', track: 'EDS_GENERALE', kind: 'SPECIALTY' });
    await page.getByTestId(`specialty-checkbox-${terminaleSpecialties[0].courseKey}`).click();
    await page.getByTestId(`specialty-checkbox-${terminaleSpecialties[1].courseKey}`).click();
    await expect(page.getByTestId('specialty-count')).toContainText('2 / 2');

    await page.getByTestId('grade-level-PREMIERE').click();
    await page.getByTestId('track-EDS_GENERALE').click();
    await expect(page.getByTestId('specialty-count')).toContainText('0 / 3');
  });

  test('displays the canonical specialty-rule note from the catalog', async ({ page }) => {
    await gotoPreview(page);
    await page.getByTestId('grade-level-PREMIERE').click();
    await page.getByTestId('track-EDS_GENERALE').click();
    await expect(page.getByTestId('specialty-rule-note')).toContainText('abandonnée');
  });

  test('exposes the active grade/track/course selection to assistive technology', async ({ page }) => {
    await gotoPreview(page);
    await page.getByTestId('grade-level-TERMINALE').click();
    await expect(page.getByTestId('grade-level-TERMINALE')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('grade-level-PREMIERE')).toHaveAttribute('aria-pressed', 'false');

    await page.getByTestId('track-EDS_GENERALE').click();
    await expect(page.getByTestId('track-EDS_GENERALE')).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('course-eds-nsi-terminale').click();
    await expect(page.getByTestId('course-eds-nsi-terminale')).toHaveAttribute('aria-pressed', 'true');
  });

  test('associates each tab with a real tabpanel', async ({ page }) => {
    await gotoPreview(page);
    await expect(page.getByRole('tabpanel')).toBeVisible();
    await page.getByTestId('tab-carte-scolaire').click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
    await expect(page.getByTestId('coverage-matrix-table')).toBeVisible();
  });

  test('shows NSI Terminale as grounded-required-in-qualification with the real canonical RAG volumetry', async ({ page }) => {
    await gotoPreview(page);
    await page.getByTestId('grade-level-TERMINALE').click();
    await page.getByTestId('track-EDS_GENERALE').click();
    await page.getByTestId('course-eds-nsi-terminale').click();

    await expect(page.getByTestId('workspace-subtitle')).toContainText('NSI');
    await expect(page.getByTestId('aria-preview-send')).toBeDisabled();
    await expect(page.getByTestId('aria-preview-input')).toBeDisabled();
    await expect(page.getByTestId('rag-volumetry')).toContainText('47 ressources');
    await expect(page.getByTestId('rag-volumetry')).toContainText('904 chunks');

    await page.screenshot({ path: 'e2e/screenshots/ARIA_PREVIEW_TERMINALE_NSI.png', fullPage: true });
  });

  test('coverage matrix tab is computed from the catalog, not hardcoded', async ({ page }) => {
    await gotoPreview(page);
    await page.getByTestId('tab-carte-scolaire').click();
    await expect(page.getByTestId('coverage-matrix-table')).toBeVisible();

    const renderedRowCount = await page.locator('[data-testid="coverage-matrix-table"] tbody tr').count();
    expect(renderedRowCount).toBe(expectedCoverageRowCount());

    await page.screenshot({ path: 'e2e/screenshots/ARIA_PREVIEW_CARTE_SCOLAIRE.png', fullPage: true });
  });

  test('desktop screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoPreview(page);
    await expect(page.getByTestId('aria-preview-root')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/ARIA_PREVIEW_DESKTOP.png', fullPage: true });
  });

  test('mobile viewport renders without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoPreview(page);
    await expect(page.getByTestId('aria-preview-root')).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    await page.screenshot({ path: 'e2e/screenshots/ARIA_PREVIEW_MOBILE.png', fullPage: true });
  });
});
