/**
 * Fumée de PRODUCTION — parcours « Récursivité et programmation récursive ».
 * Écrit uniquement avec des comptes techniques de validation (jamais un vrai élève).
 *
 *   ESPACE_PROD_URL=https://… ESPACE_VALIDATION_CREDENTIALS=/chemin/0600 \
 *   ESPACE_REC_STUDENT=val.r1 ESPACE_REC_OTHER=val.r2 ESPACE_REC_TEACHER=val.rprof \
 *   npx playwright test -c playwright.prod-smoke.config.ts e2e/prod/espace-prod-recursivite.spec.ts
 *
 * Fichier d'identifiants « nom;identifiant;code » (0600, hors dépôt) : les codes ne sont ni affichés ni journalisés.
 * Une paire neuve par campagne (un travail remis est en lecture seule).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

function readCreds(env: string): Record<string, string> {
  const file = process.env[env];
  if (!file) throw new Error(`${env} est obligatoire`);
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [, username, secret] = line.split(';');
    if (!username || !secret) continue;
    const raw = secret.trim();
    out[username] = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(raw) ? raw.replace('-', '') : raw;
  }
  return out;
}

const creds = readCreds('ESPACE_VALIDATION_CREDENTIALS');
const STUDENT = process.env.ESPACE_REC_STUDENT ?? 'val.r1';
const OTHER = process.env.ESPACE_REC_OTHER ?? 'val.r2';
const TEACHER = process.env.ESPACE_REC_TEACHER ?? 'val.rprof';
const SLUG = 'nsi-recursivite';
const COMMENT = `Contrôle de production ${Date.now().toString(36)}`;

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;
const states: Record<string, StorageState> = {};
let workId = '';

async function as(browser: Browser, username: string) {
  if (!states[username]) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto('/espace/connexion');
    await p.getByTestId('input-username').fill(username);
    await p.getByTestId('input-secret').fill(creds[username]!);
    await p.getByTestId('btn-connexion').click();
    await p.waitForURL(/\/espace\/(eleve|enseignant)/);
    states[username] = await ctx.storageState();
    await ctx.close();
  }
  const ctx = await browser.newContext({ storageState: states[username] });
  return { ctx, page: await ctx.newPage() };
}

const expectSaved = (page: Page) => expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state', 'saved', { timeout: 20_000 });
const goToStep = (page: Page, label: RegExp) => page.getByRole('navigation', { name: 'Étapes du TP' }).getByRole('button', { name: label }).click();

function reference(name: 'DECOUVERTE_SOLUTION' | 'ECRIRE_SOLUTION'): string {
  const dir = path.join(process.cwd(), 'content/espace/nsi-recursivite');
  return execFileSync('python3', ['-c', `import solutions; print(solutions.${name}, end="")`], { cwd: dir, encoding: 'utf8' });
}

test.describe.configure({ mode: 'serial' });

test('anonyme : le parcours et son corrigé ne fuient rien', async ({ request }) => {
  const page = await request.get(`/espace/nsi/recursivite`, { maxRedirects: 0 });
  expect([307, 302]).toContain(page.status());
  expect((await request.get(`/api/espace/resources/${SLUG}/corrige`)).status()).toBe(401);
  expect((await request.get(`/api/espace/teacher/overview?activity=${SLUG}`)).status()).toBe(401);
});

test('élève : thèmes NSI, parcours, programme défectueux, réparation, contrôles Pyodide, autosave, reprise, remise', async ({ browser }) => {
  test.setTimeout(300_000);
  const { ctx, page } = await as(browser, STUDENT);
  try {
    await page.goto('/espace/eleve/matieres');
    await expect(page.getByTestId('theme').nth(0)).toContainText('Programmation orientée objet');
    await expect(page.getByTestId('theme').nth(1)).toContainText('Algorithmique et programmation');
    await expect(page.locator('a[href="/espace/nsi/recursivite"]')).toBeVisible();

    await page.goto('/espace/nsi/recursivite');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Récursivité et programmation récursive');
    await page.getByRole('radio').first().check();
    await expect(page.getByTestId('save-indicator')).toBeVisible();
    await expectSaved(page);

    await page.getByRole('button', { name: 'Étape suivante' }).click();
    const editor = page.getByTestId('code-editor');
    const results = page.getByTestId('run-results');
    await page.getByRole('button', { name: 'Exécuter' }).click();
    await expect(results).toContainText('RecursionError', { timeout: 150_000 });
    await editor.fill(reference('DECOUVERTE_SOLUTION'));
    await page.getByRole('button', { name: 'Vérifier mon code' }).click();
    await expect(results).toContainText('Réussi', { timeout: 60_000 });
    await expect(results).not.toContainText('À revoir');

    await goToStep(page, /4\. Pile d’appels/);
    const trace = page.getByTestId('trace-trace-somme');
    for (let i = 0; i < 10; i++) await trace.getByRole('button', { name: 'Étape suivante' }).click();
    await expect(trace.getByTestId('trace-events')).toContainText('RETOUR 10');

    await goToStep(page, /5\. Écrire/);
    await page.getByTestId('code-editor').fill(reference('ECRIRE_SOLUTION'));
    await page.getByRole('button', { name: 'Vérifier mon code' }).click();
    await expect(results).toContainText('Réussi', { timeout: 60_000 });
    await expect(results).not.toContainText('À revoir');
    await expectSaved(page);

    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Étapes du TP' }).getByRole('button', { name: /5\. Écrire/ })).toHaveAttribute('aria-current', 'step');
    await expect(page.getByTestId('code-editor')).toHaveValue(reference('ECRIRE_SOLUTION'));

    await page.getByTestId('btn-remettre').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remettre', exact: true }).click();
    await expect(page.getByTestId('work-banner')).toContainText(/remis/i, { timeout: 20_000 });
    expect((await page.request.get(`/api/espace/resources/${SLUG}/corrige`)).status()).toBe(404); // corrigé jamais servi à un élève
  } finally {
    await ctx.close();
  }
});

test('non-régression : TP POO 1, TP POO 2 et Maths répondent', async ({ browser }) => {
  const { ctx, page } = await as(browser, STUDENT);
  try {
    for (const url of ['/espace/nsi/poo', '/espace/nsi/structures-lineaires', '/espace/maths/suites', '/espace/maths/fonctions-limites']) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBeLessThan(400);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  } finally {
    await ctx.close();
  }
});

test('isolation : un élève de Maths seul n’accède ni au parcours ni au travail d’autrui', async ({ browser }) => {
  const { ctx, page } = await as(browser, OTHER);
  try {
    await page.goto('/espace/nsi/recursivite');
    await expect(page.getByText(/n’est pas dans tes matières/)).toBeVisible();
    await expect(page.getByTestId('code-editor')).toHaveCount(0);
  } finally {
    await ctx.close();
  }
});

test('enseignant : travail, code, tests, compétence, commentaire, « À reprendre », corrigé PDF', async ({ browser }) => {
  const { ctx, page } = await as(browser, TEACHER);
  try {
    await page.goto('/espace/enseignant?activite=nsi-recursivite');
    const row = page.getByTestId('roster-row').filter({ hasText: STUDENT.split('.')[1]!.toUpperCase() });
    await expect(row).toContainText('À corriger');
    await row.getByRole('link').click();
    await page.waitForURL(/\/espace\/enseignant\/corriger\//);
    workId = page.url().split('/').pop()!;
    await expect(page.getByTestId('code-ecrire')).toContainText('return n + somme(n - 1)');
    await expect(page.getByTestId('tests-ecrire')).toContainText('10/10');

    await page.getByLabel('Compétence', { exact: true }).selectOption({ label: 'Tracer des appels récursifs' });
    await page.getByRole('button', { name: 'Acquise' }).first().click();
    await page.getByLabel('Commentaire', { exact: true }).fill(`${COMMENT}\n` + (await page.getByLabel('Commentaire', { exact: true }).inputValue()));
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByTestId('annotation').filter({ hasText: COMMENT })).toBeVisible();
    await page.getByRole('button', { name: 'À reprendre' }).click();
    await expect(page.getByText(/à reprendre|rouvert/i).first()).toBeVisible();

    const pdf = await page.request.get(`/api/espace/resources/${SLUG}/corrige`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('application/pdf');
    expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
  } finally {
    await ctx.close();
  }
  expect(workId).not.toBe('');
});
