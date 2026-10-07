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

// Noms attendus dans la liste (séparés par des virgules) : fournis à l'exécution, jamais versionnés (données de mineurs).
const EXPECTED_NAMES = (process.env.ESPACE_EXPECTED_STUDENT_NAMES ?? '').split(',').map((n) => n.trim()).filter(Boolean);
const CORRIGES = [
  'maths-fonctions-limites/corrige',
  'nsi-poo-structures-lineaires/corrige',
  'nsi-recursivite/corrige',
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

  // Sélecteur d'activités : les cinq parcours sont suivables.
  for (const label of ['TP POO 1', 'TP POO 2', 'Récursivité et programmation récursive', 'Sujet de synthèse', 'Fonctions, limites et lecture graphique']) {
    await expect(page.getByRole('navigation', { name: 'Choisir l’activité' }).getByRole('link', { name: label })).toBeVisible();
  }

  await page.goto('/espace/enseignant/eleves');
  const rows = page.getByTestId('student-row');
  await expect.poll(async () => rows.count()).toBeGreaterThanOrEqual(13);
  const text = await page.locator('main').innerText();
  expect(EXPECTED_NAMES.length, 'ESPACE_EXPECTED_STUDENT_NAMES est obligatoire').toBeGreaterThanOrEqual(11);
  for (const name of EXPECTED_NAMES) expect(text.toLowerCase(), name).toContain(name.toLowerCase());
  expect(text).toMatch(/Jean Racine/);
  expect(text).toMatch(/Terminale/);
  for (const subject of ['Mathématiques', 'NSI']) expect(text, subject).toContain(subject);
  expect(text).toMatch(/Maths expertes|expertes/i);
  console.log(`élèves visibles : ${await rows.count()}`);

  // Suivi d'un élève réel : lecture seule (aucune création de travail).
  await rows.filter({ hasText: EXPECTED_NAMES[0]! }).first().getByRole('link').first().click();
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

test('comptes de validation invisibles : effectifs, file « À corriger », accueil de chaque activité, statistiques', async ({ page }) => {
  const { username, password } = teacherCreds();
  await page.goto('/espace/connexion');
  await page.getByTestId('input-username').fill(username);
  await page.getByTestId('input-secret').fill(password);
  await page.getByTestId('btn-connexion').click();
  await page.waitForURL(/\/espace\/enseignant/, { timeout: 30_000 });
  const FORBIDDEN = /TECHNIQUE|Validation technique|\bval\.[a-z0-9]+\b/i;

  // Liste des élèves : exactement les 13 vrais élèves.
  await page.goto('/espace/enseignant/eleves');
  await expect(page.getByTestId('student-row')).toHaveCount(13);
  expect(await page.locator('main').innerText()).not.toMatch(FORBIDDEN);

  // File « À corriger » : aucun travail technique, même remis.
  await page.goto('/espace/enseignant/a-corriger');
  expect(await page.locator('main').innerText()).not.toMatch(FORBIDDEN);

  // Accueil de chaque activité : lignes et compteurs sans comptes techniques.
  for (const slug of ['nsi-poo-objets-qui-agissent', 'nsi-poo-structures-lineaires', 'nsi-recursivite', 'maths-suites-synthese', 'maths-fonctions-limites']) {
    await page.goto(`/espace/enseignant?activite=${slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.locator('main').innerText(), slug).not.toMatch(FORBIDDEN);
    const api = await page.request.get(`/api/espace/teacher/overview?activity=${slug}`);
    expect(api.status(), slug).toBe(200);
    const overview = (await api.json()) as { counts: { students: number }; rows: { name: string }[] };
    expect(overview.counts.students, slug).toBe(overview.rows.length);
    expect(overview.rows.map((r) => r.name).filter((n) => FORBIDDEN.test(n)), slug).toEqual([]);
  }

  // Séances : aucune séance technique.
  await page.goto('/espace/enseignant/seances');
  expect(await page.locator('main').innerText()).not.toMatch(FORBIDDEN);
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
