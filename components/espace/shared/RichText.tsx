'use client';

import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';

import { renderMathInHtml, splitMath } from '@/lib/espace/math-text';

/** KaTeX n'interprète que du TeX ; `trust` reste désactivé et une erreur de syntaxe s'affiche telle quelle, sans exception. */
export function texToHtml(tex: string, display: boolean): string {
  return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'htmlAndMathml', strict: 'ignore', trust: false });
}

/** Texte de leçon (de confiance) avec formules ; tout le reste est du texte React échappé. */
export function RichText({ text }: { text: string }) {
  const segments = useMemo(() => splitMath(text), [text]);
  return (
    <>
      {segments.map((s, i) =>
        s.kind === 'text' ? (
          <span key={i}>{s.value}</span>
        ) : (
          <span key={i} className={s.display ? 'my-2 block overflow-x-auto' : undefined} dangerouslySetInnerHTML={{ __html: texToHtml(s.value, s.display) }} />
        ),
      )}
    </>
  );
}

/** Fragment HTML de leçon (dépôt, de confiance) avec formules. */
export function richHtml(html: string): string {
  return renderMathInHtml(html, texToHtml);
}
