/**
 * Rendu HTML d'un corrigé enseignant (document PRIVÉ) : formules KaTeX et figures du
 * parcours résolues dans une source rédigée à la main. Pur (pas de navigateur) : le PDF
 * est produit par `scripts/espace/build-corriges.ts`.
 *
 * Marqueurs : un commentaire HTML `FIG:<id>` est remplacé par la figure de la leçon portant cet id.
 */
import katex from 'katex';

import { buildFunctionSvg } from './figures/function-svg';
import type { FigureSpec, LessonContent } from './lesson-types';

export function figureSvg(spec: FigureSpec): string {
  if (spec.type === 'function') return buildFunctionSvg(spec);
  if (spec.type === 'svg') return spec.svg;
  // Simulateur interactif : sans équivalent statique. Le corrigé le mentionne dans son texte.
  return '';
}

export function allFigures(content: LessonContent): Map<string, FigureSpec> {
  const map = new Map<string, FigureSpec>();
  for (const s of content.steps) for (const f of s.figures ?? []) map.set(f.id, f);
  return map;
}

export function renderMath(source: string): string {
  return source
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, tex: string) => katex.renderToString(tex, { displayMode: true, throwOnError: true, strict: 'error' }))
    .replace(/\\\(([\s\S]*?)\\\)/g, (_m, tex: string) => katex.renderToString(tex, { throwOnError: true, strict: 'error' }));
}

export function renderCorrigeBody(source: string, content: LessonContent): string {
  const figures = allFigures(content);
  const body = source
    .replace(/^\s*<!--[\s\S]*?-->/, '') // commentaire d'en-tête du fichier source
    .replace(/<!--FIG:([\w-]+?)-->/g, (_m, id: string) => {
      const spec = figures.get(id);
      if (!spec) throw new Error(`Figure inconnue dans le corrigé : ${id}`);
      const svg = figureSvg(spec);
      if (!svg) return '';
      const caption = 'caption' in spec && spec.caption ? `<figcaption>${renderMath(spec.caption)}</figcaption>` : '';
      return `<figure class="fig">${svg}${caption}</figure>`;
    });
  return renderMath(body);
}

export const CORRIGE_CSS = `
@page { size: A4; margin: 16mm 14mm 18mm; }
* { box-sizing: border-box; }
body { font: 10.5pt/1.5 "DejaVu Sans", "Liberation Sans", Arial, sans-serif; color: #111827; }
h1 { font-size: 18pt; margin: 0 0 4pt; color: #0b2447; }
h2 { font-size: 13pt; margin: 16pt 0 4pt; padding-bottom: 2pt; border-bottom: 1.5pt solid #c9a24a; color: #0b2447; break-after: avoid; }
h3, h4 { margin: 10pt 0 3pt; break-after: avoid; }
p, li { orphans: 3; widows: 3; }
.meta { color: #4b5563; margin: 0 0 8pt; }
.box { border: 1pt solid #0b2447; background: #f4f6fb; padding: 6pt 9pt; margin: 6pt 0; break-inside: avoid; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0; font-size: 9.5pt; break-inside: avoid; }
th, td { border: .6pt solid #9ca3af; padding: 3pt 5pt; vertical-align: top; text-align: left; }
th { background: #eef1f7; }
figure.fig { margin: 8pt auto; text-align: center; break-inside: avoid; }
figure.fig svg { max-width: 135mm; height: auto; }
figcaption { font-size: 9pt; color: #4b5563; }
pre, code { font: 9.5pt/1.4 "DejaVu Sans Mono", monospace; }
pre { background: #f3f4f6; border: .6pt solid #d1d5db; padding: 5pt 7pt; white-space: pre-wrap; break-inside: avoid; }
.tag { display: inline-block; font-size: 8.5pt; padding: 0 4pt; border: .6pt solid #0b2447; }
.footer-note { margin-top: 18pt; font-size: 8.5pt; color: #6b7280; border-top: .6pt solid #d1d5db; padding-top: 4pt; }
`;
