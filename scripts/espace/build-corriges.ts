/**
 * Construit les corrigés enseignants (HTML autonome + PDF privé) à partir des sources de `docs/espace/corriges/`.
 *
 *   npx tsx scripts/espace/build-corriges.ts [--out build/espace-corriges] [--only <module>]
 *
 * Modules : `poo-structures` (TP POO 2), `recursivite` (NSI, Algorithmique) et `fonctions-limites` (Maths) — mêmes noms que `install-resources.ts --module`.
 * Sortie : <out>/<module>/corrige.html, corrige.pdf et MANIFEST.json (empreinte + taille de chaque fichier) ;
 * c'est ce manifeste que `install-resources.ts` vérifie avant toute copie en stockage privé.
 *   - corrige.html : autonome (KaTeX et polices incorporés, figures SVG incluses), sans aucune requête réseau ;
 *   - corrige.pdf  : A4, fonds imprimés (Chromium via Playwright).
 * Ces fichiers ne sont JAMAIS committés ni servis publiquement.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { chromium } from 'playwright-core';

import { CORRIGE_CSS, renderCorrigeBody } from '../../lib/espace/corrige-render';
import type { LessonContent } from '../../lib/espace/lesson-types';

import { katexInlineCss } from './katex-inline-css';

interface CorrigeModule {
  module: string;
  title: string;
  content: string;
  source: string;
}

export const CORRIGE_MODULES: CorrigeModule[] = [
  {
    module: 'fonctions-limites',
    title: 'Corrigé enseignant — Fonctions, limites et lecture graphique',
    content: 'content/espace/maths-fonctions-limites/content.json',
    source: 'docs/espace/corriges/maths-limites/corrige.html',
  },
  {
    module: 'poo-structures',
    title: 'Corrigé enseignant — TP POO 2 : Listes, piles et files',
    content: 'content/espace/nsi-structures-lineaires/content.json',
    source: 'docs/espace/corriges/nsi-poo2/corrige.html',
  },
  {
    module: 'recursivite',
    title: 'Corrigé enseignant — Récursivité et programmation récursive',
    content: 'content/espace/nsi-recursivite/content.json',
    source: 'docs/espace/corriges/nsi-recursivite/corrige.html',
  },
];

const root = path.resolve(__dirname, '..', '..');
const sha = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');
/** Les espaces de noms XML sont des URL inutiles dans un document HTML : on les retire pour un fichier sans lien externe. */
const stripXmlns = (s: string) => s.replace(/\sxmlns="http:\/\/www\.w3\.org\/[^"]*"/g, '');

export async function renderCorrigeHtml(mod: CorrigeModule, content: LessonContent, css: string): Promise<string> {
  const source = await readFile(path.join(root, mod.source), 'utf8');
  const body = renderCorrigeBody(source, content);
  return stripXmlns(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${mod.title}</title>
<style>${css}</style><style>${CORRIGE_CSS}</style></head><body>${body}
<p class="footer-note">Document privé — Nexus Réussite. Réservé à l’enseignant ; ne pas diffuser aux élèves. Version du parcours : ${content.version}.</p></body></html>
`);
}

async function main() {
  const { values } = parseArgs({ options: { out: { type: 'string', default: 'build/espace-corriges' }, only: { type: 'string' } } });
  const out = path.resolve(process.cwd(), values.out as string);
  const modules = CORRIGE_MODULES.filter((m) => !values.only || m.module === values.only);
  if (modules.length === 0) throw new Error(`Module inconnu : ${values.only} (attendu : ${CORRIGE_MODULES.map((m) => m.module).join(', ')})`);
  const css = await katexInlineCss(root);

  const browser = await chromium.launch();
  try {
    for (const mod of modules) {
      const content = JSON.parse(await readFile(path.join(root, mod.content), 'utf8')) as LessonContent;
      const html = await renderCorrigeHtml(mod, content, css);

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate:
          '<div style="font-size:8px;width:100%;text-align:center;color:#6b7280">Corrigé enseignant — document privé · page <span class="pageNumber"></span>/<span class="totalPages"></span></div>',
        margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' },
      });
      await page.close();

      const dir = path.join(out, mod.module);
      await mkdir(dir, { recursive: true });
      const htmlBuf = Buffer.from(html, 'utf8');
      const pdfBuf = Buffer.from(pdf);
      await writeFile(path.join(dir, 'corrige.html'), htmlBuf, { mode: 0o640 });
      await writeFile(path.join(dir, 'corrige.pdf'), pdfBuf, { mode: 0o640 });
      const manifest = {
        module: mod.module,
        content_version: content.version,
        teacher_resources: [
          { internal_name: 'corrige.pdf', sha256: sha(pdfBuf), bytes: pdfBuf.length },
          { internal_name: 'corrige.html', sha256: sha(htmlBuf), bytes: htmlBuf.length },
        ],
      };
      await writeFile(path.join(dir, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
      process.stdout.write(`${mod.module} : corrige.pdf ${pdfBuf.length} o (sha256 ${manifest.teacher_resources[0]!.sha256.slice(0, 16)}…), corrige.html ${htmlBuf.length} o\n`);
    }
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch((e) => {
    process.stderr.write(`ERREUR : ${e instanceof Error ? e.message : 'inconnue'}\n`);
    process.exitCode = 1;
  });
}
