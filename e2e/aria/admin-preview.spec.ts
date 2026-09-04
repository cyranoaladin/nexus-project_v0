import { test, expect, type Page } from '@playwright/test';
import { loginAsUser, type UserType } from '../helpers/auth';
import { listCourses, getMaxSpecialties, listCoursesFor } from '@/lib/curriculum/catalog';
import { buildCoverageMatrix } from '@/lib/aria-preview/coverage-matrix';

const PREVIEW_PATH = '/dashboard/admin/aria-preview';

function isOnPreviewPage(page: Page): boolean {
  return page.url().includes('/aria-preview');
}

test.describe('ARIA Preview (admin-only) — RBAC', () => {
  test('ADMIN access → PASS', async ({ page }) => {
    await loginAsUser(page, 'admin');
    await page.goto(PREVIEW_PATH, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('aria-preview-root')).toBeVisible();
    expect(isOnPreviewPage(page)).toBe(true);
  });

  for (const role of ['assistante', 'parent', 'student', 'coach'] as UserType[]) {
    test(`${role} → REFUSED`, async ({ page }) => {
      await loginAsUser(page, role);
      await page.goto(PREVIEW_PATH, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      expect(isOnPreviewPage(page)).toBe(false);
    });
  }

  test('anonymous → REFUSED', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(PREVIEW_PATH, { waitUntil: 'domcontentloaded' });
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

    await page.goto(PREVIEW_PATH, { waitUntil: 'domcontentloaded' });
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
    await page.goto(PREVIEW_PATH, { waitUntil: 'domcontentloaded' });
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

  test('shows NSI Terminale as grounded-required-in-qualification with the real canonical RAG volumetry', async ({ page }) => {
    await page.goto(PREVIEW_PATH, { waitUntil: 'domcontentloaded' });
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
    await page.goto(PREVIEW_PATH, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('tab-carte-scolaire').click();
    await expect(page.getByTestId('coverage-matrix-table')).toBeVisible();

    const expectedRows = buildCoverageMatrix();
    const renderedRowCount = await page.locator('[data-testid="coverage-matrix-table"] tbody tr').count();
    expect(renderedRowCount).toBe(expectedRows.length);

    await page.screenshot({ path: 'e2e/screenshots/ARIA_PREVIEW_CARTE_SCOLAIRE.png', fullPage: true });
  });

  test('desktop screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PREVIEW_PATH, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('aria-preview-root')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/ARIA_PREVIEW_DESKTOP.png', fullPage: true });
  });

  test('mobile viewport renders without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PREVIEW_PATH, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('aria-preview-root')).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    await page.screenshot({ path: 'e2e/screenshots/ARIA_PREVIEW_MOBILE.png', fullPage: true });
  });
});
