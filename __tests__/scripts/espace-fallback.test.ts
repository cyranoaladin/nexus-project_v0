/**
 * @jest-environment node
 *
 * Outillage du plan de secours (build-fallback, build-corriges, verifier.py, install-resources) :
 * le paquet doit être autonome (aucune URL externe, aucun chemin absolu) et fidèle à la plateforme.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { CORRIGE_MODULES, renderCorrigeHtml } from '@/scripts/espace/build-corriges';
import { buildFallback, buildLessonData, buildLessonPackage, lireDabord } from '@/scripts/espace/build-fallback';
import * as sim from '@/scripts/espace/fallback/sim';
import * as libSim from '@/components/espace/student/figures/StructureSim';
import { katexInlineCss } from '@/scripts/espace/katex-inline-css';
import type { LessonContent } from '@/lib/espace/lesson-types';
import { hasMath } from '@/lib/espace/math-text';

const ROOT = process.cwd();
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const readJson = (rel: string) => JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8')) as LessonContent;

const tmp = mkdtempSync(path.join(os.tmpdir(), 'nexus-fallback-unit-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const LESSONS = [
  { name: 'TP1 (POO objets)', dir: 'content/espace/nsi-poo', python: true },
  { name: 'TP POO 2', dir: 'content/espace/nsi-structures-lineaires', python: true },
  { name: 'Récursivité', dir: 'content/espace/nsi-recursivite', python: true },
  { name: 'Maths fonctions et limites', dir: 'content/espace/maths-fonctions-limites', python: false },
].filter(({ dir }) => {
  const content = readJson(`${dir}/content.json`);
  return content.steps.length > 0 && !content.version.startsWith('0.0.0'); // contenu provisoire : ignoré
});

describe('paquet d’une leçon', () => {
  describe.each(LESSONS)('$name', ({ dir, python }) => {
    const out = path.join(tmp, path.basename(dir));
    let result: Awaited<ReturnType<typeof buildLessonPackage>>;
    let html = '';

    beforeAll(async () => {
      result = await buildLessonPackage({ contentDir: dir, outDir: out, pyodideCache: false });
      html = readFileSync(path.join(out, 'index.html'), 'utf8');
    }, 120_000);

    it('produit index.html et les ressources KaTeX relatives', () => {
      expect(existsSync(path.join(out, 'index.html'))).toBe(true);
      const css = readFileSync(path.join(out, 'katex', 'katex.min.css'), 'utf8');
      expect(css).toContain('.katex');
      expect(css).toContain('url(fonts/KaTeX_Main-Regular.woff2)');
      expect(readdirSync(path.join(out, 'katex', 'fonts')).filter((f) => f.endsWith('.woff2')).length).toBeGreaterThan(10);
      expect(html).toContain('href="katex/katex.min.css"');
    });

    it('est autonome : aucune URL, aucun script externe, aucun chemin absolu', () => {
      expect(html).not.toMatch(/https?:/i);
      expect(html).not.toMatch(/file:\/\//i);
      expect(html).not.toMatch(/<script[^>]*\ssrc=/i);
      expect(html).not.toMatch(/<link[^>]*href="(?!katex\/)/i);
      for (const absolute of [out, tmp, ROOT, '/home/', '/Users/', '/tmp/']) expect(html).not.toContain(absolute);
      expect(html).not.toMatch(/(?:src|href)="\//);
    });

    it('embarque le code de vérification de la plateforme et le modèle de la leçon', () => {
      expect(html).toContain('Écris ta réponse avant de vérifier'); // answer-check.ts
      expect(html).toContain('id="lesson-data"');
      expect(html).toContain('Enregistré sur cet ordinateur');
      expect(html).toContain('afterprint'); // impression de la fiche
      expect(html).toContain('@page'); // CSS d’impression A4
      expect(html).toMatch(/@media print/);
      expect(html).toContain('katex'); // formules pré-rendues
      expect(html).not.toMatch(/\{\{(?:q|f|fig):/); // aucun jeton non résolu dans les données
    });

    it(python ? 'prépare le Python local' : 'n’embarque pas de Python', () => {
      expect(result.hasPython).toBe(python);
      expect(existsSync(path.join(out, 'python'))).toBe(python);
      if (!python) return;
      const content = readJson(`${dir}/content.json`);
      const coding = content.steps.map((s, i) => ({ s, i })).filter(({ s }) => s.starter !== null);
      expect(result.pythonFiles).toEqual(coding.map(({ s, i }) => `etape_${i + 1}_${s.id}.py`));
      for (const f of result.pythonFiles) expect(existsSync(path.join(out, 'python', f))).toBe(true);
      expect(sha(path.join(out, 'python', 'runner.py'))).toBe(sha(path.join(ROOT, dir, 'runner.py')));
      expect(existsSync(path.join(out, 'python', 'verifier.py'))).toBe(true);
      expect(readFileSync(path.join(out, 'python', 'README_PYTHON.txt'), 'utf8').trimEnd().split('\n')).toHaveLength(5);
      expect(html).toContain('id="runner-data"');
    });
  });
});

describe('fidélité au rendu de la plateforme', () => {
  const content = readJson('content/espace/nsi-structures-lineaires/content.json');

  it.each(LESSONS.filter((l) => l.dir.includes('structures')))('QCM : message ciblé + explication, sinon explication seule', () => {
    const data = buildLessonData(content, 'nsi-structures-lineaires', true);
    let checked = 0;
    for (const [si, step] of content.steps.entries()) {
      for (const [qi, q] of step.questions.entries()) {
        const fb = data.steps[si]!.questions[qi]!;
        expect(fb.correct).toBe(q.correct);
        expect(fb.feedbackByChoice).toHaveLength(q.choices.length);
        q.choices.forEach((_c, ci) => {
          if (ci === q.correct) expect(fb.feedbackByChoice[ci]).toBe(fb.feedbackOk);
          else if (q.choiceFeedback?.[ci] && !hasMath(q.choiceFeedback[ci]!)) {
            const escaped = q.choiceFeedback[ci]!.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            expect(fb.feedbackByChoice[ci]!.startsWith(escaped)).toBe(true);
          }
          checked += 1;
        });
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('les jetons de la leçon sont tous résolus (segments ou éléments « non placés »)', () => {
    const data = buildLessonData(content, 'nsi-structures-lineaires', true);
    for (const [si, step] of content.steps.entries()) {
      const d = data.steps[si]!;
      const placedQ = d.segments.filter((s) => s.kind === 'q').map((s) => (s as { id: string }).id);
      expect([...placedQ, ...d.rest.questions].sort()).toEqual(step.questions.map((q) => q.id).sort());
      const placedF = d.segments.filter((s) => s.kind === 'f').map((s) => (s as { id: string }).id);
      expect([...placedF, ...d.rest.fields].sort()).toEqual(step.fields.map((f) => f.id).sort());
    }
  });
});

describe('simulateur vanilla = simulateur de la plateforme', () => {
  const script: [string, string?][] = [['add', 'A'], ['add', 'B'], ['peek'], ['add', 'C'], ['remove'], ['read', '1'], ['read', '9'], ['read', '-1'], ['remove'], ['remove'], ['remove'], ['peek'], ['add', ''], ['add', ' trop-long-pour-huit '], ['clear']];

  it.each(['liste', 'pile', 'file'] as const)('même état et mêmes messages en mode %s', (mode) => {
    let a = sim.initialState({ initial: ['X'] });
    let b = libSim.initialState({ initial: ['X'] });
    for (const [op, arg] of script) {
      const run = (impl: typeof sim | typeof libSim, s: typeof a) => {
        if (op === 'add') return impl.addItem(mode, s, arg ?? '');
        if (op === 'read') return impl.readAt(s, Number(arg));
        if (op === 'clear') return impl.initialState({ initial: ['X'] });
        if (mode === 'liste') return s; // pas de retrait / consultation sur une liste
        return op === 'remove' ? impl.removeItem(mode, s) : impl.peekItem(mode, s);
      };
      a = run(sim, a);
      b = run(libSim, b);
      expect(a).toEqual(b);
    }
  });
});

describe('LIRE_DABORD.md et paquet complet', () => {
  const pkg = path.join(tmp, 'urgence-seances-2026-10-03');

  beforeAll(async () => {
    await buildFallback({ out: pkg, pyodideCache: false });
  }, 180_000);

  it('tient en 25 lignes avec les commandes exactes sur le premier écran', () => {
    const text = readFileSync(path.join(pkg, 'LIRE_DABORD.md'), 'utf8');
    const lines = text.trimEnd().split('\n');
    expect(lines.length).toBeLessThanOrEqual(25);
    expect(lines[0]).toMatch(/^# /);
    expect(lines.slice(0, 8).join('\n')).toContain('cd ~/Documents/Nexus_Conservation/urgence-seances-2026-10-03 && python3 -m http.server 8765 --directory .');
    expect(text).toContain('http://localhost:8765/NSI_TP2_LISTES_PILES_FILES/');
    expect(text).toContain('http://localhost:8765/NSI_RECURSIVITE/');
    expect(text).toContain('http://localhost:8765/MATHS_FONCTIONS_LIMITES/');
    expect(text).toMatch(/python3 verifier\.py etape_\d+_\w+\.py/);
    expect(text).toContain('https://nexusreussite.academy/espace');
    expect(text).toContain('STATUT_PRODUCTION: à compléter');
    expect(text).not.toContain(tmp);
  });

  it('crée les trois dossiers du paquet', () => {
    for (const dir of ['NSI_TP2_LISTES_PILES_FILES', 'NSI_RECURSIVITE', 'MATHS_FONCTIONS_LIMITES']) expect(existsSync(path.join(pkg, dir, 'index.html'))).toBe(true);
    expect(existsSync(path.join(pkg, 'NSI_TP2_LISTES_PILES_FILES', 'python', 'verifier.py'))).toBe(true);
    expect(existsSync(path.join(pkg, 'NSI_RECURSIVITE', 'python', 'verifier.py'))).toBe(true);
    expect(existsSync(path.join(pkg, 'MATHS_FONCTIONS_LIMITES', 'python'))).toBe(false);
  });

  it('LIRE_DABORD signale un corrigé absent plutôt que de l’affirmer', () => {
    const text = lireDabord('x', 'etape_1_a.py', { nsi: [], maths: ['corrige_enseignant.pdf'] });
    expect(text).toContain('ABSENT');
    expect(text).toContain('MATHS_FONCTIONS_LIMITES/corrige_enseignant.pdf');
    expect(text.trimEnd().split('\n').length).toBeLessThanOrEqual(25);
  });

  it('copie les corrigés présents sous le nom corrige_enseignant.*', async () => {
    const corriges = path.join(tmp, 'corriges-fictifs');
    mkdirSync(path.join(corriges, 'fonctions-limites'), { recursive: true });
    writeFileSync(path.join(corriges, 'fonctions-limites', 'corrige.pdf'), 'PDF');
    writeFileSync(path.join(corriges, 'fonctions-limites', 'corrige.html'), '<p>x</p>');
    const out = path.join(tmp, 'avec-corriges');
    await buildFallback({ out, corriges, pyodideCache: false });
    expect(readFileSync(path.join(out, 'MATHS_FONCTIONS_LIMITES', 'corrige_enseignant.pdf'), 'utf8')).toBe('PDF');
    expect(existsSync(path.join(out, 'MATHS_FONCTIONS_LIMITES', 'corrige_enseignant.html'))).toBe(true);
    expect(existsSync(path.join(out, 'NSI_TP2_LISTES_PILES_FILES', 'corrige_enseignant.pdf'))).toBe(false);
    expect(readFileSync(path.join(out, 'LIRE_DABORD.md'), 'utf8')).toContain('MATHS_FONCTIONS_LIMITES/corrige_enseignant.pdf');
  }, 120_000);
});

describe('python/verifier.py (CPython)', () => {
  const content = readJson('content/espace/nsi-structures-lineaires/content.json');
  const out = path.join(tmp, 'verifier-nsi');
  const py = (...args: string[]) => spawnSync('python3', args, { cwd: path.join(out, 'python'), encoding: 'utf8' });

  beforeAll(async () => {
    await buildLessonPackage({ contentDir: 'content/espace/nsi-structures-lineaires', outDir: out, pyodideCache: false });
  }, 120_000);

  it('code de départ : échec (1) avec un rapport en français', () => {
    const idx = content.steps.findIndex((s) => s.id === 'pile');
    const run = py('verifier.py', `etape_${idx + 1}_pile.py`);
    expect(run.status).toBe(1);
    expect(run.stdout).toContain('À revoir');
    expect(run.stdout).toContain('test(s) réussi(s)');
  });

  it('solution de référence : succès (0)', () => {
    const solutions = JSON.parse(
      spawnSync('python3', ['-c', 'import json,sys; sys.path.insert(0,"content/espace/nsi-structures-lineaires"); from solutions import SOLUTIONS; print(json.dumps(SOLUTIONS))'], { cwd: ROOT, encoding: 'utf8' }).stdout,
    ) as Record<string, string>;
    const idx = content.steps.findIndex((s) => s.id === 'pile');
    const file = `etape_${idx + 1}_pile.py`;
    writeFileSync(path.join(out, 'python', file), solutions.pile!);
    const run = py('verifier.py', file);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('Tout est réussi');
    expect(run.stdout).not.toContain('À revoir');
  });

  it('usage incorrect : code 2', () => {
    expect(py('verifier.py').status).toBe(2);
    expect(py('verifier.py', 'nom_sans_etape.py').status).toBe(2);
  });
});

describe('corrigés enseignant', () => {
  it.each(CORRIGE_MODULES)('$module : HTML autonome, figures et formules rendues', async (mod) => {
    const html = await renderCorrigeHtml(mod, readJson(mod.content), await katexInlineCss(ROOT));
    expect(html).not.toMatch(/https?:/i);
    expect(html).not.toContain('<!--FIG:');
    expect(html).not.toMatch(/\\\(|\\\[/); // aucune formule brute restante
    if (/\\\(|\\\[/.test(readFileSync(path.join(ROOT, mod.source), 'utf8'))) expect(html).toContain('class="katex"');
    expect(html).toContain('data:font/woff2;base64,');
    expect(html).toContain('Document privé');
  }, 60_000);
});

describe('install-resources.ts (modules corrigés)', () => {
  const run = (args: string[], storage: string) =>
    spawnSync('npx', ['tsx', 'scripts/espace/install-resources.ts', ...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, DOCUMENT_STORAGE_ROOT: storage } });

  function makeSource(): string {
    const dir = mkdtempSync(path.join(tmp, 'src-'));
    const pdf = Buffer.from('%PDF-1.4 corrigé de test');
    writeFileSync(path.join(dir, 'corrige.pdf'), pdf);
    writeFileSync(path.join(dir, 'MANIFEST.json'), JSON.stringify({ teacher_resources: [{ internal_name: 'corrige.pdf', sha256: createHash('sha256').update(pdf).digest('hex'), bytes: pdf.length }] }));
    return dir;
  }

  it.each([
    ['poo-structures', 'poo-structures'],
    ['fonctions-limites', 'fonctions-limites'],
  ])('%s : dry-run sans écriture, installation vérifiée, ré-exécution idempotente, refus d’écraser', (module, folder) => {
    const from = makeSource();
    const storage = mkdtempSync(path.join(tmp, 'store-'));
    const target = path.join(storage, 'espace', 'resources', folder, 'corrige.pdf');

    const dry = run(['--from', from, '--module', module], storage);
    expect(dry.status).toBe(0);
    expect(dry.stdout).toContain('DRY-RUN');
    expect(dry.stdout).toContain('TEACHER');
    expect(existsSync(target)).toBe(false);

    const real = run(['--from', from, '--module', module, '--execute'], storage);
    expect(real.status).toBe(0);
    expect(sha(target)).toBe(sha(path.join(from, 'corrige.pdf')));

    const again = run(['--from', from, '--module', module, '--execute'], storage);
    expect(again.status).toBe(0);
    expect(again.stdout).toContain('déjà installé');

    writeFileSync(target, 'contenu différent');
    const clash = run(['--from', from, '--module', module, '--execute'], storage);
    expect(clash.status).not.toBe(0);
    expect(clash.stderr).toContain('pas d\'écrasement');
    expect(readFileSync(target, 'utf8')).toBe('contenu différent'); // jamais écrasé
  }, 120_000);

  it('refuse un fichier altéré par rapport au manifeste', () => {
    const from = makeSource();
    writeFileSync(path.join(from, 'corrige.pdf'), 'altéré');
    const storage = mkdtempSync(path.join(tmp, 'store-'));
    const res = run(['--from', from, '--module', 'poo-structures', '--execute'], storage);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain('empreinte différente');
    expect(existsSync(path.join(storage, 'espace'))).toBe(false);
  }, 60_000);
});
