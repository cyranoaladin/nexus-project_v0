/** Feuille de style KaTeX AUTONOME : polices woff2 incorporées en data URI (document HTML sans dépendance). */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function katexInlineCss(root: string): Promise<string> {
  const dist = path.join(root, 'node_modules', 'katex', 'dist');
  let css = await readFile(path.join(dist, 'katex.min.css'), 'utf8');
  // Formats de repli (woff, ttf) inutiles : tous les navigateurs actuels lisent le woff2.
  css = css.replace(/,\s*url\(fonts\/[^)]+\.woff\)\s*format\("woff"\)/g, '').replace(/,\s*url\(fonts\/[^)]+\.ttf\)\s*format\("truetype"\)/g, '');
  const names = new Set([...css.matchAll(/url\(fonts\/([^)]+\.woff2)\)/g)].map((m) => m[1]!));
  const data = new Map<string, string>();
  for (const name of names) data.set(name, `data:font/woff2;base64,${(await readFile(path.join(dist, 'fonts', name))).toString('base64')}`);
  return css.replace(/url\(fonts\/([^)]+\.woff2)\)/g, (_m, name: string) => `url(${data.get(name)})`);
}
