"use client";

import { Check } from "lucide-react";
import type { EAMModule } from "./types";

interface ChecklistProps {
  module: EAMModule;
  checks: Record<string, boolean>;
  onToggle: (key: string) => void;
}

export function Checklist({ module, checks, onToggle }: ChecklistProps) {
  return (
    <div className="w-full min-w-0 max-w-full space-y-2">
      {module.checklist.map((item, index) => {
        const key = `${module.id}_${index}`;
        const checked = Boolean(checks[key]);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            data-testid={`eam-check-${key}`}
            aria-pressed={checked}
            className="flex w-full min-w-0 items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-white/20 hover:bg-white/10"
            style={{ borderLeftColor: module.color, borderLeftWidth: 3 }}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? "border-transparent text-surface-darker" : "border-white/25 text-transparent"}`}
              style={{ backgroundColor: checked ? module.color : "transparent" }}
              aria-hidden="true"
            >
              <Check className="h-3.5 w-3.5" />
            </span>
            <span className={`min-w-0 break-words text-sm ${checked ? "text-neutral-500 line-through" : "text-neutral-100"}`}>{item}</span>
          </button>
        );
      })}
    </div>
  );
}
