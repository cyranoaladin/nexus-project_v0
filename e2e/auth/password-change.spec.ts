import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '../../core-v2/generated/client';
import { assertCoreV2E2eSeedTarget } from '../../scripts/core-v2/e2e-seed-target';
import { gotoSignInForm } from '../helpers/auth';
import { resetDisposableE2ERateLimits } from '../helpers/rate-limit';
import { verifyHouseholdParent } from '../../lib/core-v2/services/household-verification';
import { createServiceContext } from '../../lib/core-v2/services/context';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const OLD = 'change_me_current_e2e';
const NEW = 'change_me_replacement_e2e';

async function signIn(page: Page, email: string, password: string) {
  await gotoSignInForm(page);
  await page.getByRole('textbox', { name: 'Téléphone WhatsApp ou email', exact: true }).fill(email);
  await page.getByLabel(/^mot de passe$/i).fill(password);
  await page.getByRole('button', { name: /accéder à mon espace/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/parent(?:\?|$)/);
}

for (const width of [390, 1440]) {
test(`parent changes their password and revokes both old sessions at ${width}px`, async ({ browser }, testInfo) => {
  assertCoreV2E2eSeedTarget(process.env);
  await resetDisposableE2ERateLimits();
  const client = new PrismaClient({ datasources: { db: { url: process.env.CORE_V2_DATABASE_URL } } });
  const email = `password-change-${randomUUID()}@synthetic.test`;
  const baseURL = process.env.BASE_URL ?? 'http://localhost:3002';
  const { userAgent, isMobile, hasTouch, deviceScaleFactor } = testInfo.project.use;
  const deviceProfile = { userAgent, isMobile, hasTouch, deviceScaleFactor };
  const first = await browser.newContext({ ...deviceProfile, baseURL, viewport: { width, height: 900 } });
  const second = await browser.newContext({ ...deviceProfile, baseURL });
  try {
    const household = await client.household.create({ data: {} });
    const user = await client.user.create({ data: {
      email, role: 'PARENT', accountStatus: 'ACTIVE', firstName: 'Parent', lastName: 'Synthétique',
      password: await bcrypt.hash(OLD, 12), activatedAt: new Date(),
      householdParent: { create: { householdId: household.id, isPrimaryContact: true } },
    } });
    const verifier = await client.user.create({ data: { role: 'ADMIN', accountStatus: 'ACTIVE' } });
    await verifyHouseholdParent(client, createServiceContext({ userId: verifier.id, role: 'ADMIN' }), {
      householdId: household.id, parentUserId: user.id, expectedRevision: 0, evidenceDigest: 'a'.repeat(64),
    });
    const page = await first.newPage();
    if (userAgent) expect(await page.evaluate(() => navigator.userAgent)).toBe(userAgent);
    if (hasTouch) expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
    const other = await second.newPage();
    await signIn(page, email, OLD);
    await signIn(other, email, OLD);
    await page.getByRole('link', { name: 'Sécurité du compte', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Sécurité de mon compte' })).toBeVisible();
    const accessibility = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(accessibility.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByLabel('Mot de passe actuel', { exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Nouveau mot de passe', { exact: true })).toBeFocused();
    await page.getByLabel('Mot de passe actuel', { exact: true }).fill(OLD);
    await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(NEW);
    await page.getByLabel('Confirmer le nouveau mot de passe', { exact: true }).fill(NEW);
    const changed = page.waitForResponse(response => response.url().endsWith('/api/v2/auth/password-change') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Changer mon mot de passe' }).click();
    expect((await changed).status()).toBe(200);
    await expect(page).toHaveURL(/\/auth\/signin(?:\?|$)/);
    expect((await other.request.get('/api/v2/parent/household')).status()).toBe(401);
    const after = await client.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.sessionVersion).toBe(user.sessionVersion + 1);
    expect(await bcrypt.compare(OLD, after.password as string)).toBe(false);
    expect(await bcrypt.compare(NEW, after.password as string)).toBe(true);
    expect(await client.auditEvent.count({ where: { subjectId: user.id, action: 'account.password_changed' } })).toBe(1);
    await signIn(page, email, NEW);
    expect((await page.request.get('/api/v2/parent/household')).status()).toBe(200);
  } finally {
    await first.close(); await second.close(); await client.$disconnect();
  }
});
}
