/**
 * Formules dans les textes de leçon : `\( … \)` (en ligne) et `\[ … \]` (centrée).
 * Fonctions pures ; le rendu KaTeX est fourni par l'appelant (client ou Node).
 */
export type TextSegment = { kind: 'text'; value: string } | { kind: 'math'; value: string; display: boolean };

const MATH = /\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;

export function splitMath(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(MATH)) {
    const index = m.index ?? 0;
    if (index > last) out.push({ kind: 'text', value: text.slice(last, index) });
    const display = m[2] !== undefined;
    out.push({ kind: 'math', value: (m[1] ?? m[2] ?? '').trim(), display });
    last = index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', value: text.slice(last) });
  return out;
}

function decodeEntities(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** Remplace les formules d'un fragment HTML de confiance (les entités de base sont décodées avant le rendu). */
export function renderMathInHtml(html: string, render: (tex: string, display: boolean) => string): string {
  return html.replace(MATH, (_m, inline: string | undefined, display: string | undefined) => {
    const tex = decodeEntities((inline ?? display ?? '').trim());
    return render(tex, display !== undefined);
  });
}

export function hasMath(text: string): boolean {
  MATH.lastIndex = 0;
  return MATH.test(text);
}
