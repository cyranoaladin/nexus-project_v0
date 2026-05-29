"use client";

import { InlineMath } from "react-katex";

export function MathInline({ latex }: { latex: string }) {
  return (
    <span className="inline-flex max-w-full overflow-x-auto align-middle">
      <InlineMath math={latex} />
    </span>
  );
}
