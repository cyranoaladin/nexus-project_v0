import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { isAllowedSeedTarget } from '../../lib/e2e/seed-guard';
import { gotoSignInForm } from '../helpers/auth';
import { resetDisposableE2ERateLimits } from '../helpers/rate-limit';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const OLD = 'change_me_current_v1_e2e';
const NEW = 'change_me_replacement_v1_e2e';

async function signIn(page: Page, email: string, password: string) {
  await gotoSignInForm(page);
  await page.getByRole('textbox', { name: 'Téléphone WhatsApp ou email', exact: true }).fill(email);
  await page.getByLabel(/^mot de passe$/i).fill(password);
  await page.getByRole('button', { name: /accéder à mon espace/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/parent(?:\?|$)/);
}

for (const width of [390, 1440]) {
test(`V1 parent changes their password and revokes two sessions at ${width}px`, async ({ browser }, testInfo) => {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.E2E_DISPOSABLE_STACK !== '1' || !isAllowedSeedTarget(url).ok) {
    throw new Error('V1_PASSWORD_E2E_REQUIRES_DISPOSABLE_STACK');
  }
  await resetDisposableE2ERateLimits();
  const client = new PrismaClient({ datasources: { db: { url } } });
  const baseURL = process.env.BASE_URL ?? 'http://localhost:3002';
  const { userAgent, isMobile, hasTouch, deviceScaleFactor } = testInfo.project.use;
  const deviceProfile = { userAgent, isMobile, hasTouch, deviceScaleFactor };
  const first = await browser.newContext({ ...deviceProfile, baseURL, viewport: { width, height: 900 } });
  const second = await browser.newContext({ ...deviceProfile, baseURL });
  try {
    const email = `password-v1-${randomUUID()}@example.test`;
    const user = await client.user.create({ data: {
      email, role: 'PARENT', firstName: 'Parent', lastName: 'Synthétique',
      password: await bcrypt.hash(OLD, 12), activatedAt: new Date(),
      parentProfile: { create: {} },
    } });
    const page = await first.newPage();
    if (userAgent) expect(await page.evaluate(() => navigator.userAgent)).toBe(userAgent);
    if (hasTouch) expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
    const other = await second.newPage();
    await signIn(page, email, OLD);
    await signIn(other, email, OLD);
    await page.getByRole('link', { name: 'Sécurité du compte', exact: true }).click();
    await expect(page.getByLabel('Mot de passe actuel', { exact: true })).toBeVisible();
    const accessibility = await new AxeBuilder({ page }).include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(accessibility.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByLabel('Mot de passe actuel', { exact: true }).fill(OLD);
    await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(NEW);
    await page.getByLabel('Confirmer le nouveau mot de passe', { exact: true }).fill(NEW);
    const changed = page.waitForResponse(response => response.url().endsWith('/api/auth/password-change')
      && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Changer mon mot de passe' }).click();
    expect((await changed).status()).toBe(200);
    await expect(page).toHaveURL(/\/auth\/signin(?:\?|$)/);
    expect((await other.request.get('/api/parent/children')).status()).toBe(401);
    const after = await client.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.sessionVersion).toBe(user.sessionVersion + 1);
    expect(await bcrypt.compare(OLD, after.password!)).toBe(false);
    expect(await bcrypt.compare(NEW, after.password!)).toBe(true);
    expect(await client.accountSecurityEvent.count({ where: { userId: user.id } })).toBe(1);
    await signIn(page, email, NEW);
    expect((await page.request.get('/api/parent/children')).status()).toBe(200);
  } finally {
    await first.close(); await second.close(); await client.$disconnect();
  }
});
}
