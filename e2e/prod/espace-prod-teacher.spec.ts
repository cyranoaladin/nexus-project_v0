import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

/** Compte enseignant RÉEL (lecture seule) : le fichier 0600 hors dépôt fournit identifiant et mot de passe. */
function teacherCreds(): { username: string; password: string } {
  const file = process.env.ESPACE_TEACHER_FILE;
  if (!file) throw new Error('ESPACE_TEACHER_FILE est obligatoire');
  const text = readFileSync(file, 'utf8');
  const get = (k: string) => text.split('\n').find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1).trim() ?? '';
  return { username: get('IDENTIFIANT'), password: get('MOT_DE_PASSE') };
}

const REAL_LAST_NAMES = ['CHOUKALI', 'CHRAITI', 'BEN HASSINE', 'BSIRI', 'SMIDA', 'NAOUALI', 'BEN YAHIA', 'FEKIH', 'MANSOURI', 'ZGOLLI', 'KHELIL'];
const CORRIGES = [
  'maths-fonctions-limites/corrige',
  'nsi-poo-structures-lineaires/corrige',
  'maths-suites-synthese/correction',
  'maths-suites-synthese/teacher-guide',
];

test.describe.configure({ mode: 'serial' });

test('connexion réelle du compte enseignant, accueil et liste des élèves', async ({ page }) => {
  const { username, password } = teacherCreds();
  await page.goto('/espace/connexion');
  await page.getByTestId('input-username').fill(username);
  await page.getByTestId('input-secret').fill(password);
  await page.getByTestId('btn-connexion').click();
  await page.waitForURL(/\/espace\/enseignant/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Sélecteur d'activités : les quatre parcours sont suivables.
  for (const label of ['TP POO 1', 'TP POO 2', 'Sujet de synthèse', 'Fonctions, limites et lecture graphique']) {
    await expect(page.getByRole('navigation', { name: 'Choisir l’activité' }).getByRole('link', { name: label })).toBeVisible();
  }

  await page.goto('/espace/enseignant/eleves');
  const rows = page.getByTestId('student-row');
  await expect.poll(async () => rows.count()).toBeGreaterThanOrEqual(13);
  const text = await page.locator('main').innerText();
  for (const name of REAL_LAST_NAMES) expect(text.toLowerCase(), name).toContain(name.toLowerCase());
  expect(text).toMatch(/Jean Racine/);
  expect(text).toMatch(/Terminale/);
  for (const subject of ['Mathématiques', 'NSI']) expect(text, subject).toContain(subject);
  expect(text).toMatch(/Maths expertes|expertes/i);
  console.log(`élèves visibles : ${await rows.count()}`);

  // Suivi d'un élève réel : lecture seule (aucune création de travail).
  await rows.filter({ hasText: 'CHOUKALI' }).first().getByRole('link').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Accès aux corrigés enseignant avec la session réelle.
  for (const r of CORRIGES) {
    const res = await page.request.get(`/api/espace/resources/${r}`);
    expect(res.status(), r).toBe(200);
    expect(res.headers()['content-type']).toContain('pdf');
    expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
  }

  // Les routes enseignant répondent (aperçu de la file de correction).
  expect((await page.request.get('/api/espace/teacher/overview?activity=nsi-poo-structures-lineaires')).status()).toBeLessThan(400);
});

test('une session anonyme n’accède à aucune de ces ressources', async ({ browser }) => {
  const ctx = await browser.newContext();
  try {
    const anon = ctx.request;
    for (const r of CORRIGES) expect([401, 403, 404], r).toContain((await anon.get(`/api/espace/resources/${r}`)).status());
    expect([401, 403, 404]).toContain((await anon.get('/api/espace/teacher/overview?activity=nsi-poo-structures-lineaires')).status());
    const page = await ctx.newPage();
    await page.goto('/espace/enseignant/eleves');
    await expect(page).toHaveURL(/\/espace\/connexion/);
  } finally {
    await ctx.close();
  }
});
