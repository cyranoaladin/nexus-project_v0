import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

/** Lecture d'un fichier « nom;identifiant;code » (0600, hors dépôt). Les codes ne sont ni affichés ni journalisés. */
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

// Lecture différée (voir espace-prod-credentials.spec.ts).
let validationCache: Record<string, string> | undefined;
let realCache: Record<string, string> | undefined;
const validation = new Proxy({} as Record<string, string>, { get: (_t, k: string) => (validationCache ??= readCreds('ESPACE_VALIDATION_CREDENTIALS'))[k] });
const real = new Proxy({} as Record<string, string>, { get: (_t, k: string) => (realCache ??= readCreds('ESPACE_REAL_CREDENTIALS'))[k] });
const run = Date.now().toString(36);
/** Paire d'élèves techniques NEUVE à chaque campagne (un travail remis est en lecture seule : le test n'est pas rejouable sur le même compte). */
const A = process.env.ESPACE_STUDENT_A ?? 'val.a';
const B = process.env.ESPACE_STUDENT_B ?? 'val.b';
const T = process.env.ESPACE_TEACHER ?? 'val.prof';
const A_NAME = `TECHNIQUE-${A.split('.')[1]!.toUpperCase()}`;

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;
const states: Record<string, StorageState> = {};

async function login(page: Page, username: string, secret: string) {
  await page.goto('/espace/connexion');
  await page.getByTestId('input-username').fill(username);
  await page.getByTestId('input-secret').fill(secret);
  await page.getByTestId('btn-connexion').click();
}

async function as(browser: Browser, username: string) {
  if (!states[username]) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await login(p, username, validation[username]!);
    await p.waitForURL(/\/espace\/(eleve|enseignant)/);
    states[username] = await ctx.storageState();
    await ctx.close();
  }
  const ctx = await browser.newContext({ storageState: states[username] });
  return { ctx, page: await ctx.newPage() };
}

async function expectSaved(page: Page) {
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state', 'saved', { timeout: 20_000 });
}

function reference(name: string): string {
  const dir = path.join(process.cwd(), 'content/espace/nsi-structures-lineaires');
  return execFileSync('python3', ['-c', `import solutions; print(solutions.${name}, end="")`], { cwd: dir, encoding: 'utf8' });
}

const FOUR = [
  { href: '/espace/maths/suites', text: /Sujet de synthèse/ },
  { href: '/espace/maths/fonctions-limites', text: /Fonctions, limites et lecture graphique/ },
  { href: '/espace/nsi/poo', text: /TP POO 1/ },
  { href: '/espace/nsi/structures-lineaires', text: /TP POO 2 — Listes, piles et files/ },
];

let workNsi = '';

test.describe.configure({ mode: 'serial' });

test.describe('accès public et anonyme', () => {
  test('pages publiques et frontière d’authentification', async ({ request }) => {
    for (const p of ['/', '/offres', '/api/health', '/auth/signin', '/espace/connexion', '/ateliers/poo/']) {
      expect((await request.get(p)).status(), p).toBe(200);
    }
    const anon = await request.get('/espace', { maxRedirects: 0 });
    expect([302, 307]).toContain(anon.status());
    expect(anon.headers().location).toContain('/espace/connexion');
    for (const p of ['/api/espace/works', '/api/espace/teacher/overview', '/api/espace/resources/maths-fonctions-limites/corrige']) {
      const status = (await request.get(p)).status();
      expect(status, p).not.toBe(200);
      expect(status, p).toBeLessThan(500);
      expect([401, 403, 404, 405], p).toContain(status);
    }
  });

  test('un mauvais code est refusé sans détail, le compte reste fermé', async ({ page }) => {
    await login(page, A, 'ZZZZZZZZ');
    await expect(page).toHaveURL(/\/espace\/connexion/);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).not.toContainText(/val\.a|inconnu|existe/i);
  });
});

test.describe('connexion de tous les comptes réels (lecture seule)', () => {
  test.describe.configure({ mode: 'serial' });
  // Identifiants des élèves Maths + NSI : fournis à l'exécution (jamais versionnés).
  const MATHS_NSI = (process.env.ESPACE_MATHS_NSI_USERNAMES ?? '').split(',').map((n) => n.trim()).filter(Boolean);
  test('chaque élève provisionné se connecte et voit ses matières', async ({ browser }) => {
    const report: string[] = [];
    for (const [username, secret] of Object.entries(real)) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        await login(page, username, secret);
        await page.waitForURL(/\/espace\/eleve/, { timeout: 30_000 });
        const subjects = await page.getByTestId('matiere').count();
        expect(subjects, username).toBeGreaterThanOrEqual(1);
        if (MATHS_NSI.includes(username)) {
          for (const e of FOUR) {
            await expect(page.locator(`a[href^="${e.href}"]`).first(), `${username} ${e.href}`).toBeVisible();
          }
        }
        report.push(`${username}: connexion OK, ${subjects} matière(s)`);
      } finally {
        await ctx.close();
      }
    }
    console.log(report.join('\n'));
    expect(report.length).toBe(Object.keys(real).length);
  });
});

test.describe('élève de validation — quatre parcours', () => {
  test('tableau de bord : Maths et NSI, quatre parcours qui s’ouvrent', async ({ browser }) => {
    const { ctx, page } = await as(browser, A);
    try {
      await page.goto('/espace/eleve');
      await expect(page.getByTestId('bonjour')).toContainText('Bonjour');
      await expect(page.getByTestId('matiere')).toHaveCount(2);
      for (const e of FOUR) {
        const link = page.getByTestId('matiere').getByRole('link', { name: e.text });
        await expect(link, e.href).toBeVisible();
        await expect(link).toHaveAttribute('href', new RegExp(`^${e.href}`));
      }
      for (const e of FOUR) {
        const res = await page.goto(e.href);
        expect(res?.status(), e.href).toBeLessThan(400);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      }
    } finally {
      await ctx.close();
    }
  });
});

test.describe('TP POO 2 en production', () => {
  test('réponse, autosave, rechargement, Python réel (Pyodide), étape suivante', async ({ browser }) => {
    const { ctx, page } = await as(browser, A);
    try {
      await page.goto('/espace/nsi/structures-lineaires');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('POO 2');

      await page.getByRole('button', { name: /^1\./ }).first().click(); // le parcours reprend là où l'élève s'était arrêté
      await expect(page.getByText(/Étape 1 sur/)).toBeVisible();
      await page.getByRole('textbox').first().fill(`Validation technique ${run}`);
      await expectSaved(page);
      await page.reload();
      await expect(page.getByText(/Étape 1 sur/)).toBeVisible(); // l'étape courante est restaurée
      await expect(page.getByRole('textbox').first()).toHaveValue(`Validation technique ${run}`);

      await page.getByRole('button', { name: /^3\./ }).first().click(); // « Liste » (le parcours reprend là où l'élève s'était arrêté)
      await expect(page.getByText(/Étape 3 sur/)).toBeVisible();
      const editor = page.getByTestId('code-editor');
      await expect(editor).toBeVisible();
      await editor.fill('class Liste:\n    pass\n'); // une ébauche vide : les contrôles de comportement doivent échouer
      await expectSaved(page);
      await page.getByRole('button', { name: 'Vérifier mon code' }).click();
      const results = page.getByTestId('run-results');
      await expect(results).toContainText('À revoir', { timeout: 170_000 });

      await editor.fill(reference('LISTE_SOLUTION'));
      await expectSaved(page);
      await page.getByRole('button', { name: 'Vérifier mon code' }).click();
      await expect(results).toContainText('Réussi', { timeout: 170_000 });
      await expect(results).not.toContainText('À revoir');
      await expectSaved(page);

      await page.reload();
      await expect(page.getByTestId('code-editor')).toHaveValue(/class Liste/);
      await expect(page.getByText(/Étape 3 sur/)).toBeVisible(); // l'étape courante est restaurée
      await page.getByRole('button', { name: 'Étape suivante' }).click();
      await expect(page.getByText(/Étape 4 sur/)).toBeVisible();
      workNsi = page.url();
    } finally {
      await ctx.close();
    }
  });
});

test.describe('Maths — fonctions, limites et lecture graphique en production', () => {
  test('formules, graphique, vérifications de g(x) = (2x+1)/(x−1), autosave et reprise', async ({ browser }) => {
    const { ctx, page } = await as(browser, A);
    try {
      await page.goto('/espace/maths/fonctions-limites');
      await expect(page.locator('.katex').first()).toBeVisible();
      await expect(page.locator('main')).not.toContainText('\\frac');
      await expect(page.locator('figure svg').first()).toBeVisible();

      const answer = async (step: string, field: string, value: string) => {
        const input = page.locator(`#f-${step}-${field}`);
        await expect(input).toBeVisible();
        await input.fill(value);
        await input.press('Enter');
      };
      const nav = async (n: number) => {
        await page.getByRole('button', { name: new RegExp(`^${n}\\.`) }).first().click();
      };

      await nav(4); // Asymptote verticale : x = 1
      await answer('asymptote-verticale', 'lim-moins', '-inf');
      await answer('asymptote-verticale', 'lim-plus', '+inf');
      await answer('asymptote-verticale', 'av-eq', 'x=1');
      await expect(page.getByTestId('check-feedback').filter({ hasText: 'Correct' })).toHaveCount(3);
      await expectSaved(page);

      await nav(5); // Asymptote horizontale : y = 2
      await answer('asymptote-horizontale', 'lim-plus-inf', '2');
      await answer('asymptote-horizontale', 'ah-eq', 'y=2');
      await expect(page.getByTestId('check-feedback').filter({ hasText: 'Correct' })).toHaveCount(2);

      await nav(6); // Dérivée et tangente en 0 : g'(0) = −3, y = −3x − 1
      await answer('tangente', 'gp0', '-3');
      await answer('tangente', 'tangente', 'y=-3x-1');
      await expect(page.getByTestId('check-feedback').filter({ hasText: 'Correct' })).toHaveCount(2);
      await expect(page.locator('[data-testid="figure-g-tan"] svg')).toBeVisible();
      // Retour ciblé sur une erreur typique (jamais un simple « faux »).
      await answer('tangente', 'g0', '1');
      await expect(page.getByTestId('check-feedback').filter({ hasText: /Pas encore/ })).toHaveCount(1);
      await expectSaved(page);

      await page.reload();
      await expect(page.locator('#f-tangente-tangente')).toHaveValue('y=-3x-1');
      await expect(page.getByTestId('check-feedback').filter({ hasText: /déjà validée/ }).first()).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});

test.describe('remise', () => {
  test('le travail NSI est remis et passe en SUBMITTED', async ({ browser }) => {
    const { ctx, page } = await as(browser, A);
    try {
      await page.goto(workNsi || '/espace/nsi/structures-lineaires');
      await page.getByTestId('btn-remettre').click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Remettre', exact: true }).click();
      await expect(page.getByTestId('work-banner')).toContainText(/remis/i, { timeout: 20_000 });
      await expect(page.getByTestId('code-editor')).not.toBeEditable();
    } finally {
      await ctx.close();
    }
  });
});

test.describe('enseignant de validation', () => {
  test('suivi, relecture, commentaire, annotation et « À reprendre »', async ({ browser }) => {
    const { ctx, page } = await as(browser, T);
    try {
      await page.goto('/espace/enseignant');
      const row = page.getByTestId('roster-row').filter({ hasText: A_NAME }).first();
      await expect(row).toBeVisible();
      await expect(page.getByTestId('roster-row').filter({ hasText: A_NAME }).first()).toContainText(/À corriger|Remis/i);
      await page.goto('/espace/enseignant/eleves');
      await expect(page.getByTestId('student-row').filter({ hasText: A_NAME })).toBeVisible();

      await page.goto('/espace/enseignant');
      await page.getByTestId('roster-row').filter({ hasText: A_NAME }).first().getByRole('link').first().click();
      await page.waitForURL(/\/espace\/enseignant\/corriger\//);
      workId = page.url().split('/').pop()!;
      await expect(page.getByTestId('work-viewer')).toContainText(`Validation technique ${run}`);

      const comment = `Relis la convention de structure vide (${run}).`;
      await page.getByLabel('Commentaire', { exact: true }).fill(comment);
      await page.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByTestId('annotation').filter({ hasText: comment })).toBeVisible();
      await page.getByRole('button', { name: 'À reprendre' }).click();
      await expect(page.getByText(/reprendre|rouvert/i).first()).toBeVisible({ timeout: 15_000 });
    } finally {
      await ctx.close();
    }
  });
});

let workId = '';

test.describe('retour à l’élève', () => {
  test('le retour est visible et le travail est rouvert (modifiable)', async ({ browser }) => {
    const { ctx, page } = await as(browser, A);
    try {
      await page.goto('/espace/nsi/structures-lineaires');
      await expect(page.getByTestId('work-banner')).toContainText(/reprendre/i);
      await expect(page.getByTestId('annotation').first()).toContainText('convention de structure vide');
      await expect(page.getByRole('textbox').first()).toBeEnabled();
    } finally {
      await ctx.close();
    }
  });
});

test.describe('isolation et corrigés', () => {
  test('un élève ne lit jamais le travail d’un autre (API)', async ({ browser }) => {
    expect(workId).not.toBe('');
    const { ctx: b, page } = await as(browser, B);
    try {
      for (const sub of ['', '/versions', '/annotations']) {
        const res = await page.request.get(`/api/espace/works/${workId}${sub}`);
        expect([403, 404], `GET works/${sub}`).toContain(res.status());
      }
      // Pages enseignant : l'élève est renvoyé vers son propre tableau de bord, sans aucune donnée du travail ciblé.
      for (const target of [`/espace/enseignant/corriger/${workId}`, '/espace/enseignant', '/espace/enseignant/eleves']) {
        await page.goto(target);
        await expect(page).toHaveURL(/\/espace\/eleve/);
        await expect(page.locator('main')).not.toContainText(`Validation technique ${run}`);
        await expect(page.getByTestId('work-viewer')).toHaveCount(0);
      }
      const teacherApi = await page.request.get('/api/espace/teacher/overview');
      expect([401, 403, 404]).toContain(teacherApi.status());
    } finally {
      await b.close();
    }
  });

  test('corrigés : refusés à l’élève, servis à l’enseignant', async ({ browser }) => {
    const targets = ['maths-fonctions-limites', 'nsi-poo-structures-lineaires'];
    const { ctx: s, page: sp } = await as(browser, A);
    try {
      for (const t of targets) expect((await sp.request.get(`/api/espace/resources/${t}/corrige`)).status(), `élève ${t}`).toBe(404);
      expect((await sp.request.get('/api/espace/resources/maths-suites-synthese/correction')).status()).toBe(404);
      expect((await sp.request.get('/api/espace/resources/maths-suites-synthese/subject')).status()).toBe(200); // le sujet reste public
    } finally {
      await s.close();
    }
    const { ctx: t, page: tp } = await as(browser, T);
    try {
      for (const k of targets) {
        const res = await tp.request.get(`/api/espace/resources/${k}/corrige`);
        expect(res.status(), `enseignant ${k}`).toBe(200);
        expect(res.headers()['content-type']).toContain('pdf');
        expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
      }
    } finally {
      await t.close();
    }
  });
});
