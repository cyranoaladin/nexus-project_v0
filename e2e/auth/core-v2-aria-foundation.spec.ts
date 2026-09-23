import { expect, test } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

const CORE_V2_STUDENT = 'coreV2AriaFoundation' as const;
const PINNED_COURSE_KEY = 'maths-terminale-eds';
const UNAVAILABLE_COPY = 'Fonction non encore disponible pour ce profil';

const FORBIDDEN_CORE_V2_PATHS = [
  /^\/api\/aria\/chat\/?$/,
  /^\/api\/aria\/conversations(?:\/.*)?$/,
  /^\/api\/aria\/turns(?:\/.*)?$/,
  /^\/api\/aria\/feedback\/?$/,
] as const;

function pathname(rawUrl: string): string {
  return new URL(rawUrl).pathname;
}

test.describe.serial('Core v2 ARIA foundation', () => {
  test('uses only the native foundation, persists onboarding, and exposes no legacy chat', async ({ page }) => {
    const requestedPaths: string[] = [];
    page.on('request', (request) => requestedPaths.push(pathname(request.url())));

    await loginAsUser(page, CORE_V2_STUDENT, { navigate: false });
    const sessionResponse = await page.request.get('/api/auth/session');
    expect(sessionResponse.status()).toBe(200);
    const session = (await sessionResponse.json()) as {
      user?: { role?: string; authority?: string };
    };
    expect(session.user).toMatchObject({ role: 'ELEVE', authority: 'CORE_V2' });

    await page.goto('/dashboard/eleve/aria', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('aria-setup-wizard')).toBeVisible();
    await expect(page.getByText('TERMINALE', { exact: true })).toBeVisible();
    await expect(page.getByText('EDS_GENERALE', { exact: true })).toBeVisible();
    await expect(page.getByText('MATHEMATIQUES', { exact: true })).toBeVisible();
    await expect(page.getByText('Lycée Pierre-Mendès-France', { exact: true })).toBeVisible();

    await page.getByTestId('aria-wizard-next').click();
    await page.getByTestId('aria-wizard-next').click();
    const permittedCourse = page.getByTestId(`aria-wizard-course-${PINNED_COURSE_KEY}`);
    await expect(permittedCourse).toBeEnabled();
    await permittedCourse.click();
    await page.getByTestId('aria-wizard-next').click();
    await page.getByTestId('aria-wizard-next').click();
    await page.getByTestId('aria-wizard-submit').click();

    await expect(page.getByRole('heading', { name: 'Cockpit ARIA' })).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Cockpit ARIA' })).toBeVisible();
    await page.getByTestId('aria-nav-CURRICULUM').click();
    await expect(page.getByTestId(`aria-course-card-${PINNED_COURSE_KEY}`)).toHaveClass(/border-brand-accent\/50/);

    for (const panel of ['TODAY', 'TRAJECTORY', 'RESOURCES', 'ASSESSMENTS', 'ARIA'] as const) {
      await page.getByTestId(`aria-nav-${panel}`).click();
      await expect(page.getByText(UNAVAILABLE_COPY).first()).toBeVisible();
    }
    await expect(page.getByTestId('aria-chat-trigger')).toHaveCount(0);
    await expect(page.getByText('Démarrer une conversation')).toHaveCount(0);

    expect(requestedPaths).toContain('/api/v2/aria/cockpit');
    expect(requestedPaths).toContain('/api/v2/aria/cockpit/profile');
    expect(requestedPaths).not.toContain('/api/aria/cockpit');
    expect(requestedPaths).not.toContain('/api/aria/cockpit/profile');
    expect(requestedPaths.filter((path) => path.startsWith('/api/aria/'))).toEqual([]);
    expect(
      requestedPaths.filter((path) => FORBIDDEN_CORE_V2_PATHS.some((pattern) => pattern.test(path))),
    ).toEqual([]);
  });

  test('keeps the V1 launcher and conversation surface available', async ({ page }) => {
    await loginAsUser(page, 'ariaTerminaleMaths', { targetPath: '/dashboard/eleve/aria' });

    const trigger = page.getByTestId('aria-chat-trigger');
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByRole('main', { name: 'Conversation ARIA' })).toBeVisible();
  });
});
