import AxeBuilder from '@axe-core/playwright';
import {
  devices,
  expect,
  test,
  type Browser,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { loginAsUser, logoutUser } from '../helpers/auth';
import { disconnectPrisma, resetAriaE2eConversations } from '../helpers/db';
import resourceRegistry from '../../data/aria/resources.v1.json';
import manifest from '../../data/aria/testing/rag/debbfb31c0a95e3e16ff33772f0626856e8dc01c52faab8270820b7f4374608a.json';
import { ARIA_E2E_SCENARIOS } from '../../scripts/e2e/aria-scenarios';
import {
  captureBrowserDiagnostics,
  captureBrowserFailures,
  chooseCourse,
  loginAndOpenAria,
  resetFixture,
  sendFromComposer,
} from './helpers';

const viewports = [
  { id: '390x844', width: 390, height: 844, mobile: true },
  { id: '768x1024', width: 768, height: 1024, mobile: true },
  { id: '1366x768', width: 1366, height: 768, mobile: false },
  { id: '1440x900', width: 1440, height: 900, mobile: false },
] as const;

const canonicalNsiPremiereResource = resourceRegistry.resources.find(
  ({ resourceId }) => resourceId === manifest.corpora
    .find(({ corpus_id }) => corpus_id === 'aria-nsi-premiere')!
    .resources[0]!.resource_id,
)!;

type VisualViewport = (typeof viewports)[number];

async function createViewportPage(browser: Browser, viewport: VisualViewport, testInfo: TestInfo) {
  const baseURL = String(testInfo.project.use.baseURL ?? process.env.BASE_URL ?? 'http://app-e2e:3000');
  const mobile = viewport.mobile ? devices['iPhone 13'] : {};
  const context = await browser.newContext({
    ...mobile,
    baseURL,
    viewport: { width: viewport.width, height: viewport.height },
    screen: { width: viewport.width, height: viewport.height },
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
  });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  return { context, page } as const;
}

async function assertQualifiedLayout(page: Page) {
  const metrics = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`ARIA_VISUAL_ELEMENT_MISSING:${selector}`);
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    return {
      viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
      scrollWidth: document.documentElement.scrollWidth,
      dialog: rect('[role="dialog"]'),
      main: rect('main[aria-label="Conversation ARIA"]'),
      footer: rect('[role="dialog"] footer'),
      composer: rect('textarea[aria-label="Message à ARIA"]'),
      course: rect('select[aria-label="Cours ARIA"]'),
      targets: [...document.querySelectorAll<HTMLElement>(
        '[role="dialog"] button, [role="dialog"] select, [role="dialog"] textarea, [role="dialog"] summary',
      )].filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      }).map((element) => {
        const box = element.getBoundingClientRect();
        return { tag: element.tagName, width: box.width, height: box.height };
      }),
    };
  });
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewport.width);
  expect(metrics.dialog.left).toBeGreaterThanOrEqual(-1);
  expect(metrics.dialog.top).toBeGreaterThanOrEqual(-1);
  expect(metrics.dialog.right).toBeLessThanOrEqual(metrics.viewport.width + 1);
  expect(metrics.dialog.bottom).toBeLessThanOrEqual(metrics.viewport.height + 1);
  expect(metrics.main.bottom).toBeLessThanOrEqual(metrics.footer.top + 1);
  expect(metrics.composer.bottom).toBeLessThanOrEqual(metrics.viewport.height + 1);
  expect(metrics.course.right).toBeLessThanOrEqual(metrics.viewport.width + 1);
  for (const target of metrics.targets) {
    expect(target.width, `${target.tag} touch width`).toBeGreaterThanOrEqual(44);
    expect(target.height, `${target.tag} touch height`).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByLabel('Message à ARIA')).toBeInViewport();
  await expect(page.getByLabel('Cours ARIA')).toBeInViewport();
}

async function captureState(page: Page, testInfo: TestInfo, viewport: VisualViewport, state: string) {
  await assertQualifiedLayout(page);
  await assertNoSeriousOrCriticalA11y(page);
  const screenshot = await page.screenshot({
    animations: 'disabled',
    scale: 'css',
  });
  await testInfo.attach(`aria-${viewport.id}-${state}`, {
    body: screenshot,
    contentType: 'image/png',
  });
}

async function qualifyVisualViewport(browser: Browser, viewport: VisualViewport, testInfo: TestInfo) {
  const { context, page } = await createViewportPage(browser, viewport, testInfo);
  const diagnostics = captureBrowserDiagnostics(page);
  try {
    await loginAndOpenAria(page, 'ariaNsi');
    await chooseCourse(page, 'eds-nsi-premiere');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Que souhaitez-vous travailler aujourd’hui ?')).toBeVisible();
    await captureState(page, testInfo, viewport, 'ready');

    await sendFromComposer(page, ARIA_E2E_SCENARIOS.cancelAfterFirstDelta);
    await expect(page.getByText('Une pile', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Arrêter la réponse ARIA' })).toBeVisible();
    await captureState(page, testInfo, viewport, 'streaming');
    await page.getByRole('button', { name: 'Arrêter la réponse ARIA' }).click();
    await expect(page.getByRole('status')).toHaveText('Réponse ARIA arrêtée.');
    await page.waitForLoadState('networkidle');

    await sendFromComposer(page, 'Question avec citation visible.');
    await expect(page.getByRole('status')).toHaveText('Réponse ARIA terminée.');
    const citationSummary = page.getByText('1 source').last();
    await expect(citationSummary).toBeVisible();
    await citationSummary.click();
    await expect(citationSummary.locator('..').getByText(canonicalNsiPremiereResource.title)).toBeVisible();
    await captureState(page, testInfo, viewport, 'citations-visible');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('aria-chat-trigger').click();
    await page.getByLabel('Cours ARIA').selectOption('eds-nsi-premiere');
    await expect(page.getByText('Question avec citation visible.')).toBeVisible();
    await captureState(page, testInfo, viewport, 'history-loaded');
    await page.waitForLoadState('networkidle');

    const useful = page.getByRole('button', { name: 'Réponse utile' }).last();
    await useful.click();
    await expect(useful).toHaveAttribute('aria-pressed', 'true');
    await captureState(page, testInfo, viewport, 'feedback-submitted');

    await sendFromComposer(page, ARIA_E2E_SCENARIOS.ragUnavailable);
    await expect(page.getByRole('dialog').getByRole('alert'))
      .toHaveText('Les sources pédagogiques sont temporairement indisponibles.');
    await captureState(page, testInfo, viewport, 'rag-unavailable');

    await sendFromComposer(page, ARIA_E2E_SCENARIOS.modelTimeout);
    await expect(page.getByRole('dialog').getByRole('alert'))
      .toHaveText('ARIA met trop de temps à répondre. Réessayez dans un instant.');
    await captureState(page, testInfo, viewport, 'timeout-error');
    await page.waitForLoadState('networkidle');

    await logoutUser(page);
    await loginAndOpenAria(page, 'ariaStmgNoChat');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('main', { name: 'Conversation ARIA' })
      .getByText('Aucun cours ARIA avec chat n’est disponible.')).toBeVisible();
    await captureState(page, testInfo, viewport, 'course-unavailable');
    expect(diagnostics.failures).toEqual([]);
    const expectedAborts = new Set([
      'requestfailed:POST:/api/aria/chat:net::ERR_ABORTED',
      'requestfailed:GET:/dashboard/trajectoire:net::ERR_ABORTED',
      'requestfailed:GET:/dashboard/eleve/nsi-pratique-2026:net::ERR_ABORTED',
      'requestfailed:GET:/dashboard/eleve/npc:net::ERR_ABORTED',
      'requestfailed:GET:/dashboard/eleve/documents:net::ERR_ABORTED',
      'requestfailed:GET:/bilan-gratuit/assessment:net::ERR_ABORTED',
    ]);
    expect(diagnostics.aborts.filter((abort) => !expectedAborts.has(abort))).toEqual([]);
  } finally {
    await context.close();
  }
}

async function assertNoSeriousOrCriticalA11y(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
}

test.describe.serial('ARIA-B visual and accessibility qualification', () => {
  test.afterAll(async () => disconnectPrisma());

  test.beforeEach(async ({ request, page }) => {
    await resetAriaE2eConversations();
    await resetFixture(request);
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('E018 ARIA_VISUAL_VIEWPORT_MATRIX @visual — 390x844 eight-state qualification', async ({ browser }, testInfo) => {
    await qualifyVisualViewport(browser, viewports[0], testInfo);
  });

  test('E019 ARIA_VISUAL_VIEWPORT_MATRIX @visual — 768x1024 eight-state qualification', async ({ browser }, testInfo) => {
    await qualifyVisualViewport(browser, viewports[1], testInfo);
  });

  test('E020 ARIA_VISUAL_VIEWPORT_MATRIX @visual — 1366x768 eight-state qualification', async ({ browser }, testInfo) => {
    await qualifyVisualViewport(browser, viewports[2], testInfo);
  });

  test('E021 ARIA_VISUAL_VIEWPORT_MATRIX @visual — 1440x900 eight-state qualification', async ({ browser }, testInfo) => {
    await qualifyVisualViewport(browser, viewports[3], testInfo);
  });

  test('E022 ARIA_A11Y_MATRIX @a11y — axe, keyboard loop, mobile Enter, live status and restoration', async ({ page }) => {
    await loginAsUser(page, 'ariaNsi');
    const trigger = page.getByTestId('aria-chat-trigger');
    await trigger.focus();
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Assistant pédagogique ARIA' });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(page.getByLabel('Cours ARIA')).toBeFocused();
    await page.waitForLoadState('networkidle');
    await assertNoSeriousOrCriticalA11y(page);

    const focusables = dialog.locator(
      'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    );
    await focusables.first().focus();
    await page.keyboard.press('Shift+Tab');
    await expect(focusables.last()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(focusables.first()).toBeFocused();

    await chooseCourse(page, 'eds-nsi-premiere');
    await expect(page.getByLabel('Message à ARIA')).toHaveAccessibleName('Message à ARIA');
    await page.evaluate(() => {
      const status = document.querySelector('[role="status"]');
      if (!status) throw new Error('ARIA_A11Y_STATUS_MISSING');
      const state = window as Window & { __ariaAnnouncements?: string[] };
      state.__ariaAnnouncements = [status.textContent?.trim() ?? ''];
      new MutationObserver(() => {
        state.__ariaAnnouncements?.push(status.textContent?.trim() ?? '');
      }).observe(status, { childList: true, characterData: true, subtree: true });
    });

    await sendFromComposer(page, ARIA_E2E_SCENARIOS.cancelAfterFirstDelta);
    const stop = page.getByRole('button', { name: 'Arrêter la réponse ARIA' });
    await expect(stop).toHaveAccessibleName('Arrêter la réponse ARIA');
    await expect(page.getByText('Une pile', { exact: false })).toBeVisible();
    await stop.click();
    await expect(page.getByRole('status')).toHaveText('Réponse ARIA arrêtée.');
    await assertNoSeriousOrCriticalA11y(page);
    await page.waitForLoadState('networkidle');
    const failures = captureBrowserFailures(page);

    await page.setViewportSize({ width: 390, height: 844 });
    const composer = page.getByLabel('Message à ARIA');
    await composer.fill('Qualification mobile avec citation.');
    await composer.press('Enter');
    await expect(page.getByRole('status')).toHaveText('Réponse ARIA terminée.');
    const citationSummary = page.getByText('1 source').last();
    await citationSummary.focus();
    await expect(citationSummary).toBeFocused();
    await citationSummary.press('Enter');
    await expect(citationSummary.locator('..').getByText('Programme officiel de NSI ARIA E2E')).toBeVisible();
    await assertNoSeriousOrCriticalA11y(page);

    await sendFromComposer(page, ARIA_E2E_SCENARIOS.ragUnavailable);
    await expect(dialog.getByRole('alert'))
      .toHaveText('Les sources pédagogiques sont temporairement indisponibles.');
    await expect(page.getByRole('status')).toHaveText('La réponse ARIA a échoué.');
    await assertNoSeriousOrCriticalA11y(page);
    await page.waitForLoadState('networkidle');
    expect(failures).toEqual([]);

    const announcements = await page.evaluate(() =>
      (window as Window & { __ariaAnnouncements?: string[] }).__ariaAnnouncements ?? []);
    expect(announcements.filter(Boolean).length).toBeLessThanOrEqual(12);
    expect(announcements.some((value) => value === 'ARIA répond.')).toBe(true);
    expect(announcements.some((value) => value === 'Réponse ARIA arrêtée.')).toBe(true);
    expect(announcements.some((value) => value === 'La réponse ARIA a échoué.')).toBe(true);
    expect(announcements.some((value, index) => index > 0 && value === announcements[index - 1])).toBe(false);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(failures).toEqual([]);

    await logoutUser(page);
    await loginAndOpenAria(page, 'ariaStmgNoChat');
    await page.waitForLoadState('networkidle');
    const noChatFailures = captureBrowserFailures(page);
    await expect(page.getByRole('main', { name: 'Conversation ARIA' })
      .getByText('Aucun cours ARIA avec chat n’est disponible.')).toBeVisible();
    await assertNoSeriousOrCriticalA11y(page);
    expect(noChatFailures).toEqual([]);
  });
});
