import { expect, test } from '@playwright/test';

import { loginAsUser } from '../helpers/auth';
import { CREDS } from '../helpers/credentials';
import { disconnectPrisma, getStudentId } from '../helpers/db';

test.describe('NPC RBAC Security', () => {
  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test('unauthenticated user cannot access NPC pages', async ({ page }) => {
    for (const url of ['/dashboard/coach/npc', '/dashboard/eleve/npc', '/dashboard/parent/npc']) {
      await page.goto(url);
      await expect(page).toHaveURL(/\/auth\/signin/);
    }
  });

  test('student cannot enumerate another student submissions', async ({ page }) => {
    const ownStudentId = await getStudentId(CREDS.student.email);
    const otherStudentId = await getStudentId(CREDS.student2.email);
    await loginAsUser(page, 'student');

    const response = await page.request.get(`/api/npc/submissions?studentId=${otherStudentId}`);
    expect(response.status()).toBe(200);
    const body = await response.json() as { submissions: Array<{ studentId: string }> };
    expect(body.submissions.length).toBeGreaterThan(0);
    expect(body.submissions.every((submission) => submission.studentId === ownStudentId)).toBe(true);
    expect(body.submissions.some((submission) => submission.studentId === otherStudentId)).toBe(false);
  });

  test('coach sees assigned students and not another coach student', async ({ page }) => {
    const assignedStudentId = await getStudentId(CREDS.student.email);
    const otherStudentId = await getStudentId(CREDS.student2.email);
    await loginAsUser(page, 'coach');

    const response = await page.request.get('/api/npc/submissions');
    expect(response.status()).toBe(200);
    const body = await response.json() as { submissions: Array<{ studentId: string }> };
    expect(body.submissions.some((submission) => submission.studentId === assignedStudentId)).toBe(true);
    expect(body.submissions.some((submission) => submission.studentId === otherStudentId)).toBe(false);

    await page.goto('/dashboard/coach/npc');
    await page.getByRole('button', { name: 'Nouvelle copie' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('button[role="combobox"]').first()).toContainText('Yasmine Dupont');
    await expect(dialog.getByText('Karim Dupont', { exact: true })).toHaveCount(0);
  });

  test('parent can only see their own children dashboard', async ({ page }) => {
    await loginAsUser(page, 'parent');
    await page.goto('/dashboard/parent/npc');
    await expect(page.getByRole('heading', { name: 'Diagnostics de mes enfants' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Tous les enfants/ })).toBeVisible();
  });

  test('assistante cannot enter the coach write surface', async ({ page }) => {
    await loginAsUser(page, 'assistante');
    await page.goto('/dashboard/coach/npc');
    await expect(page).toHaveURL(/\/dashboard\/assistante$/);
    await expect(page.getByRole('button', { name: 'Nouvelle copie' })).toHaveCount(0);
  });
});
