/**
 * Fumée de PRODUCTION : changement autonome du code/mot de passe et réinitialisation par l'enseignant.
 * Écrit uniquement avec des comptes techniques de validation. Le vrai compte enseignant n'est utilisé qu'en
 * lecture : la page « Mon compte » s'affiche, le formulaire est visible, RIEN n'est soumis.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

function readCreds(env: string): Record<string, string> {
  const file = process.env[env];
  if (!file) throw new Error(`${env} est obligatoire`);
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [, username, secret] = line.split(';');
    if (!username || !secret) continue;
    const raw = secret.trim();
    // Code d'élève « ABCD-2345 » : le tiret est décoratif. Un mot de passe enseignant est conservé tel quel.
    out[username] = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(raw) ? raw.replace('-', '') : raw;
  }
  return out;
}

const creds = readCreds('ESPACE_VALIDATION_CREDENTIALS');
const STUDENT = process.env.ESPACE_CRED_STUDENT ?? 'val.h';
const STUDENT_RESET = process.env.ESPACE_CRED_STUDENT_RESET ?? 'val.i';
const TEACHER = process.env.ESPACE_TEACHER ?? 'val.prof2';
const tag = Date.now().toString(36);
const NEW_CODE = `Lune${tag.slice(-3)}Fox`.replace(/[^A-Za-z0-9]/g, 'x');
const SECOND_CODE = `Pomme${tag.slice(-3)}Kiwi`.replace(/[^A-Za-z0-9]/g, 'x');
// Mot de passe jetable généré à l'exécution (jamais écrit dans le dépôt) : 12 caractères au moins, hors valeurs triviales.
const NEW_PASSWORD = `${randomBytes(9).toString('hex')}-${tag}`;

let studentSecret = creds[STUDENT]!;
let teacherSecret = creds[TEACHER]!;

async function login(page: Page, username: string, secret: string) {
  await page.goto('/espace/connexion');
  await page.getByTestId('input-username').fill(username);
  await page.getByTestId('input-secret').fill(secret);
  await page.getByTestId('btn-connexion').click();
}

async function change(page: Page, current: string, next: string, confirm: string = next) {
  await page.getByTestId('input-current').fill(current);
  await page.getByTestId('input-next').fill(next);
  await page.getByTestId('input-confirm').fill(confirm);
  await page.getByTestId('btn-credential').click();
}

test.describe.configure({ mode: 'serial' });

test('anonyme : routes de changement et de réinitialisation fermées', async ({ request }) => {
  const a = await request.post('/api/espace/account/credential', { data: { current: 'x', next: 'y', confirm: 'y' } });
  expect([401, 403]).toContain(a.status());
  const b = await request.post('/api/espace/teacher/students/inconnu/reset-code', { data: {} });
  expect([401, 403]).toContain(b.status());
});

test('vrai compte enseignant : la page Mon compte / Sécurité est accessible, formulaire visible (rien n’est soumis)', async ({ page }) => {
  const file = process.env.ESPACE_TEACHER_FILE;
  if (!file) throw new Error('ESPACE_TEACHER_FILE est obligatoire');
  const text = readFileSync(file, 'utf8');
  const get = (k: string) => text.split('\n').find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1).trim() ?? '';
  await login(page, get('IDENTIFIANT'), get('MOT_DE_PASSE'));
  await page.waitForURL(/\/espace\/enseignant/, { timeout: 30_000 });
  await page.getByRole('link', { name: 'Mon compte' }).click();
  await page.waitForURL(/\/espace\/enseignant\/compte/);
  await expect(page.getByRole('heading', { name: /modifier mon mot de passe/i })).toBeVisible();
  await expect(page.getByTestId('input-current')).toBeVisible();
  await expect(page.getByTestId('input-next')).toBeVisible();
  await expect(page.getByTestId('input-confirm')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Modifier mon mot de passe' })).toBeVisible();
});

test('élève de validation : Mon compte → Sécurité, changement, ancien code refusé, nouveau accepté', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await login(page, STUDENT, studentSecret);
    await page.waitForURL(/\/espace\/eleve$/);
    await page.getByRole('link', { name: 'Mon compte' }).click();
    await page.waitForURL(/\/espace\/eleve\/compte/);
    await expect(page.getByRole('heading', { name: /modifier mon code personnel/i })).toBeVisible();
    await change(page, 'ZZZZZZZZ', NEW_CODE);
    await expect(page.getByTestId('credential-error')).toHaveText('Le code personnel actuel est incorrect.');
    await change(page, studentSecret, '123456');
    await expect(page.getByTestId('credential-error')).toHaveText('Choisissez un code personnel plus difficile à deviner.');
    await change(page, studentSecret, NEW_CODE);
    await expect(page.getByTestId('credential-success')).toContainText('Votre code personnel a été modifié.');
    await page.waitForURL(/\/espace\/connexion\?modifie=1/, { timeout: 20_000 });
  } finally {
    await ctx.close();
  }
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  try {
    await login(p2, STUDENT, studentSecret);
    await expect(p2.getByTestId('connexion-erreur')).toBeVisible();
    await login(p2, STUDENT, NEW_CODE);
    await p2.waitForURL(/\/espace\/eleve$/);
    await expect(p2.getByTestId('bonjour')).toBeVisible();
    studentSecret = NEW_CODE;
  } finally {
    await ctx2.close();
  }
});

test('réinitialisation par l’enseignant de validation → code obligatoire → nouveau code', async ({ browser }) => {
  const tctx = await browser.newContext();
  const teacher = await tctx.newPage();
  let temporary = '';
  let studentId = '';
  try {
    await login(teacher, TEACHER, teacherSecret);
    await teacher.waitForURL(/\/espace\/enseignant/);
    await teacher.goto('/espace/enseignant/eleves');
    const row = teacher.getByTestId('student-row').filter({ hasText: `TECHNIQUE-${STUDENT_RESET.split('.')[1]!.toUpperCase()}` });
    await row.getByRole('link').first().click();
    await teacher.waitForURL(/\/espace\/enseignant\/eleves\//);
    studentId = teacher.url().split('/').pop()!;
    await teacher.getByTestId('btn-reset-code').click();
    await teacher.getByRole('alertdialog').getByRole('button', { name: 'Réinitialiser', exact: true }).click();
    await expect(teacher.getByTestId('reset-result')).toBeVisible();
    temporary = (await teacher.getByTestId('temporary-code').innerText()).trim();
    expect(temporary).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    await teacher.getByTestId('btn-close-code').click();
    await expect(teacher.locator('body')).not.toContainText(temporary);
  } finally {
    await tctx.close();
  }
  expect(studentId).not.toBe('');

  const sctx = await browser.newContext();
  const student = await sctx.newPage();
  try {
    await login(student, STUDENT_RESET, creds[STUDENT_RESET]!);
    await expect(student.getByTestId('connexion-erreur')).toBeVisible(); // l'ancien code est mort
    await login(student, STUDENT_RESET, temporary);
    await student.waitForURL(/\/espace\/eleve\/compte\?obligatoire=1/);
    await expect(student.getByTestId('credential-mandatory')).toBeVisible();
    await student.goto('/espace/eleve');
    await student.waitForURL(/\/espace\/eleve\/compte\?obligatoire=1/);
    await change(student, temporary, SECOND_CODE);
    await expect(student.getByTestId('credential-success')).toBeVisible();
    await student.waitForURL(/\/espace\/connexion\?modifie=1/, { timeout: 20_000 });
    await login(student, STUDENT_RESET, temporary);
    await expect(student.getByTestId('connexion-erreur')).toBeVisible();
    await login(student, STUDENT_RESET, SECOND_CODE);
    await student.waitForURL(/\/espace\/eleve$/);
  } finally {
    await sctx.close();
  }

  // Isolation : un autre élève ne peut pas déclencher la réinitialisation de ce compte.
  const octx = await browser.newContext();
  const other = await octx.newPage();
  try {
    await login(other, STUDENT, studentSecret);
    await other.waitForURL(/\/espace\/eleve$/);
    const res = await other.request.post(`/api/espace/teacher/students/${studentId}/reset-code`, { data: {} });
    expect(res.status()).toBe(403);
  } finally {
    await octx.close();
  }
});

test('enseignant de validation : changement du mot de passe, ancien refusé, nouveau accepté', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await login(page, TEACHER, teacherSecret);
    await page.waitForURL(/\/espace\/enseignant/);
    await page.goto('/espace/enseignant/compte');
    await change(page, teacherSecret, 'court1234');
    await expect(page.getByTestId('credential-error')).toContainText('12 caractères');
    await change(page, teacherSecret, NEW_PASSWORD);
    await expect(page.getByTestId('credential-success')).toContainText('Votre mot de passe a été modifié.');
    await page.waitForURL(/\/espace\/connexion\?modifie=1/, { timeout: 20_000 });
  } finally {
    await ctx.close();
  }
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  try {
    await login(p2, TEACHER, teacherSecret);
    await expect(p2.getByTestId('connexion-erreur')).toBeVisible();
    await login(p2, TEACHER, NEW_PASSWORD);
    await p2.waitForURL(/\/espace\/enseignant/);
    teacherSecret = NEW_PASSWORD;
  } finally {
    await ctx2.close();
  }
});
