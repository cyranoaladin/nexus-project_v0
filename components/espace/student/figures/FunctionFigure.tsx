'use client';

import { useMemo } from 'react';

import { parseAffine } from '@/lib/espace/answer-check';
import { buildFunctionSvg } from '@/lib/espace/figures/function-svg';
import { RichText } from '@/components/espace/shared/RichText';
import type { FunctionFigureSpec } from '@/lib/espace/lesson-types';

/**
 * Figure d'une fonction. Le SVG est produit par un module pur à partir de NOMBRES du contenu
 * (jamais de texte d'élève) : seul l'équation saisie par l'élève est analysée, puis réduite à
 * deux nombres (a, b) avant d'être tracée.
 */
export function FunctionFigure({ spec, overlay }: { spec: FunctionFigureSpec; overlay?: string | null }) {
  const svg = useMemo(() => {
    let line: { a: number; b: number } | null = null;
    if (overlay && overlay.trim()) {
      // « y = −3x − 1 » ou « −3x − 1 » : on retire un éventuel « y = » initial.
      const rhs = overlay.replace(/^\s*y\s*=/i, '');
      const parsed = rhs.includes('=') ? null : parseAffine(rhs);
      if (parsed) line = parsed;
    }
    return buildFunctionSvg(spec, { overlay: line });
  }, [spec, overlay]);

  return (
    <figure className="my-2 max-w-full" data-testid={`figure-${spec.id}`}>
      <div className="overflow-hidden rounded-lg border border-white/15 bg-white [&>svg]:h-auto [&>svg]:w-full [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      {spec.caption && <figcaption className="mt-1 text-sm text-neutral-300"><RichText text={spec.caption} /></figcaption>}
    </figure>
  );
}
