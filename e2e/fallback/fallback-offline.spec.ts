/**
 * Plan de secours : le paquet est construit par la CLI réelle, servi par `python3 -m http.server`, et
 * TOUTE requête hors localhost est bloquée puis comptée (doit rester à zéro). Pyodide est celui du pack LOCAL.
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const ROOT = process.cwd();
const NSI = 'NSI_TP2_LISTES_PILES_FILES';
const MATHS = 'MATHS_FONCTIONS_LIMITES';
const REC = 'NSI_RECURSIVITE';

let tmp = '';
let pkgDir = '';
let server: ChildProcess | undefined;
let base = '';
let solutions: Record<string, string> = {};
let recSolutions: Record<string, string> = {};

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolve(port));
    });
  });
}

test.beforeAll(async () => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'nexus-fallback-e2e-'));
  const pkg = path.join(tmp, 'urgence-seances-test');
  pkgDir = pkg;
  execFileSync('npx', ['tsx', 'scripts/espace/build-fallback.ts', '--out', pkg], { cwd: ROOT, stdio: 'pipe', timeout: 240_000 });
  solutions = JSON.parse(
    execFileSync('python3', ['-c', 'import json,sys; sys.path.insert(0,"content/espace/nsi-structures-lineaires"); from solutions import SOLUTIONS; print(json.dumps(SOLUTIONS))'], { cwd: ROOT }).toString(),
  );

  recSolutions = JSON.parse(
    execFileSync('python3', ['-c', 'import json,sys; sys.path.insert(0,"content/espace/nsi-recursivite"); from solutions import SOLUTIONS, STARTERS; print(json.dumps(SOLUTIONS))'], { cwd: ROOT }).toString(),
  );

  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', pkg], { stdio: 'ignore' });
  for (let i = 0; i < 50; i += 1) {
    const ok = await fetch(`${base}/LIRE_DABORD.md`).then((r) => r.ok, () => false);
    if (ok) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Le serveur local ne répond pas');
});

test.afterAll(() => {
  server?.kill('SIGTERM');
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

/** Bloque tout ce qui n'est pas local et renvoie la liste des requêtes bloquées (doit rester vide). */
async function blockExternal(context: BrowserContext): Promise<string[]> {
  const blocked: string[] = [];
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === 'data:' || url.protocol === 'blob:' || url.protocol === 'file:' || url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    blocked.push(route.request().url());
    return route.abort();
  });
  return blocked;
}

async function open(page: Page, dir: string) {
  await page.goto(`${base}/${dir}/`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test('NSI : navigation, saisie, exécution Pyodide locale, rechargement', async ({ page, context }) => {
  const blocked = await blockExternal(context);
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await open(page, NSI);
  await expect(page.getByTestId('save-indicator')).toContainText('Enregistré sur cet ordinateur');
  await expect(page.getByRole('heading', { level: 2, name: /.+/ })).toBeVisible();

  // Navigation : étape « Pile » via la liste, puis précédent / suivant.
  const nav = page.getByRole('navigation', { name: 'Étapes du TP' });
  await nav.getByRole('button', { name: /Pile/ }).click();
  await expect(nav.getByRole('button', { name: /Pile/ })).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: 'Étape suivante' }).click();
  await expect(nav.getByRole('button', { name: /File/ })).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: 'Étape précédente' }).click();
  await expect(nav.getByRole('button', { name: /Pile/ })).toHaveAttribute('aria-current', 'step');

  // Code de départ : le harnais local répond réellement (tests à revoir).
  const editor = page.getByTestId('code-editor');
  await expect(editor).toBeVisible();
  await page.getByRole('button', { name: 'Vérifier mon code' }).click();
  const results = page.getByTestId('run-results');
  await expect(results).toContainText(/À revoir|Erreur/, { timeout: 90_000 });

  // Solution de référence : tous les tests passent, avec le vrai Pyodide du pack local.
  await editor.fill(solutions.pile!);
  await page.getByRole('button', { name: 'Vérifier mon code' }).click();
  await expect(results).toContainText('Réussi', { timeout: 60_000 });
  await expect(results).not.toContainText('À revoir');

  // Exécuter : l'affichage du programme revient du Worker.
  await editor.fill('print("bonjour hors ligne")');
  await page.getByRole('button', { name: 'Exécuter' }).click();
  await expect(results).toContainText('bonjour hors ligne', { timeout: 60_000 });

  // Rechargement : le code est restauré depuis le localStorage.
  await editor.fill('# mon code de secours\nprint(42)\n');
  await page.reload();
  await expect(page.getByTestId('code-editor')).toHaveValue('# mon code de secours\nprint(42)\n');
  await expect(nav.getByRole('button', { name: /Pile/ })).toHaveAttribute('aria-current', 'step');

  expect(blocked, 'requêtes externes bloquées').toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('NSI : simulateur de pile et QCM avec retour ciblé', async ({ page, context }) => {
  const blocked = await blockExternal(context);
  await open(page, NSI);
  await page.getByRole('navigation', { name: 'Étapes du TP' }).getByRole('button', { name: /Comprendre/ }).click();

  const sim = page.getByTestId('sim-sim-pile');
  await sim.scrollIntoViewIfNeeded();
  await sim.getByRole('button', { name: 'Dépiler' }).click();
  await expect(sim.getByTestId('sim-message')).toContainText('Pile vide');
  await sim.getByRole('textbox').fill('A');
  await sim.getByRole('button', { name: 'Empiler' }).click();
  await sim.getByRole('textbox').fill('B');
  await sim.getByRole('button', { name: 'Empiler' }).click();
  await expect(sim.getByTestId('sim-items').locator('li').first()).toContainText('B');
  await expect(sim.getByTestId('sim-items').locator('li').first()).toContainText('sommet');
  await sim.getByRole('button', { name: 'Dépiler' }).click();
  await expect(sim.getByTestId('sim-message')).toContainText('« B »');

  // QCM : un mauvais choix puis le bon donnent un retour différent.
  const firstChoice = page.locator('fieldset.question').first().locator('input[type="radio"]');
  const count = await firstChoice.count();
  expect(count).toBeGreaterThan(1);
  const feedback = page.getByTestId('qcm-feedback').first();
  const seen = new Set<string>();
  for (let i = 0; i < count; i += 1) {
    await firstChoice.nth(i).check();
    await expect(feedback).toBeVisible();
    seen.add((await feedback.innerText()).slice(0, 14));
  }
  expect([...seen].sort()).toEqual(['Bonne réponse.', 'Pas tout à fai'].sort());

  expect(blocked).toEqual([]);
});

test('Maths : figure SVG, vérification pédagogique, persistance, impression', async ({ page, context }) => {
  const blocked = await blockExternal(context);
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await open(page, MATHS);

  const nav = page.getByRole('navigation', { name: 'Étapes du TP' });
  await nav.getByRole('button', { name: /Tangente/ }).click();

  // Figure : SVG de la plateforme (buildFunctionSvg) rendu sans réseau.
  const figure = page.getByTestId('figure-g-tan');
  await expect(figure.locator('svg')).toBeVisible();
  const before = await figure.locator('svg').innerHTML();

  // Réponse fausse ciblée : retour pédagogique, et la droite saisie se superpose à la figure.
  const field = page.locator('#f-tangente-tangente');
  await field.fill('y=-3x+1');
  await expect.poll(async () => figure.locator('svg').innerHTML()).not.toBe(before);
  await page.locator('button[data-f="tangente"]').click();
  const verdict = page.locator('[data-fb="tangente"]');
  await expect(verdict).toContainText('Pas encore.');
  await expect(verdict).toContainText(/ordonnée à l.origine/);
  await expect(verdict.locator('.katex')).not.toHaveCount(0); // formules pré-rendues par KaTeX

  // Bonne réponse (touche Entrée) : validée.
  await field.fill('y=-3x-1');
  await field.press('Enter');
  await expect(verdict).toContainText('Correct.');

  // Indice : libellé « Indice 1 sur n ».
  const hintButton = page.getByRole('button', { name: 'Un indice ?' });
  if (await hintButton.count()) {
    await hintButton.click();
    await expect(page.locator('.hint').first()).toContainText(/Indice 1 sur \d+/);
  }

  // Rechargement : réponse, étape et essai conservés.
  await page.reload();
  await expect(page.locator('#f-tangente-tangente')).toHaveValue('y=-3x-1');
  await expect(page.locator('[data-fb="tangente"]')).toContainText('Réponse déjà validée');
  await expect(page.getByTestId('save-indicator')).toContainText('Enregistré sur cet ordinateur');

  // Impression : la fiche méthode est visible, l'interface est masquée, fond blanc.
  await page.getByRole('navigation', { name: 'Étapes du TP' }).getByRole('button', { name: /Méthodes/ }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#print-sheet')).toBeVisible();
  await expect(page.locator('nav.steps')).toBeHidden();
  await expect(page.getByTestId('btn-print')).toBeHidden();
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)');
  await page.emulateMedia({ media: 'screen' });

  expect(blocked, 'requêtes externes bloquées').toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('Maths : mobile 360 px sans débordement horizontal', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const blocked = await blockExternal(context);
  const page = await context.newPage();
  await open(page, MATHS);
  await page.locator('#step-select').selectOption({ label: '6. Tangente' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(blocked).toEqual([]);
  await context.close();
});

test('file:// : le parcours Maths fonctionne sans serveur, la page NSI explique la limite Python', async ({ page, context }) => {
  const blocked = await blockExternal(context);

  await page.goto(`file://${pkgDir}/${MATHS}/index.html`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('navigation', { name: 'Étapes du TP' }).getByRole('button', { name: /Tangente/ }).click();
  await expect(page.getByTestId('figure-g-tan').locator('svg')).toBeVisible();
  await page.locator('#f-tangente-tangente').fill('y=-3x-1');
  await page.locator('button[data-f="tangente"]').click();
  await expect(page.locator('[data-fb="tangente"]')).toContainText('Correct.');
  await page.reload();
  await expect(page.locator('#f-tangente-tangente')).toHaveValue('y=-3x-1'); // localStorage fonctionne aussi en file://
  await expect(page.locator('.katex').first()).toBeVisible(); // polices KaTeX relatives

  await page.goto(`file://${pkgDir}/${NSI}/index.html`);
  await page.getByRole('navigation', { name: 'Étapes du TP' }).getByRole('button', { name: /Pile/ }).click();
  await expect(page.getByTestId('py-file-note')).toContainText('LIRE_DABORD.md');
  await expect(page.getByRole('button', { name: 'Vérifier mon code' })).toBeDisabled();
  await expect(page.getByTestId('code-editor')).toBeEditable(); // l'éditeur et la sauvegarde restent utilisables

  expect(blocked).toEqual([]);
});

test('Récursivité : RecursionError maîtrisée, solution validée, récursion trop longue interrompue, trace, rechargement — hors ligne', async ({ page, context }) => {
  test.setTimeout(240_000);
  const blocked = await blockExternal(context);
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await open(page, REC);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Récursivité et programmation récursive');
  const nav = page.getByRole('navigation', { name: 'Étapes du TP' });

  // Programme défectueux de l'étape « Découvrir » : erreur pédagogique lisible, pas de gel.
  await nav.getByRole('button', { name: /Découvrir/ }).click();
  const editor = page.getByTestId('code-editor');
  const results = page.getByTestId('run-results');
  await page.getByRole('button', { name: 'Exécuter' }).click();
  await expect(results).toContainText('RecursionError', { timeout: 120_000 });
  await expect(results).toContainText('Nexus limite volontairement la profondeur à 200 appels');
  await editor.fill(recSolutions.decouverte!);
  await page.getByRole('button', { name: 'Vérifier mon code' }).click();
  await expect(results).toContainText('Réussi', { timeout: 60_000 });
  await expect(results).not.toContainText('À revoir');

  // Trace APPEL / RETOUR : descente puis remontée, sans réseau.
  await nav.getByRole('button', { name: /Pile d’appels/ }).click();
  const trace = page.getByTestId('trace-trace-somme');
  for (let i = 0; i < 5; i += 1) await trace.getByRole('button', { name: 'Étape suivante' }).click();
  await expect(trace.getByTestId('trace-phase')).toContainText('Descente');
  await expect(trace.getByTestId('trace-stack').locator('li').first()).toContainText('somme(0)');
  for (let i = 0; i < 5; i += 1) await trace.getByRole('button', { name: 'Étape suivante' }).click();
  await expect(trace.getByTestId('trace-events')).toContainText('RETOUR 10');
  await expect(trace.getByTestId('trace-phase')).toContainText('Terminé');

  // Solution complète des trois fonctions.
  await nav.getByRole('button', { name: /Écrire/ }).click();
  await page.getByTestId('code-editor').fill(recSolutions.ecrire!);
  await page.getByRole('button', { name: 'Vérifier mon code' }).click();
  await expect(results).toContainText('Réussi', { timeout: 60_000 });
  await expect(results).not.toContainText('À revoir');

  // Récursion exponentielle : le Worker est interrompu et l'interface répond ensuite.
  await page.getByTestId('code-editor').fill('def f(n):\n    if n == 0:\n        return 1\n    return f(n - 1) + f(n - 1)\n\n\nprint(f(60))\n');
  await page.getByRole('button', { name: 'Exécuter' }).click();
  await expect(results).toContainText('Temps d’exécution dépassé', { timeout: 90_000 });
  await page.getByTestId('code-editor').fill('print("interface récupérée")');
  await page.getByRole('button', { name: 'Exécuter' }).click();
  await expect(results).toContainText('interface récupérée', { timeout: 90_000 });

  // Rechargement : code et étape restaurés.
  await page.getByTestId('code-editor').fill('# restauré hors ligne\nprint(7)\n');
  await page.reload();
  await expect(page.getByTestId('code-editor')).toHaveValue('# restauré hors ligne\nprint(7)\n');
  await expect(nav.getByRole('button', { name: /Écrire/ })).toHaveAttribute('aria-current', 'step');

  expect(blocked, 'requêtes externes bloquées').toEqual([]);
  expect(pageErrors).toEqual([]);
});
