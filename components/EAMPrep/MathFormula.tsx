"use client";

import { BlockMath, InlineMath } from "react-katex";

interface MathFormulaProps {
  value: string;
  displayMode?: boolean;
  className?: string;
}

export function MathFormula({ value, displayMode = true, className }: MathFormulaProps) {
  try {
    return (
      <span className={`block max-w-full overflow-x-auto overflow-y-hidden px-1 py-2 ${className ?? ""}`}>
        {displayMode ? (
          <BlockMath math={value} errorColor="#fca5a5" />
        ) : (
          <InlineMath math={value} errorColor="#fca5a5" />
        )}
      </span>
    );
  } catch {
    return (
      <span className={`text-sm text-neutral-100 ${className ?? ""}`} aria-label="Formule mathématique">
        Formule mathématique
      </span>
    );
  }
}
