/**
 * Construit les corrigés enseignants (PDF privés) à partir des sources de `docs/espace/corriges/`.
 *
 *   npx tsx scripts/espace/build-corriges.ts [--out build/espace-corriges] [--only <module>]
 *
 * Sortie : <out>/<module>/corrige.pdf et <out>/<module>/MANIFEST.json (empreinte + taille) ;
 * ce manifeste est celui que `install-resources.ts` vérifie avant toute copie en stockage privé.
 * Les PDF ne sont JAMAIS committés ni servis publiquement.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { chromium } from 'playwright-core';

import { CORRIGE_CSS, renderCorrigeBody } from '@/lib/espace/corrige-render';
import type { LessonContent } from '@/lib/espace/lesson-types';

interface CorrigeModule {
  slug: string;
  title: string;
  content: string;
  source: string;
}

const MODULES: CorrigeModule[] = [
  {
    slug: 'maths-fonctions-limites',
    title: 'Corrigé enseignant — Fonctions, limites et lecture graphique',
    content: 'content/espace/maths-fonctions-limites/content.json',
    source: 'docs/espace/corriges/maths-limites/corrige.html',
  },
  {
    slug: 'nsi-structures-lineaires',
    title: 'Corrigé enseignant — TP POO 2 : Structures linéaires',
    content: 'content/espace/nsi-structures-lineaires/content.json',
    source: 'docs/espace/corriges/nsi-poo2/corrige.html',
  },
];

const root = process.cwd();
const sha = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

async function main() {
  const { values } = parseArgs({ options: { out: { type: 'string', default: 'build/espace-corriges' }, only: { type: 'string' } } });
  const out = path.resolve(root, values.out as string);
  const katexDist = path.join(root, 'node_modules', 'katex', 'dist');
  const katexCss = await readFile(path.join(katexDist, 'katex.min.css'), 'utf8');

  const browser = await chromium.launch();
  try {
    for (const mod of MODULES.filter((m) => !values.only || m.slug === values.only)) {
      const content = JSON.parse(await readFile(path.join(root, mod.content), 'utf8')) as LessonContent;
      const source = await readFile(path.join(root, mod.source), 'utf8');
      const body = renderCorrigeBody(source, content);
      const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><base href="file://${katexDist}/"><title>${mod.title}</title>
<style>${katexCss}</style><style>${CORRIGE_CSS}</style></head><body>${body}
<p class="footer-note">Document privé — Nexus Réussite. Réservé à l’enseignant ; ne pas diffuser aux élèves. Version du parcours : ${content.version}.</p></body></html>`;

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

      const dir = path.join(out, mod.slug);
      await mkdir(dir, { recursive: true });
      const buf = Buffer.from(pdf);
      await writeFile(path.join(dir, 'corrige.pdf'), buf, { mode: 0o640 });
      const manifest = {
        module: mod.slug,
        content_version: content.version,
        teacher_resources: [{ internal_name: 'corrige.pdf', sha256: sha(buf), bytes: buf.length }],
      };
      await writeFile(path.join(dir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
      process.stdout.write(`${mod.slug} : corrige.pdf ${buf.length} octets, sha256 ${manifest.teacher_resources[0].sha256.slice(0, 16)}…\n`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  process.stderr.write(`ERREUR : ${e instanceof Error ? e.message : 'inconnue'}\n`);
  process.exitCode = 1;
});
