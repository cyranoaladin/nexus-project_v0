/**
 * Construit le paquet de SECOURS hors plateforme (séances du 3 octobre 2026).
 *
 *   npx tsx scripts/espace/build-fallback.ts --out ~/Documents/Nexus_Conservation/urgence-seances-2026-10-03 \
 *       [--corriges build/espace-corriges] [--pyodide-cache <dir>] [--no-pyodide]
 *
 * Produit, sous --out :
 *   LIRE_DABORD.md
 *   NSI_TP2_LISTES_PILES_FILES/   index.html autonome + katex/ + pyodide/ + python/ (+ corrige_enseignant.*)
 *   NSI_RECURSIVITE/              idem (parcours « Récursivité et programmation récursive », trace APPEL/RETOUR comprise)
 *   MATHS_FONCTIONS_LIMITES/      index.html autonome + katex/            (+ corrige_enseignant.*)
 *
 * Chaque index.html fonctionne en file:// (sauf l'exécution Python, voir ci-dessous) ou via
 * `python3 -m http.server`. Aucune requête réseau : le code de vérification (answer-check), le tracé des
 * figures (function-svg) et le Worker Pyodide (python-runner) sont ceux de la plateforme, bundlés par esbuild ;
 * les formules sont rendues par KaTeX à la construction.
 *
 * Limite connue : l'exécution Python utilise un Worker de module + `import()` de ./pyodide/pyodide.mjs, que les
 * navigateurs refusent en file:// ; la page l'indique et propose le serveur local ou python/verifier.py.
 *
 * Le paquet contient des corrigés enseignant : il vit hors Git et n'est jamais publié.
 */
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { build, type Plugin } from 'esbuild';
import katex from 'katex';

import { hasMath, splitMath, renderMathInHtml } from '../../lib/espace/math-text';
import type { LessonContent, LessonStep } from '../../lib/espace/lesson-types';
import { parseLesson, unplaced } from '../../components/espace/student/poo-logic';

import { copyPyodidePack, defaultPyodideCache, fetchPyodide } from './fetch-pyodide';
import type { FbData, FbStep } from './fallback/types';

const ROOT = path.resolve(__dirname, '..', '..');
const FALLBACK_DIR = path.join(__dirname, 'fallback');

// ─── Données de la leçon (calculées à la construction) ──────────────────────

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tex = (t: string, display: boolean) => katex.renderToString(t, { displayMode: display, throwOnError: false, output: 'htmlAndMathml', strict: 'ignore', trust: false });
/** Texte de leçon (de confiance) avec formules : même résultat que `RichText` de la plateforme. */
const rich = (text: string) => splitMath(text).map((s) => (s.kind === 'text' ? esc(s.value) : tex(s.value, s.display))).join('');
/** Fragment HTML de leçon avec formules : même résultat que `richHtml`. */
const richHtml = (html: string) => renderMathInHtml(html, tex);

function stepLabel(step: LessonStep, index: number): string {
  return `${index + 1}. ${step.id === 'bonus' ? `${step.short} (facultatif)` : step.short}`;
}

export function buildLessonData(content: LessonContent, slug: string, python: boolean): FbData {
  const richFeedback: Record<string, string> = {};
  const remember = (text: string | undefined) => {
    if (text && hasMath(text)) richFeedback[text] = rich(text);
  };

  const steps: FbStep[] = content.steps.map((step, i) => {
    const segments = parseLesson(step.lesson).map((seg) => (seg.kind === 'html' ? { ...seg, html: richHtml(seg.html) } : seg));
    const rest = unplaced(step, segments);
    for (const f of step.fields) {
      remember(f.check?.success);
      remember(f.check?.fallback);
      for (const r of f.check?.rules ?? []) remember(r.feedback);
    }
    return {
      id: step.id,
      label: stepLabel(step, i),
      title: step.title,
      level: step.level,
      minutes: step.minutes,
      introHtml: rich(step.intro),
      taskHtml: rich(step.task),
      takeawayHtml: step.takeaway ? rich(step.takeaway) : '',
      hintsHtml: step.hints.map(rich),
      printable: step.printable === true,
      starter: step.starter,
      segments,
      rest: { figures: rest.figures.map((f) => f.id), questions: rest.questions.map((q) => q.id), code: rest.code, fields: rest.fields.map((f) => f.id) },
      questions: step.questions.map((q) => ({
        id: q.id,
        textHtml: rich(q.text),
        choicesHtml: q.choices.map(rich),
        correct: q.correct,
        feedbackOk: rich(q.feedback),
        // Même règle que LessonWorkbench : message ciblé du choix, suivi de l'explication.
        feedbackByChoice: q.choices.map((_c, ci) => (ci !== q.correct && q.choiceFeedback?.[ci] ? rich(`${q.choiceFeedback[ci]} ${q.feedback}`) : rich(q.feedback))),
      })),
      fields: step.fields.map((f) => ({ id: f.id, labelHtml: rich(f.label), placeholder: f.placeholder, input: f.input === 'line' ? ('line' as const) : ('area' as const), check: f.check })),
      figures: step.figures ?? [],
    };
  });

  return { slug, version: content.version, title: content.title, session: content.session, duration: content.duration, phases: content.ui?.phases === true, python, steps, richFeedback };
}

// ─── Bundle du runtime ──────────────────────────────────────────────────────

/** Le runtime réutilise `python-runner.ts` tel quel ; seule l'URL CDN par défaut (jamais utilisée) est neutralisée. */
const localPyodideDefault: Plugin = {
  name: 'local-pyodide-default',
  setup(b) {
    b.onLoad({ filter: /python-runner\.ts$/ }, async (args) => {
      const source = await readFile(args.path, 'utf8');
      const patched = source.replace(/https:\/\/cdn\.jsdelivr\.net\/pyodide\/[^'"]+/, './pyodide/');
      if (patched === source) throw new Error('python-runner.ts : constante PYODIDE_BASE introuvable (structure modifiée ?)');
      return { contents: patched, loader: 'ts' };
    });
  },
};

export async function bundleRuntime(): Promise<string> {
  const result = await build({
    entryPoints: [path.join(FALLBACK_DIR, 'runtime.ts')],
    bundle: true,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2019',
    write: false,
    legalComments: 'none',
    charset: 'utf8',
    define: { 'process.env.NODE_ENV': '"production"' },
    tsconfig: path.join(ROOT, 'tsconfig.json'),
    plugins: [localPyodideDefault],
    logLevel: 'silent',
  });
  return result.outputFiles[0]!.text;
}

// ─── Assemblage ─────────────────────────────────────────────────────────────

/** Les espaces de noms XML sont inutiles dans un document HTML (svg/math sont reconnus par l'analyseur) et sont des URL. */
const stripXmlns = (s: string) => s.replace(/\sxmlns=\\?"http:\/\/www\.w3\.org\/[^"\\]*\\?"/g, '');
const jsonForHtml = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

function assemblePage(data: FbData, runnerSource: string | null, bundle: string, css: string): string {
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(data.title)} — plan de secours</title>
<link rel="stylesheet" href="katex/katex.min.css">
<style>${css}</style>
</head>
<body data-lesson="${esc(data.slug)}">
<div class="wrap">
<header class="top">
<div><p class="session">${esc(data.session)}</p><h1>${esc(data.title)}</h1></div>
<div class="meta-row"><span id="save-indicator" role="status" aria-live="polite" data-testid="save-indicator">Enregistré sur cet ordinateur</span><span id="step-count"></span><button type="button" data-action="print" data-testid="btn-print">Imprimer</button></div>
</header>
<p class="banner"><strong>Plan de secours, sans Internet.</strong> Tes réponses restent sur cet ordinateur (elles ne sont pas envoyées à Nexus). Pour rendre ton travail, imprime-le (bouton « Imprimer »).</p>
<div class="layout">
<div>
<div class="stepselect"><label for="step-select">Étape</label><select id="step-select"></select></div>
<nav class="steps" aria-label="Étapes du TP"><ol id="step-list"></ol></nav>
</div>
<article id="article" aria-labelledby="etape-titre"></article>
</div>
</div>
<script type="application/json" id="lesson-data">${jsonForHtml(data)}</script>
${runnerSource === null ? '' : `<script type="application/json" id="runner-data">${jsonForHtml(runnerSource)}</script>\n`}<script>${bundle.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`;
  return stripXmlns(html);
}

/** KaTeX : feuille de style + polices woff2 (URL relatives), sans les formats de repli devenus inutiles. */
async function copyKatexAssets(dest: string) {
  const dist = path.join(ROOT, 'node_modules', 'katex', 'dist');
  const fonts = (await readdir(path.join(dist, 'fonts'))).filter((f) => f.endsWith('.woff2'));
  const css = (await readFile(path.join(dist, 'katex.min.css'), 'utf8'))
    .replace(/,\s*url\(fonts\/[^)]+\.woff\)\s*format\("woff"\)/g, '')
    .replace(/,\s*url\(fonts\/[^)]+\.ttf\)\s*format\("truetype"\)/g, '');
  await mkdir(path.join(dest, 'katex', 'fonts'), { recursive: true });
  await writeFile(path.join(dest, 'katex', 'katex.min.css'), css);
  for (const f of fonts) await copyFile(path.join(dist, 'fonts', f), path.join(dest, 'katex', 'fonts', f));
}

const exists = (p: string) => stat(p).then(() => true, () => false);

export interface LessonPackageOptions {
  /** Dossier du contenu (content.json + runner.py éventuel). */
  contentDir: string;
  /** Dossier de sortie de CE module. */
  outDir: string;
  /** Cache Pyodide à copier dans `./pyodide/`, ou `false` pour ne pas l'embarquer (tests). */
  pyodideCache?: string | false;
  /** Dossier contenant `corrige.pdf` / `corrige.html` de ce module (optionnel). */
  corrigeDir?: string;
  log?: (message: string) => void;
}

export interface LessonPackageResult {
  pythonFiles: string[];
  hasPython: boolean;
  corrigeFiles: string[];
}

export async function buildLessonPackage(opts: LessonPackageOptions): Promise<LessonPackageResult> {
  const contentDir = path.resolve(ROOT, opts.contentDir);
  const content = JSON.parse(await readFile(path.join(contentDir, 'content.json'), 'utf8')) as LessonContent;
  const runnerPath = path.join(contentDir, 'runner.py');
  const runnerSource = (await exists(runnerPath)) ? await readFile(runnerPath, 'utf8') : null;
  const coding = content.steps.some((s) => s.starter !== null);
  const python = runnerSource !== null && coding;

  await mkdir(opts.outDir, { recursive: true });
  const data = buildLessonData(content, path.basename(contentDir), python);
  const page = assemblePage(data, python ? runnerSource : null, await bundleRuntime(), await readFile(path.join(FALLBACK_DIR, 'styles.css'), 'utf8'));
  const leak = page.match(/.{0,60}(https?:\/\/|file:\/\/).{0,60}/);
  if (leak) throw new Error(`index.html contient une URL externe : « ${leak[0]} »`);
  await writeFile(path.join(opts.outDir, 'index.html'), page);
  await copyKatexAssets(opts.outDir);

  const pythonFiles: string[] = [];
  if (python) {
    const pyDir = path.join(opts.outDir, 'python');
    await mkdir(pyDir, { recursive: true });
    for (const [i, step] of content.steps.entries()) {
      if (step.starter === null) continue;
      const name = `etape_${i + 1}_${step.id}.py`;
      await writeFile(path.join(pyDir, name), step.starter.endsWith('\n') ? step.starter : `${step.starter}\n`);
      pythonFiles.push(name);
    }
    await writeFile(path.join(pyDir, 'runner.py'), runnerSource!);
    await copyFile(path.join(FALLBACK_DIR, 'verifier.py'), path.join(pyDir, 'verifier.py'));
    const example = pythonFiles[Math.min(1, pythonFiles.length - 1)] ?? 'etape_1_exemple.py';
    await writeFile(
      path.join(pyDir, 'README_PYTHON.txt'),
      [
        'Python local, sans navigateur ni Internet : un fichier etape_<n>_<id>.py par étape de programmation.',
        '1. Complétez le fichier de l’étape avec un éditeur de texte (le code de départ y est déjà).',
        `2. Vérifiez-le : python3 verifier.py ${example}   (l’étape se déduit du nom du fichier)`,
        '3. Le rapport est en français ; le code de sortie vaut 0 seulement si tous les tests réussissent.',
        'runner.py est le harnais de la plateforme (bibliothèque standard seulement) ; ne le modifiez pas.',
      ].join('\n') + '\n',
    );
    if (opts.pyodideCache !== false) {
      const cache = opts.pyodideCache ?? defaultPyodideCache();
      await fetchPyodide(cache, { log: opts.log });
      await copyPyodidePack(cache, path.join(opts.outDir, 'pyodide'));
    }
  }

  const corrigeFiles: string[] = [];
  if (opts.corrigeDir) {
    for (const ext of ['pdf', 'html']) {
      const source = path.join(opts.corrigeDir, `corrige.${ext}`);
      if (await exists(source)) {
        await copyFile(source, path.join(opts.outDir, `corrige_enseignant.${ext}`));
        corrigeFiles.push(`corrige_enseignant.${ext}`);
      }
    }
  }
  return { pythonFiles, hasPython: python, corrigeFiles };
}

// ─── Paquet complet ─────────────────────────────────────────────────────────

const PACKAGE_MODULES = [
  { dir: 'NSI_TP2_LISTES_PILES_FILES', content: 'content/espace/nsi-structures-lineaires', corrige: 'poo-structures' },
  { dir: 'NSI_RECURSIVITE', content: 'content/espace/nsi-recursivite', corrige: 'recursivite' },
  { dir: 'MATHS_FONCTIONS_LIMITES', content: 'content/espace/maths-fonctions-limites', corrige: 'fonctions-limites' },
] as const;

export function lireDabord(packageName: string, firstStarter: string, corriges: { nsi: string[]; maths: string[]; rec?: string[] }): string {
  const where = (files: string[], dir: string) => (files.length ? files.map((f) => `${dir}/${f}`).join(' + ') : `${dir} : ABSENT (lancer scripts/espace/build-corriges.ts puis reconstruire)`);
  return `${[
    '# LIRE D’ABORD — plan de secours de l’espace Terminale (hors ligne)',
    '',
    '## 1. Lancer (copier-coller dans un terminal)',
    `cd ~/Documents/Nexus_Conservation/${packageName} && python3 -m http.server 8765 --directory .`,
    '',
    '## 2. Ouvrir dans le navigateur (laisser le terminal ouvert)',
    '- NSI, TP POO 2 : http://localhost:8765/NSI_TP2_LISTES_PILES_FILES/',
    '- NSI, Récursivité : http://localhost:8765/NSI_RECURSIVITE/',
    '- Maths, fonctions et limites : http://localhost:8765/MATHS_FONCTIONS_LIMITES/',
    '(Un double-clic sur index.html marche aussi, mais le bouton Python exige l’adresse http://localhost ci-dessus.)',
    '',
    '## 3. Python sans navigateur (NSI)',
    `cd NSI_TP2_LISTES_PILES_FILES/python && python3 verifier.py ${firstStarter}   (Récursivité : cd NSI_RECURSIVITE/python && python3 verifier.py etape_5_ecrire.py)`,
    '',
    '## 4. Corrigés enseignant (NE PAS distribuer aux élèves)',
    `- ${where(corriges.nsi, 'NSI_TP2_LISTES_PILES_FILES')}`,
    `- ${where(corriges.rec ?? [], 'NSI_RECURSIVITE')}`,
    `- ${where(corriges.maths, 'MATHS_FONCTIONS_LIMITES')}`,
    '',
    '## 5. Plateforme',
    '- Production : https://nexusreussite.academy/espace',
    '- STATUT_PRODUCTION: à compléter',
    'Les réponses sont enregistrées dans ce navigateur (indicateur en haut de page). Bouton « Imprimer » dans chaque page.',
  ].join('\n')}\n`;
}

export interface FallbackOptions {
  out: string;
  corriges?: string;
  pyodideCache?: string | false;
  log?: (message: string) => void;
}

export async function buildFallback(opts: FallbackOptions): Promise<void> {
  const log = opts.log ?? (() => undefined);
  const out = path.resolve(opts.out);
  await mkdir(out, { recursive: true });
  const present: { nsi: string[]; maths: string[]; rec: string[] } = { nsi: [], maths: [], rec: [] };
  let firstStarter = 'etape_3_pile.py';
  for (const mod of PACKAGE_MODULES) {
    const corrigeDir = opts.corriges ? path.join(path.resolve(opts.corriges), mod.corrige) : undefined;
    const result = await buildLessonPackage({ contentDir: mod.content, outDir: path.join(out, mod.dir), pyodideCache: opts.pyodideCache, corrigeDir, log });
    if (mod.dir === 'NSI_RECURSIVITE') present.rec = result.corrigeFiles;
    else if (mod.dir.startsWith('NSI')) {
      present.nsi = result.corrigeFiles;
      firstStarter = result.pythonFiles.find((f) => f.includes('_pile')) ?? result.pythonFiles[0] ?? firstStarter;
    } else present.maths = result.corrigeFiles;
    log(`${mod.dir} : index.html, katex/${result.hasPython ? `, pyodide/, python/ (${result.pythonFiles.length} fichiers)` : ''}${result.corrigeFiles.length ? `, ${result.corrigeFiles.join(' + ')}` : ''}`);
  }
  await writeFile(path.join(out, 'LIRE_DABORD.md'), lireDabord(path.basename(out), firstStarter, present));
}

async function main() {
  const { values } = parseArgs({
    options: { out: { type: 'string' }, corriges: { type: 'string' }, 'pyodide-cache': { type: 'string' }, 'no-pyodide': { type: 'boolean', default: false } },
  });
  if (!values.out) throw new Error('--out est obligatoire');
  const expand = (p: string) => p.replace(/^~(?=$|\/)/, os.homedir());
  const defaultCorriges = path.join(ROOT, 'build', 'espace-corriges');
  const corriges = values.corriges ? expand(values.corriges) : (await exists(defaultCorriges)) ? defaultCorriges : undefined;
  if (!corriges) process.stderr.write('AVERTISSEMENT : aucun dossier de corrigés (lancer build-corriges.ts) ; le paquet sera construit sans corrigé.\n');
  await buildFallback({
    out: expand(values.out),
    corriges,
    pyodideCache: values['no-pyodide'] ? false : values['pyodide-cache'] ? expand(values['pyodide-cache']) : undefined,
    log: (m) => process.stdout.write(`${m}\n`),
  });
  process.stdout.write('OK.\n');
}

if (require.main === module) {
  main().catch((e) => {
    process.stderr.write(`ERREUR : ${e instanceof Error ? e.message : 'inconnue'}\n`);
    process.exitCode = 1;
  });
}
