'use client';

import { RichText } from '@/components/espace/shared/RichText';
import { plainMath } from '@/lib/espace/math-text';
import type { FigureSpec } from '@/lib/espace/lesson-types';

import { FunctionFigure } from './FunctionFigure';
import { StructureSim } from './StructureSim';

/** Aiguille une figure de leçon vers son composant. `overlay` = équation saisie par l'élève (le cas échéant). */
export function FigureView({ spec, overlay }: { spec: FigureSpec; overlay?: string | null }) {
  switch (spec.type) {
    case 'function':
      return <FunctionFigure spec={spec} overlay={overlay} />;
    case 'structure-sim':
      return <StructureSim spec={spec} />;
    case 'svg':
      return (
        <figure className="my-3">
          <div role="img" aria-label={plainMath(spec.alt)} className="max-w-full overflow-x-auto text-neutral-100 [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: spec.svg }} />
          {spec.caption && <figcaption className="mt-1 text-sm text-neutral-300"><RichText text={spec.caption} /></figcaption>}
        </figure>
      );
  }
}
